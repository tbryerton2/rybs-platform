import { NextResponse } from "next/server";
import { getDeliveryAvailabilitySnapshot } from "@/lib/booking-availability";
import { getRentalPeriodDetails } from "@/lib/booking-pricing";
import { createBookingRecord } from "@/lib/booking-records";
import { resolveSelectedDumpster } from "@/lib/booking-product";
import { getDumpsterRentalPolicy } from "@/lib/dumpster-rental-policy";
import { ensureRentalWindowAvailability } from "@/lib/ensure-rental-window-availability";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidEmail } from "@/lib/identity";
import { normalizePhone } from "@/lib/customers";
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
        "id, status, total_price_cents, customer_name, customer_email, customer_phone, customer_street, customer_city, customer_state, customer_zip, delivery_date, pickup_mode, pickup_date, service_town, service_county",
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
      customer_state,
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
      dumpster_size,
      dumpster_product_id,
    } = body;
    const selectedDumpster = resolveSelectedDumpster({
      dumpsterSize: dumpster_size,
      dumpsterProductId: dumpster_product_id,
    });

    // Minimal required fields for v1
    if (!customer_name || !customer_street || !customer_city || !customer_zip || !delivery_date) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }
    if (!customer_email || !isValidEmail(customer_email)) {
      return NextResponse.json({ ok: false, error: "A valid email address is required." }, { status: 400 });
    }
    if (customer_state && !/^[A-Za-z]{2}$/.test(String(customer_state).trim())) {
      return NextResponse.json({ ok: false, error: "A valid 2-letter customer_state is required." }, { status: 400 });
    }

    const rentalPolicy = await getDumpsterRentalPolicy(selectedDumpster);
    const pickupModeForAvailability = pickup_mode === "schedule" ? "date" : "unspecified";
    const rentalPeriod = getRentalPeriodDetails({
      deliveryDate: delivery_date ?? null,
      pickupDate: pickup_date ?? null,
      pickupMode: pickupModeForAvailability,
      standardRentalDays: rentalPolicy.standardRentalDays,
      dailyOveragePrice: rentalPolicy.dailyOveragePrice,
      maxRentalDays: rentalPolicy.maxRentalDays,
      allowExtendedRentalAtBooking: rentalPolicy.allowExtendedRentalAtBooking,
    });

    if (delivery_date && (rentalPeriod.validationError || !rentalPeriod.effectivePickupDate)) {
      return NextResponse.json(
        { ok: false, error: rentalPeriod.validationError || "Invalid rental period." },
        { status: 400 },
      );
    }

    if (delivery_date && rentalPeriod.effectivePickupDate) {
      try {
        await ensureRentalWindowAvailability({
          check: () =>
            getDeliveryAvailabilitySnapshot({
              deliveryDate: delivery_date,
              rpcDays: rentalPeriod.bookedRentalDays ?? rentalPolicy.standardRentalDays,
              dumpsterSize: selectedDumpster.dumpsterSize,
              dumpsterProductId: selectedDumpster.dumpsterProductId,
              pickupDate: rentalPeriod.effectivePickupDate,
              logContext: "api/bookings",
            }),
        });
      } catch (availabilityError) {
        return NextResponse.json(
          {
            ok: false,
            error:
              availabilityError instanceof Error
                ? availabilityError.message
                : "That rental window is unavailable.",
          },
          { status: 409 },
        );
      }
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

    let createdBooking;
    try {
      createdBooking = await createBookingRecord({
        supabase: supabaseAdmin,
        booking: {
          delivery_date,
          pickup_mode: pickup_mode ?? "request",
          pickup_date: pickup_date ?? null,
          status: "confirmed",
          total_price_cents: total_price_cents ?? null,
          service_county: service_county ?? null,
          service_town: service_town ?? null,
          dumpster_size: selectedDumpster.dumpsterSize,
          dumpster_product_id: selectedDumpster.dumpsterProductId,
        },
        identity: {
          customerName: customer_name,
          customerEmail: customer_email,
          customerPhone: normalizedCustomerPhone,
          customerStreet: customer_street,
          customerCity: customer_city,
          customerState: customer_state,
          customerZip: customer_zip,
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
        { ok: false, error: error instanceof Error ? error.message : "Booking creation failed." },
        { status: 400 }
      );
    }

    let reorderReferenceSkipped = false;

    try {
      const reorderReferenceResult = await attachReorderReference(
        supabaseAdmin,
        createdBooking.bookingId,
        reordered_from_booking_id,
      );
      reorderReferenceSkipped = reorderReferenceResult.skipped;
    } catch (reorderReferenceError) {
      console.error("reorder reference write failed for /api/bookings:", reorderReferenceError);
    }

    return NextResponse.json({
      ok: true,
      id: createdBooking.bookingId,
      bookingRef: createdBooking.bookingRef,
      placementPersistenceSkipped: createdBooking.placementPersistenceSkipped,
      reorderReferenceSkipped,
      warning: createdBooking.placementPersistenceSkipped
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
