// src/app/api/availability/route.ts
import { NextResponse } from "next/server";
import { getDeliveryAvailabilitySnapshot } from "@/lib/booking-availability";
import { getValidActiveHoldExclusionId } from "@/lib/booking-hold-exclusion";
import { resolveSelectedDumpster } from "@/lib/booking-product";
import { getDumpsterRentalPolicy } from "@/lib/dumpster-rental-policy";
import { isTenantResolutionError } from "@/lib/tenant/resolution";
import { getCurrentTenant } from "@/lib/tenant/server";
import {
  getRetailCalendarClosureForDate,
  getRetailSiteSettingsForTenant,
} from "@/lib/tenant/retail-site-settings";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = (searchParams.get("date") || "").trim(); // YYYY-MM-DD
  const rawHoldId = searchParams.get("holdId");
  const holdId = (rawHoldId || "").trim();
  const selectedDumpster = resolveSelectedDumpster({
    dumpsterSize: searchParams.get("dumpsterSize"),
    dumpsterProductId: searchParams.get("dumpsterProductId"),
  });

  if (rawHoldId !== null && !holdId) {
    return NextResponse.json({ ok: false, error: "Invalid holdId" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "Invalid date" }, { status: 400 });
  }

  try {
    const tenant = await getCurrentTenant();
    const retailSiteSettings = await getRetailSiteSettingsForTenant(tenant);
    const rentalPolicy = await getDumpsterRentalPolicy({ ...selectedDumpster, businessId: tenant.id });
    const closure = getRetailCalendarClosureForDate(date, retailSiteSettings);
    if (closure.blocked) {
      return NextResponse.json({
        ok: true,
        capacity: 0,
        used: 0,
        remaining: 0,
        blocked: true,
        label: closure.label,
      });
    }

    const excludeHoldId = holdId
      ? await getValidActiveHoldExclusionId({
          holdId,
          dumpsterSize: selectedDumpster.dumpsterSize,
          dumpsterProductId: selectedDumpster.dumpsterProductId,
          businessId: tenant.id,
        })
      : null;
    const availability = await getDeliveryAvailabilitySnapshot({
      deliveryDate: date,
      rpcDays: rentalPolicy.standardRentalDays,
      dumpsterSize: selectedDumpster.dumpsterSize,
      dumpsterProductId: selectedDumpster.dumpsterProductId,
      pickupDate: null,
      excludeHoldIds: excludeHoldId ? [excludeHoldId] : undefined,
      businessId: tenant.id,
      logContext: "api/availability",
    });

    return NextResponse.json({
      ok: true,
      capacity: availability.capacity,
      used: availability.used,
      remaining: availability.remaining,
      requestedPickupDate: availability.requestedPickupDate,
      blockingRule: availability.blockingRule,
      source: availability.source,
    });
  } catch (error) {
    if (isTenantResolutionError(error)) {
      return NextResponse.json({ ok: false, error: error.publicMessage }, { status: 503 });
    }

    const message = error instanceof Error ? error.message : "Availability check failed.";
    console.error("[api/availability] Delivery availability request failed.", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
