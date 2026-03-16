// src/app/api/availability/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = (searchParams.get("date") || "").trim(); // YYYY-MM-DD

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "Invalid date" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("get_delivery_availability", {
    p_delivery_date: date,
    p_days: 7,
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