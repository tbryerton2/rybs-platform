// src/app/api/availability/route.ts
import { NextResponse } from "next/server";
import { getPooledDumpsterAvailabilityBySize } from "@/lib/admin/dumpster-availability";
import { resolveSelectedDumpster } from "@/lib/booking-product";
import {
  getRetailCalendarClosureForDate,
  getRetailSiteSettings,
} from "@/lib/tenant/retail-site-settings";
import { getPricingSettingsSnapshot } from "@/lib/pricing-settings";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = (searchParams.get("date") || "").trim(); // YYYY-MM-DD
  const selectedDumpster = resolveSelectedDumpster({
    dumpsterSize: searchParams.get("dumpsterSize"),
    dumpsterProductId: searchParams.get("dumpsterProductId"),
  });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "Invalid date" }, { status: 400 });
  }

  const retailSiteSettings = await getRetailSiteSettings();
  const pricingSettings = await getPricingSettingsSnapshot();
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

  try {
    const pooled = await getPooledDumpsterAvailabilityBySize({
      dumpsterSize: selectedDumpster.dumpsterSize,
      dumpsterProductId: selectedDumpster.dumpsterProductId,
      deliveryDate: date,
      pickupDate: null,
    });

    return NextResponse.json({
      ok: true,
      capacity: pooled.totalBookable,
      used: pooled.reservedOrInUse,
      remaining: pooled.available,
    });
  } catch (pooledError) {
    // Legacy RPC fallback stays in place so availability checks keep working
    // if the new pooled inventory path hits bad data or a transient query issue.
    console.error("Pooled availability helper failed, falling back to legacy RPC.", pooledError);
  }

  const { data, error } = await supabase.rpc("get_delivery_availability", {
    p_delivery_date: date,
    p_days: pricingSettings.standardRentalDays,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const row = data?.[0];
  if (!row) {
    return NextResponse.json(
      { ok: false, error: "Availability function returned no rows." },
      { status: 500 }
    );
  }

  const capacity = Number(row.capacity ?? 0);
  const used = Number(row.used ?? 0);
  const remaining = Math.max(0, Number(row.remaining ?? capacity - used));

  return NextResponse.json({ ok: true, capacity, used, remaining });
}
