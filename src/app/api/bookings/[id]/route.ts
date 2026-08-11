import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isTenantResolutionError } from "@/lib/tenant/resolution";
import { getCurrentTenant } from "@/lib/tenant/server";

type BookingRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: NextRequest, context: BookingRouteContext) {
  try {
    const { id } = await context.params;
    const tenant = await getCurrentTenant();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing booking id" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("id", id)
      .eq("business_id", tenant.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message || "Booking not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, booking: data });
  } catch (e: unknown) {
    if (isTenantResolutionError(e)) {
      return NextResponse.json(
        { ok: false, error: e.publicMessage },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
