import { NextResponse } from "next/server";
import { getPricingSettingsSnapshot } from "@/lib/pricing-settings";
import { supabase } from "@/lib/supabase";

function isYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test((s || "").trim());
}

function addDaysYMD(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const deliveryDate = (url.searchParams.get("deliveryDate") || "").trim();

  if (!isYMD(deliveryDate)) {
    return NextResponse.json({ ok: false, error: "Invalid deliveryDate" }, { status: 400 });
  }

  const pricingSettings = await getPricingSettingsSnapshot();
  const defaultEnd = addDaysYMD(deliveryDate, pricingSettings.includedRentalDays);

  // Find earliest tight date >= deliveryDate where used >= 3
  const { data, error } = await supabase.rpc("next_tight_date", { start_date: deliveryDate });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const nextTight = (data as string | null) || null;

  // Not tight within default window -> not capped
  if (!nextTight || nextTight > defaultEnd) {
    return NextResponse.json({ ok: true, capped: false });
  }

  const maxPickupDate = nextTight; // same-day flip allowed
  const maxDaysAllowed =
    Math.max(0, Math.round((Date.parse(maxPickupDate) - Date.parse(deliveryDate)) / 86400000));

  return NextResponse.json({
    ok: true,
    capped: true,
    maxPickupDate,
    maxDaysAllowed,
  });
}
