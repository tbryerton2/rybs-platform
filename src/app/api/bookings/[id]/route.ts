import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type BookingRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: NextRequest, context: BookingRouteContext) {
  try {
    const { id } = await context.params;

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
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message || "Booking not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, booking: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}