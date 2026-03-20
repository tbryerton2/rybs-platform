// src/app/api/confirm-booking/route.ts
import { NextResponse } from "next/server";
import { isBookingSchemaError } from "@/lib/booking-schema";
import { supabase } from "@/lib/supabase";
import { getDefaultRentalDays } from "@/lib/config";
import { attachCustomerToBooking, normalizePhone } from "@/lib/customers";
import { sanitizePlacementDetails, validatePlacementDetails } from "@/lib/placement";
import { attachReorderReference } from "@/lib/reorder";
import { supabaseServer } from "@/lib/supabase/server";

type ConfirmBody = {
  holdId?: string;
  totalPriceCents?: number;
  totalDollars?: number;
  bookingDraft?: {
    deliveryDate?: string;
    pickupDate?: string;
    pickupMode?: "unspecified" | "date";
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerStreet?: string;
    customerCity?: string;
    customerZip?: string;
    placementPreference?: string | null;
    placementDetails?: string | null;
    accessIssues?: string[];
    gateInstructions?: string | null;
    deliveryPresence?: string | null;
    alternateContactName?: string | null;
    alternateContactPhone?: string | null;
    placementPhotoUrl?: string | null;
    specialDeliveryInstructions?: string | null;
    reorderSourceBookingId?: string | null;
  };

  // keep backward-compatible flat fields too
  deliveryDate?: string;
  pickupDate?: string;
  pickupMode?: "unspecified" | "date";
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerStreet?: string;
  customerCity?: string;
  customerZip?: string;
  placementPreference?: string | null;
  placementDetails?: string | null;
  accessIssues?: string[];
  gateInstructions?: string | null;
  deliveryPresence?: string | null;
  alternateContactName?: string | null;
  alternateContactPhone?: string | null;
  placementPhotoUrl?: string | null;
  specialDeliveryInstructions?: string | null;
  reorderSourceBookingId?: string | null;
};

function isYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test((s || "").trim());
}

function addDaysYMD(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message:
      "POST with either { holdId, bookingDraft: { deliveryDate, pickupDate?, pickupMode?, customerName, customerEmail, customerPhone?, customerStreet, customerCity, customerZip } } or the flat fields { holdId, deliveryDate, pickupDate?, pickupMode?, customerName, customerEmail, customerPhone?, customerStreet, customerCity, customerZip }",
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as ConfirmBody;

    const holdId = (body.holdId || "").trim();
    const draft = body.bookingDraft || {};
    const totalPriceCents = Number(body.totalPriceCents);
    const fallbackTotalDollars = Number(body.totalDollars);
    const normalizedTotalPriceCents =
      Number.isFinite(totalPriceCents) && totalPriceCents > 0
        ? Math.round(totalPriceCents)
        : Number.isFinite(fallbackTotalDollars) && fallbackTotalDollars > 0
        ? Math.round(fallbackTotalDollars * 100)
        : null;

    if (normalizedTotalPriceCents == null) {
      return NextResponse.json({ ok: false, error: "Missing/invalid totalPriceCents." }, { status: 400 });
    }

    const deliveryDate = ((draft.deliveryDate ?? body.deliveryDate) || "").trim();
    const pickupDate = ((draft.pickupDate ?? body.pickupDate) || "").trim();

    const customerName = ((draft.customerName ?? body.customerName) || "").trim();
    const customerEmail = ((draft.customerEmail ?? body.customerEmail) || "").trim();
    const customerPhone = normalizePhone(draft.customerPhone ?? body.customerPhone);
    const customerStreet = ((draft.customerStreet ?? body.customerStreet) || "").trim();
    const customerCity = ((draft.customerCity ?? body.customerCity) || "").trim();
    const customerZip = ((draft.customerZip ?? body.customerZip) || "").trim();
    const reorderSourceBookingId = ((draft.reorderSourceBookingId ?? body.reorderSourceBookingId) || "").trim();
    const placement = sanitizePlacementDetails({
      placementPreference: draft.placementPreference ?? body.placementPreference ?? null,
      placementDetails: draft.placementDetails ?? body.placementDetails ?? null,
      accessIssues: draft.accessIssues ?? body.accessIssues ?? [],
      gateInstructions: draft.gateInstructions ?? body.gateInstructions ?? null,
      deliveryPresence: draft.deliveryPresence ?? body.deliveryPresence ?? null,
      alternateContactName: draft.alternateContactName ?? body.alternateContactName ?? null,
      alternateContactPhone: draft.alternateContactPhone ?? body.alternateContactPhone ?? null,
      placementPhotoUrl: draft.placementPhotoUrl ?? body.placementPhotoUrl ?? null,
      specialDeliveryInstructions:
        draft.specialDeliveryInstructions ?? body.specialDeliveryInstructions ?? null,
    });
    const placementError = validatePlacementDetails(placement);

    if (!holdId) {
      return NextResponse.json({ ok: false, error: "Missing holdId." }, { status: 400 });
    }

    if (!isYMD(deliveryDate)) {
      return NextResponse.json(
        { ok: false, error: "Invalid deliveryDate. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    if (pickupDate && !isYMD(pickupDate)) {
      return NextResponse.json(
        { ok: false, error: "Invalid pickupDate. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    if (placementError) {
      return NextResponse.json({ ok: false, error: placementError }, { status: 400 });
    }

    // 1) Atomically "claim" the hold so two requests can't confirm the same hold
    const claim = await supabase
      .from("booking_holds")
      .update({ status: "converting" })
      .eq("id", holdId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .select("id, delivery_date, expires_at")
      .maybeSingle();

    if (claim.error) {
      return NextResponse.json({ ok: false, error: claim.error.message }, { status: 500 });
    }

    if (!claim.data) {
      return NextResponse.json(
        { ok: false, error: "Hold is not active (expired or already used). Please choose a new date." },
        { status: 409 }
      );
    }

    // 1.5) SERVER GUARD: prevent bookings that run into a tight date (capacity hit)
    // If pickupDate isn't provided, assume default rental length.
    const defaultRentalDays = getDefaultRentalDays();
    const effectivePickup = pickupDate || addDaysYMD(deliveryDate, defaultRentalDays);

    // Find the earliest day offset where availability drops to 0 within a reasonable horizon.
    // (30 is arbitrary safety; feel free to change.)
    let capPickupDate: string | null = null;

    for (let days = 1; days <= 30; days++) {
      const avail = await supabase.rpc("get_delivery_availability", {
        p_delivery_date: deliveryDate,
        p_days: days,
      });

      if (avail.error) {
        // revert hold (best effort) since we already claimed it
        await supabase
          .from("booking_holds")
          .update({ status: "active" })
          .eq("id", holdId)
          .eq("status", "converting");

        return NextResponse.json({ ok: false, error: avail.error.message }, { status: 500 });
      }

      const row = avail.data?.[0];
      if (!row) continue;

      const capacity = Number(row.capacity ?? 3);
      const used = Number(row.used ?? 0);
      const remaining = Math.max(0, capacity - used);

      if (remaining <= 0) {
        capPickupDate = addDaysYMD(deliveryDate, days);
        break;
      }
    }

    // If there is a cap and the booking pickup runs past it -> reject
    if (capPickupDate && effectivePickup > capPickupDate) {
      // revert hold (best effort) since we already claimed it
      await supabase
        .from("booking_holds")
        .update({ status: "active" })
        .eq("id", holdId)
        .eq("status", "converting");

      return NextResponse.json(
        {
          ok: false,
          error: `That pickup date is too late. Pickup must be on or before ${capPickupDate}.`,
          maxPickupDate: capPickupDate,
        },
        { status: 409 }
      );
    }

    // 2) Create booking row (confirmed)
    // IMPORTANT: don't write pickup_mode yet (it is failing your DB check constraint)
    const baseInsertRow = {
      delivery_date: deliveryDate,
      pickup_date: effectivePickup || null,
      status: "confirmed" as const,
      total_price_cents: normalizedTotalPriceCents,
      customer_name: customerName || null,
      customer_email: customerEmail || null,
      customer_phone: customerPhone,
      customer_street: customerStreet || null,
      customer_city: customerCity || null,
      customer_zip: customerZip || null,
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

    let insertBooking = await supabase.from("bookings").insert(insertWithPlacementRow).select("id").single();

    if (insertBooking.error && isBookingSchemaError(insertBooking.error)) {
      placementPersistenceSkipped = true;
      console.warn("placement fields unavailable on bookings; retrying confirm-booking without placement columns");
      insertBooking = await supabase.from("bookings").insert(baseInsertRow).select("id").single();
    }


    if (insertBooking.error) {
      // If booking insert fails, try to revert hold back to active (best-effort)
      await supabase
        .from("booking_holds")
        .update({ status: "active" })
        .eq("id", holdId)
        .eq("status", "converting");

      return NextResponse.json(
        { ok: false, error: insertBooking.error.message || "Booking creation failed." },
        { status: 500 }
      );
    }

    const serverSupabase = supabaseServer();

    try {
      await attachCustomerToBooking(
        insertBooking.data.id,
        {
          fullName: customerName,
          email: customerEmail,
          phone: customerPhone,
          street: customerStreet,
          city: customerCity,
          zip: customerZip,
        },
        serverSupabase,
      );
    } catch (customerLinkError) {
      console.error("customer linkage failed after confirm-booking:", customerLinkError);
    }

    let reorderReferenceSkipped = false;
    let reorderReferencePersisted = false;

    try {
      const reorderReferenceResult = await attachReorderReference(
        serverSupabase,
        insertBooking.data.id,
        reorderSourceBookingId,
      );
      reorderReferenceSkipped = reorderReferenceResult.skipped;

      console.info("[confirm-booking] reorder reference attempt", {
        incomingReorderSourceBookingId: reorderSourceBookingId || null,
        insertedBookingId: insertBooking.data.id,
        clientType: "service_role",
        result: reorderReferenceResult,
      });
    } catch (reorderReferenceError) {
      console.error("reorder reference write failed after confirm-booking:", reorderReferenceError);
    }

    let persistedReorderReference: string | null = null;

    try {
      const verification = await serverSupabase
        .from("bookings")
        .select("id, reordered_from_booking_id")
        .eq("id", insertBooking.data.id)
        .maybeSingle();

      if (verification.error) {
        console.error("[confirm-booking] reorder reference verification failed:", verification.error);
      } else {
        persistedReorderReference = verification.data?.reordered_from_booking_id ?? null;
        reorderReferencePersisted = !!persistedReorderReference;

        console.info("[confirm-booking] reorder reference verification", {
          incomingReorderSourceBookingId: reorderSourceBookingId || null,
          insertedBookingId: insertBooking.data.id,
          persistedReorderedFromBookingId: persistedReorderReference,
        });
      }
    } catch (verificationError) {
      console.error("[confirm-booking] reorder reference verification threw:", verificationError);
    }

    const ev = await supabase.from("booking_events").insert({
      booking_id: insertBooking.data.id,
      type: "status_change",
      old_status: "pending",
      new_status: "confirmed",
      note: `Hold ${holdId} converted`,
    });

    if (ev.error) console.error("booking_events insert failed:", ev.error);

    const msg = await supabase.from("booking_messages").insert({
      booking_id: insertBooking.data.id,
      channel: "email",
      direction: "outbound",
      template: "booking_confirmed",
      to: customerEmail || null,
      subject: "Your dumpster rental is confirmed",
      body: `Booking confirmed for ${deliveryDate}. Booking ID: ${insertBooking.data.id}`,
      provider: "resend",
      status: "queued",
    }).select("id").single();

    if (msg.error) console.error("booking_messages insert failed:", msg.error);

    // 3) Mark hold as converted (best-effort)
    const finalize = await supabase
      .from("booking_holds")
      .update({ status: "converted" })
      .eq("id", holdId)
      .eq("status", "converting");

    if (finalize.error) {
      return NextResponse.json(
        {
          ok: true,
          bookingId: insertBooking.data.id,
          warning: "Booking created, but hold status failed to finalize.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ok: true,
      bookingId: insertBooking.data.id,
      placementPersistenceSkipped,
      reorderReferenceSkipped,
      reorderReferencePersisted,
      warning: placementPersistenceSkipped
        ? "Placement details were collected but could not be persisted because this database is missing the placement columns."
        : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Confirm failed.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
