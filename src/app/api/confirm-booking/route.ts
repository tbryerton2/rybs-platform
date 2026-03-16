// src/app/api/confirm-booking/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getDefaultRentalDays } from "@/lib/config";

type ConfirmBody = {
  holdId?: string;
  totalDollars?: number;
  // NEW: support current checkout payload
  bookingDraft?: {
    deliveryDate?: string;
    pickupDate?: string;
    pickupMode?: "unspecified" | "date";
    customerName?: string;
    customerEmail?: string;
    customerStreet?: string;
    customerCity?: string;
    customerZip?: string;
  };

  // keep backward-compatible flat fields too
  deliveryDate?: string;
  pickupDate?: string;
  pickupMode?: "unspecified" | "date";
  customerName?: string;
  customerEmail?: string;
  customerStreet?: string;
  customerCity?: string;
  customerZip?: string;
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
      "POST with either { holdId, bookingDraft: { deliveryDate, pickupDate?, pickupMode?, customerName, customerEmail, customerStreet, customerCity, customerZip } } or the flat fields { holdId, deliveryDate, pickupDate?, pickupMode?, customerName, customerEmail, customerStreet, customerCity, customerZip }",
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as ConfirmBody;

    const holdId = (body.holdId || "").trim();
    const draft = body.bookingDraft || {};
    const totalDollars = Number(body.totalDollars);
    if (!Number.isFinite(totalDollars) || totalDollars <= 0) {
      return NextResponse.json({ ok: false, error: "Missing/invalid totalDollars." }, { status: 400 });
    }

    const deliveryDate = ((draft.deliveryDate ?? body.deliveryDate) || "").trim();
    const pickupDate = ((draft.pickupDate ?? body.pickupDate) || "").trim();

    const customerName = ((draft.customerName ?? body.customerName) || "").trim();
    const customerEmail = ((draft.customerEmail ?? body.customerEmail) || "").trim();
    const customerStreet = ((draft.customerStreet ?? body.customerStreet) || "").trim();
    const customerCity = ((draft.customerCity ?? body.customerCity) || "").trim();
    const customerZip = ((draft.customerZip ?? body.customerZip) || "").trim();

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
    const insertBooking = await supabase
      .from("bookings")
      .insert({
        delivery_date: deliveryDate,
        pickup_date: effectivePickup || null,
        status: "confirmed",
        total_price_cents: totalDollars,
        customer_name: customerName || null,
        customer_email: customerEmail || null,
        customer_street: customerStreet || null,
        customer_city: customerCity || null,
        customer_zip: customerZip || null,
      })
      .select("id")
      .single();


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
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Confirm failed." },
      { status: 500 }
    );
  }
}