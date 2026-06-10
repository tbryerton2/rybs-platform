import { NextResponse } from "next/server";
import { getOptionalPortalCustomer } from "@/lib/portal/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildReorderDraft,
  canReorderBooking,
  type ReorderSourceBookingRow,
} from "@/lib/reorder";

export async function GET(req: Request) {
  try {
    const customer = await getOptionalPortalCustomer();
    if (!customer) {
      return NextResponse.json({ ok: false, error: "Portal login required." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const bookingId = String(searchParams.get("bookingId") ?? "").trim();

    if (!bookingId) {
      return NextResponse.json({ ok: false, error: "Missing bookingId." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, booking_ref, customer_id, customer_first_name, customer_last_name, customer_email, customer_phone, customer_street, customer_city, customer_state, customer_zip, service_county, service_town, status, placement_preference, placement_details, access_issues, gate_instructions, delivery_presence, alternate_contact_name, alternate_contact_phone, placement_photo_url, special_delivery_instructions",
      )
      .eq("id", bookingId)
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, error: "That rental is not available to reorder." },
        { status: 404 },
      );
    }

    const sourceBooking = data as ReorderSourceBookingRow;

    if (!canReorderBooking(sourceBooking.status)) {
      return NextResponse.json(
        { ok: false, error: "That rental is not eligible to book again yet." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      draft: buildReorderDraft(sourceBooking),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to start reorder.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
