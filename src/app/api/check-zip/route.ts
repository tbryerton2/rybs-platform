import { NextResponse } from "next/server";
import { get14YardPriceForZip } from "@/lib/pricing";
import { isTenantResolutionError } from "@/lib/tenant/resolution";
import { resolvePublicTenantFromRequest } from "@/lib/tenant/server";

export async function POST(req: Request) {
  try {
    const tenant = await resolvePublicTenantFromRequest(req);
    const { zip } = await req.json();

    const result = await get14YardPriceForZip(zip, { businessId: tenant.id });

    return NextResponse.json(result);
  } catch (error) {
    if (isTenantResolutionError(error)) {
      return NextResponse.json({ ok: false, error: error.publicMessage }, { status: 503 });
    }

    throw error;
  }
}
