import { NextResponse } from "next/server";
import { getDeliveryAvailabilitySnapshot } from "@/lib/booking-availability";
import { resolveSelectedDumpster } from "@/lib/booking-product";
import { getDumpsterRentalPolicy } from "@/lib/dumpster-rental-policy";
import { addDaysYmd, getMaximumBookablePickupDate } from "@/lib/booking-pricing";

function isYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test((s || "").trim());
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const deliveryDate = (url.searchParams.get("deliveryDate") || "").trim();
  const selectedDumpster = resolveSelectedDumpster({
    dumpsterSize: url.searchParams.get("dumpsterSize"),
    dumpsterProductId: url.searchParams.get("dumpsterProductId"),
  });

  if (!isYMD(deliveryDate)) {
    return NextResponse.json({ ok: false, error: "Invalid deliveryDate" }, { status: 400 });
  }

  const rentalPolicy = await getDumpsterRentalPolicy(selectedDumpster);
  const defaultEnd = addDaysYmd(deliveryDate, rentalPolicy.standardRentalDays);
  const pricingMaxPickupDate =
    getMaximumBookablePickupDate(deliveryDate, rentalPolicy, null) ?? defaultEnd;
  let lastAvailablePickupDate: string | null = null;

  try {
    for (
      let candidateDate = defaultEnd;
      candidateDate <= pricingMaxPickupDate;
      candidateDate = addDaysYmd(candidateDate, 1)
    ) {
      const availability = await getDeliveryAvailabilitySnapshot({
        deliveryDate,
        rpcDays: rentalPolicy.standardRentalDays,
        dumpsterSize: selectedDumpster.dumpsterSize,
        dumpsterProductId: selectedDumpster.dumpsterProductId,
        pickupDate: candidateDate,
        logContext: "api/pickup-cap",
      });

      if (availability.remaining <= 0) {
        break;
      }

      lastAvailablePickupDate = candidateDate;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pickup-cap availability check failed.";
    console.error("[api/pickup-cap] Pickup-cap availability request failed.", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  if (!lastAvailablePickupDate) {
    return NextResponse.json({ ok: true, capped: true, maxPickupDate: "", maxDaysAllowed: 0 });
  }

  if (lastAvailablePickupDate >= pricingMaxPickupDate) {
    return NextResponse.json({ ok: true, capped: false });
  }

  const maxPickupDate = lastAvailablePickupDate;
  const maxDaysAllowed =
    Math.max(0, Math.round((Date.parse(maxPickupDate) - Date.parse(deliveryDate)) / 86400000));
  const maxBookablePickupDate = getMaximumBookablePickupDate(deliveryDate, rentalPolicy, maxPickupDate);

  return NextResponse.json({
    ok: true,
    capped: true,
    maxPickupDate,
    maxDaysAllowed,
    maxBookablePickupDate,
  });
}
