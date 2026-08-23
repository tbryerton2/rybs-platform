import { NextResponse } from "next/server";
import { getActiveServiceAreaZip, sanitizeServiceAreaZip } from "@/lib/service-area";
import { isTenantResolutionError } from "@/lib/tenant/resolution";
import { resolvePublicTenantFromRequest } from "@/lib/tenant/server";

export async function POST(req: Request) {
  try {
    const tenant = await resolvePublicTenantFromRequest(req);
    const { zip } = await req.json();
    const sanitizedZip = sanitizeServiceAreaZip(zip);

    if (!/^\d{5}$/.test(sanitizedZip)) {
      return NextResponse.json({ ok: false, error: "Invalid ZIP" }, { status: 400 });
    }

    const serviceArea = await getActiveServiceAreaZip(sanitizedZip, tenant.id);

    if (!serviceArea) {
      return NextResponse.json({
        ok: true,
        serviceable: false,
        serviced: false,
        zip: sanitizedZip,
      });
    }

    return NextResponse.json({
      ok: true,
      serviceable: true,
      serviced: true,
      zip: serviceArea.zip,
      county: serviceArea.county,
      town: serviceArea.town,
      state: serviceArea.state,
    });
  } catch (error) {
    if (isTenantResolutionError(error)) {
      return NextResponse.json({ ok: false, error: error.publicMessage }, { status: 503 });
    }

    throw error;
  }
}
