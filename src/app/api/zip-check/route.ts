import { NextResponse } from "next/server";
import { getActiveServiceAreaZip, sanitizeServiceAreaZip } from "@/lib/service-area";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const zip = sanitizeServiceAreaZip(searchParams.get("zip"));

  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ ok: false, error: "Invalid ZIP" }, { status: 400 });
  }

  const data = await getActiveServiceAreaZip(zip);
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
