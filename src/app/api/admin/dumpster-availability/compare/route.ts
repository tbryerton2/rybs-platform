import { NextResponse } from "next/server";
import { requireAdminOwnerForApi } from "@/lib/admin/auth";
import { compareLegacyRpcToPooledDumpsterAvailability } from "@/lib/admin/dumpster-availability-comparison";

export async function GET(req: Request) {
  try {
    const adminAuth = await requireAdminOwnerForApi();
    if (!adminAuth.ok) return adminAuth.response;

    const { searchParams } = new URL(req.url);
    const dumpsterSize = (searchParams.get("dumpsterSize") || searchParams.get("size") || "").trim();
    const dumpsterProductId = (searchParams.get("dumpsterProductId") || searchParams.get("productId") || "").trim();
    const deliveryDate = (searchParams.get("deliveryDate") || "").trim();
    const pickupDate = (searchParams.get("pickupDate") || "").trim();

    if (!dumpsterSize) {
      return NextResponse.json({ ok: false, error: "dumpsterSize is required." }, { status: 400 });
    }

    if (!deliveryDate) {
      return NextResponse.json({ ok: false, error: "deliveryDate is required." }, { status: 400 });
    }

    const comparison = await compareLegacyRpcToPooledDumpsterAvailability({
      dumpsterSize,
      dumpsterProductId: dumpsterProductId || null,
      deliveryDate,
      pickupDate: pickupDate || null,
      businessId: adminAuth.session.business.id,
    });

    return NextResponse.json({
      ok: true,
      comparison,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Availability comparison failed.",
      },
      { status: 500 },
    );
  }
}
