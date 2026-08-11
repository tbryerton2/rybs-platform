import { NextResponse } from "next/server";
import { resolveSelectedDumpster } from "@/lib/booking-product";
import { getActiveServiceAreaZip, sanitizeServiceAreaZip } from "@/lib/service-area";
import { getDumpsterPriceForZip } from "@/lib/pricing";
import { isTenantResolutionError } from "@/lib/tenant/resolution";
import { resolvePublicTenantFromRequest } from "@/lib/tenant/server";

export async function GET(req: Request) {
  try {
    const tenant = await resolvePublicTenantFromRequest(req);
    const { searchParams } = new URL(req.url);
    const zip = sanitizeServiceAreaZip(searchParams.get("zip"));
    const deliveryDate = searchParams.get("deliveryDate");
    const pickupDate = searchParams.get("pickupDate");
    const pickupMode = searchParams.get("pickupMode");
    const selectedDumpster = resolveSelectedDumpster({
      dumpsterSize: searchParams.get("dumpsterSize"),
      dumpsterProductId: searchParams.get("dumpsterProductId"),
    });

    if (!/^\d{5}$/.test(zip)) {
      return NextResponse.json({ ok: false, error: "Invalid ZIP" }, { status: 400 });
    }

    const data = await getActiveServiceAreaZip(zip, tenant.id);
    if (!data) {
      return NextResponse.json({ ok: false, serviced: false });
    }

    const pricing = await getDumpsterPriceForZip(
      zip,
      selectedDumpster,
      {
        deliveryDate,
        pickupDate,
        pickupMode: pickupMode === "date" ? "date" : "unspecified",
        businessId: tenant.id,
      },
    );

    if (pricing.rentalValidationError) {
      return NextResponse.json(
        {
          ok: false,
          serviced: true,
          zip: data.zip,
          county: data.county,
          town: data.town,
          state: data.state,
          error: pricing.rentalValidationError,
          priceQuote: pricing.priceQuote,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      serviced: true,
      zip: data.zip,
      county: data.county,
      town: data.town,
      state: data.state,
      price: pricing.price,
      defaultPrice: pricing.defaultPrice,
      overridePrice: pricing.overridePrice,
      pricingSource: pricing.pricingSource,
      priceQuote: pricing.priceQuote,
    });
  } catch (error) {
    if (isTenantResolutionError(error)) {
      return NextResponse.json({ ok: false, error: error.publicMessage }, { status: 503 });
    }

    throw error;
  }
}
