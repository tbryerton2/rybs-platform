import { NextResponse } from "next/server";
import { getSquareCheckoutConfigurationForBusiness } from "@/lib/payments/tenant-payment-provider-connections";
import { isTenantResolutionError } from "@/lib/tenant/resolution";
import { resolvePublicTenantFromRequest } from "@/lib/tenant/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const tenant = await resolvePublicTenantFromRequest(req);
    const config = await getSquareCheckoutConfigurationForBusiness({
      businessId: tenant.id,
    });

    return NextResponse.json({ ok: true, ...config });
  } catch (error) {
    if (isTenantResolutionError(error)) {
      return NextResponse.json({ ok: false, error: error.publicMessage }, { status: 503 });
    }

    console.error("[square-checkout-config] failed to resolve Square checkout config", error);
    return NextResponse.json(
      { ok: false, error: "Square checkout is unavailable." },
      { status: 500 },
    );
  }
}
