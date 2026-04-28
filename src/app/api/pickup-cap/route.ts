import { NextResponse } from "next/server";
import { getPooledDumpsterAvailabilityBySize } from "@/lib/admin/dumpster-availability";
import { resolveSelectedDumpster } from "@/lib/booking-product";
import { getPricingSettingsSnapshot } from "@/lib/pricing-settings";
import { supabase } from "@/lib/supabase";
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

  const pricingSettings = await getPricingSettingsSnapshot();
  const defaultEnd = addDaysYmd(deliveryDate, pricingSettings.standardRentalDays);
  let nextTight: string | null = null;

  try {
    for (let candidateDate = deliveryDate; candidateDate <= defaultEnd; candidateDate = addDaysYmd(candidateDate, 1)) {
      const pooled = await getPooledDumpsterAvailabilityBySize({
        dumpsterSize: selectedDumpster.dumpsterSize,
        dumpsterProductId: selectedDumpster.dumpsterProductId,
        deliveryDate: candidateDate,
        pickupDate: null,
      });

      if (pooled.available <= 0) {
        nextTight = candidateDate;
        break;
      }
    }
  } catch (pooledError) {
    // Legacy RPC fallback remains here so pickup-date capping still works if the
    // pooled inventory helper fails for any candidate date in the window.
    console.error("Pickup-cap pooled availability failed, falling back to legacy RPC.", pooledError);

    const { data, error } = await supabase.rpc("next_tight_date", { start_date: deliveryDate });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    nextTight = (data as string | null) || null;
  }

  // Not tight within default window -> not capped
  if (!nextTight || nextTight > defaultEnd) {
    return NextResponse.json({ ok: true, capped: false });
  }

  const maxPickupDate = nextTight; // same-day flip allowed
  const maxDaysAllowed =
    Math.max(0, Math.round((Date.parse(maxPickupDate) - Date.parse(deliveryDate)) / 86400000));
  const maxBookablePickupDate = getMaximumBookablePickupDate(deliveryDate, pricingSettings, maxPickupDate);

  return NextResponse.json({
    ok: true,
    capped: true,
    maxPickupDate,
    maxDaysAllowed,
    maxBookablePickupDate,
  });
}
