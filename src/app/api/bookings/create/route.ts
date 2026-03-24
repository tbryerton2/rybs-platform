import { NextResponse } from "next/server";
import { createBookingRecord } from "@/lib/booking-records";
import { isValidEmail } from "@/lib/identity";
import { supabaseServer } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/customers";
import { sanitizePlacementDetails, validatePlacementDetails } from "@/lib/placement";
import { attachReorderReference } from "@/lib/reorder";

type Payload = {
  customer_name: string;
  customer_street: string;
  customer_city?: string;
  customer_state?: string;
  customer_zip: string;

  service_county?: string;
  service_town?: string;

  delivery_date?: string; // YYYY-MM-DD
  pickup_mode?: "request" | "schedule";
  pickup_date?: string | null; // YYYY-MM-DD or null

  total_price_cents?: number;
  customer_phone?: string;
  customer_email?: string;
  placement_preference?: string | null;
  placement_details?: string | null;
  access_issues?: string[];
  gate_instructions?: string | null;
  delivery_presence?: string | null;
  alternate_contact_name?: string | null;
  alternate_contact_phone?: string | null;
  placement_photo_url?: string | null;
  special_delivery_instructions?: string | null;
  reordered_from_booking_id?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;

    // Minimal required fields for v1 draft
    if (!body.customer_name?.trim()) {
      return NextResponse.json({ ok: false, error: "Missing customer_name" }, { status: 400 });
    }
    if (!body.customer_street?.trim()) {
      return NextResponse.json({ ok: false, error: "Missing customer_street" }, { status: 400 });
    }
    if (!/^\d{5}$/.test(body.customer_zip ?? "")) {
      return NextResponse.json({ ok: false, error: "Invalid customer_zip" }, { status: 400 });
    }
    if (body.customer_state && !/^[A-Za-z]{2}$/.test(body.customer_state.trim())) {
      return NextResponse.json({ ok: false, error: "Invalid customer_state" }, { status: 400 });
    }
    if (!body.customer_email?.trim() || !isValidEmail(body.customer_email)) {
      return NextResponse.json({ ok: false, error: "A valid customer_email is required" }, { status: 400 });
    }

    const supabase = supabaseServer();
    const customerPhone = normalizePhone(body.customer_phone);
    const placement = sanitizePlacementDetails({
      placementPreference: body.placement_preference,
      placementDetails: body.placement_details,
      accessIssues: body.access_issues,
      gateInstructions: body.gate_instructions,
      deliveryPresence: body.delivery_presence,
      alternateContactName: body.alternate_contact_name,
      alternateContactPhone: body.alternate_contact_phone,
      placementPhotoUrl: body.placement_photo_url,
      specialDeliveryInstructions: body.special_delivery_instructions,
    });
    const placementError = validatePlacementDetails(placement);

    if (placementError) {
      return NextResponse.json({ ok: false, error: placementError }, { status: 400 });
    }

    let createdBooking;
    try {
      createdBooking = await createBookingRecord({
        supabase,
        booking: {
          delivery_date: body.delivery_date ?? null,
          pickup_mode: body.pickup_mode ?? "request",
          pickup_date: body.pickup_date ?? null,
          status: "draft",
          total_price_cents: typeof body.total_price_cents === "number" ? body.total_price_cents : null,
          service_county: body.service_county?.trim() ?? null,
          service_town: body.service_town?.trim() ?? null,
        },
        identity: {
          customerName: body.customer_name.trim(),
          customerEmail: body.customer_email?.trim() ?? null,
          customerPhone: customerPhone,
          customerStreet: body.customer_street.trim(),
          customerCity: body.customer_city?.trim() ?? null,
          customerState: body.customer_state?.trim().toUpperCase() ?? null,
          customerZip: body.customer_zip,
        },
        placement: {
          placement_preference: placement.placementPreference,
          placement_details: placement.placementDetails,
          access_issues: placement.accessIssues,
          gate_instructions: placement.gateInstructions,
          delivery_presence: placement.deliveryPresence,
          alternate_contact_name: placement.alternateContactName,
          alternate_contact_phone: placement.alternateContactPhone,
          placement_photo_url: placement.placementPhotoUrl,
          special_delivery_instructions: placement.specialDeliveryInstructions,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : "Booking creation failed" },
        { status: 500 }
      );
    }

    let reorderReferenceSkipped = false;

    try {
      const reorderReferenceResult = await attachReorderReference(
        supabase,
        createdBooking.bookingId,
        body.reordered_from_booking_id,
      );
      reorderReferenceSkipped = reorderReferenceResult.skipped;
    } catch (reorderReferenceError) {
      console.error("reorder reference write failed for /api/bookings/create:", reorderReferenceError);
    }

    return NextResponse.json({
      ok: true,
      booking_id: createdBooking.bookingId,
      booking_ref: createdBooking.bookingRef,
      placementPersistenceSkipped: createdBooking.placementPersistenceSkipped,
      reorderReferenceSkipped,
      warning: createdBooking.placementPersistenceSkipped
        ? "Placement details were collected but could not be persisted because this database is missing the placement columns."
        : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
