import { NextResponse } from "next/server";
import { getActiveServiceAreaZip, sanitizeServiceAreaZip } from "@/lib/service-area";
import { get14YardPriceForZip } from "@/lib/pricing";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const zip = sanitizeServiceAreaZip(searchParams.get("zip"));
  const deliveryDate = searchParams.get("deliveryDate");
  const pickupDate = searchParams.get("pickupDate");
  const pickupMode = searchParams.get("pickupMode");

  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ ok: false, error: "Invalid ZIP" }, { status: 400 });
  }

  const data = await getActiveServiceAreaZip(zip);
  if (!data) {
    return NextResponse.json({ ok: false, serviced: false });
  }

  const pricing = await get14YardPriceForZip(zip, {
    deliveryDate,
    pickupDate,
    pickupMode: pickupMode === "date" ? "date" : "unspecified",
  });

  return NextResponse.json({
    ok: true,
    serviced: true,
    zip: data.zip,
    county: data.county,
    town: data.town,
    price: pricing.price,
    defaultPrice: pricing.defaultPrice,
    overridePrice: pricing.overridePrice,
    pricingSource: pricing.pricingSource,
    priceQuote: pricing.priceQuote,
  });
}
