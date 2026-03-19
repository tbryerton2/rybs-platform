import { NextResponse } from "next/server";
import { isBookingSchemaError } from "@/lib/booking-schema";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { attachCustomerToBooking, normalizePhone } from "@/lib/customers";
import { sanitizePlacementDetails, validatePlacementDetails } from "@/lib/placement";
import { attachReorderReference } from "@/lib/reorder";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const bookingId = searchParams.get("bookingId") || searchParams.get("id");

    if (!bookingId) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, status, total_price_cents, customer_name, customer_email, customer_phone, customer_street, customer_city, customer_zip, delivery_date, pickup_mode, pickup_date, service_town, service_county"
      )
      .eq("id", bookingId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "Not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, booking: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      customer_name,
      customer_email, // ✅ add
      customer_phone,
      customer_street,
      customer_city,
      customer_zip,
      placement_preference,
      placement_details,
      access_issues,
      gate_instructions,
      delivery_presence,
      alternate_contact_name,
      alternate_contact_phone,
      placement_photo_url,
      special_delivery_instructions,
      reordered_from_booking_id,
      delivery_date,
      pickup_mode,
      pickup_date,
      total_price_cents,
      service_county,
      service_town,
    } = body;

    // Minimal required fields for v1
    if (!customer_name || !customer_street || !customer_city || !customer_zip || !delivery_date) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const normalizedCustomerPhone = normalizePhone(customer_phone);
    const placement = sanitizePlacementDetails({
      placementPreference: placement_preference,
      placementDetails: placement_details,
      accessIssues: access_issues,
      gateInstructions: gate_instructions,
      deliveryPresence: delivery_presence,
      alternateContactName: alternate_contact_name,
      alternateContactPhone: alternate_contact_phone,
      placementPhotoUrl: placement_photo_url,
      specialDeliveryInstructions: special_delivery_instructions,
    });
    const placementError = validatePlacementDetails(placement);

    if (placementError) {
      return NextResponse.json({ ok: false, error: placementError }, { status: 400 });
    }

    const baseInsertRow = {
      customer_name,
      customer_email: customer_email ?? null,
      customer_phone: normalizedCustomerPhone,
      customer_street,
      customer_city,
      customer_zip,
      delivery_date,
      pickup_mode: pickup_mode ?? "request",
      pickup_date: pickup_date ?? null,
      status: "confirmed" as const,
      total_price_cents: total_price_cents ?? null,
      service_county: service_county ?? null,
      service_town: service_town ?? null,
    };

    const insertWithPlacementRow = {
      ...baseInsertRow,
      placement_preference: placement.placementPreference,
      placement_details: placement.placementDetails,
      access_issues: placement.accessIssues,
      gate_instructions: placement.gateInstructions,
      delivery_presence: placement.deliveryPresence,
      alternate_contact_name: placement.alternateContactName,
      alternate_contact_phone: placement.alternateContactPhone,
      placement_photo_url: placement.placementPhotoUrl,
      special_delivery_instructions: placement.specialDeliveryInstructions,
    };

    let placementPersistenceSkipped = false;

    let insertResult = await supabaseAdmin.from("bookings").insert(insertWithPlacementRow).select("id").single();

    if (insertResult.error && isBookingSchemaError(insertResult.error)) {
      placementPersistenceSkipped = true;
      console.warn("placement fields unavailable on bookings; retrying /api/bookings without placement columns");
      insertResult = await supabaseAdmin.from("bookings").insert(baseInsertRow).select("id").single();
    }

    const { data, error } = insertResult;

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, details: error.details },
        { status: 400 }
      );
    }

    try {
      await attachCustomerToBooking(data.id, {
        fullName: customer_name,
        email: customer_email,
        phone: normalizedCustomerPhone,
        street: customer_street,
        city: customer_city,
        zip: customer_zip,
      }, supabaseAdmin);
    } catch (customerLinkError) {
      console.error("customer linkage failed for /api/bookings:", customerLinkError);
    }

    let reorderReferenceSkipped = false;

    try {
      const reorderReferenceResult = await attachReorderReference(
        supabaseAdmin,
        data.id,
        reordered_from_booking_id,
      );
      reorderReferenceSkipped = reorderReferenceResult.skipped;
    } catch (reorderReferenceError) {
      console.error("reorder reference write failed for /api/bookings:", reorderReferenceError);
    }

    return NextResponse.json({
      ok: true,
      id: data.id,
      placementPersistenceSkipped,
      reorderReferenceSkipped,
      warning: placementPersistenceSkipped
        ? "Placement details were collected but could not be persisted because this database is missing the placement columns."
        : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
