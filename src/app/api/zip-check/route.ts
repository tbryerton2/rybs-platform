import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const zip = (searchParams.get("zip") || "").trim();

  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ ok: false, error: "Invalid ZIP" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("service_area_zips")
    .select("zip, county, town, active")
    .eq("zip", zip)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, serviced: false });
  }

  return NextResponse.json({
    ok: true,
    serviced: true,
    zip: data.zip,
    county: data.county,
    town: data.town,
  });
}