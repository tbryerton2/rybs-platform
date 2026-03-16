// src/app/api/admin/bookings/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

export async function PATCH(req: Request, ctx: any) {
  try {
    // ✅ Robust params handling
    const p = await Promise.resolve(ctx?.params ?? {});
    const id = p?.id;

    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing booking id" }, { status: 400 });
    }
    if (!isUuid(id)) {
      return NextResponse.json({ ok: false, error: `Invalid booking id: ${id}` }, { status: 400 });
    }

    // ✅ Optional token gate
    const expected = process.env.ADMIN_TOKEN;
    if (expected) {
      const got = req.headers.get("x-admin-token");
      if (got !== expected) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const nextStatus = body?.status;
    const note = typeof body?.note === "string" ? body.note.trim() : null;

    if (!nextStatus || typeof nextStatus !== "string") {
      return NextResponse.json({ ok: false, error: "Missing status" }, { status: 400 });
    }

    // 0) Load current booking (need old status + email/phone)
    const { data: existing, error: getErr } = await supabaseAdmin
      .from("bookings")
      .select("id,status,customer_email,customer_phone")
      .eq("id", id)
      .single();

    if (getErr || !existing) {
      return NextResponse.json(
        { ok: false, error: getErr?.message ?? "Not found" },
        { status: 404 }
      );
    }

    const oldStatus = existing.status ?? null;

    // 1) Update booking
    const { error: updErr } = await supabaseAdmin
      .from("bookings")
      .update({ status: nextStatus })
      .eq("id", id);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });
    }

    // 2) Log event (every change)
    await supabaseAdmin.from("booking_events").insert({
      booking_id: id,
      type: "status_changed",
      old_status: oldStatus,
      new_status: nextStatus,
      note,
    });

    // 3) Queue outbound email message (NO sending yet)
const shouldNotify = ["scheduled", "confirmed", "cancelled"].includes(nextStatus);
const toEmail = (existing.customer_email ?? "").trim();

let queued = false;

if (shouldNotify && toEmail) {
  const subjectByStatus: Record<string, string> = {
    confirmed: "Tin Can Man — Booking confirmed",
    scheduled: "Tin Can Man — Your delivery is scheduled",
    cancelled: "Tin Can Man — Booking cancelled",
  };

  const bodyByStatus: Record<string, string> = {
    confirmed: `Your booking is confirmed. Booking ID: ${id}`,
    scheduled: `Your delivery is scheduled. Booking ID: ${id}`,
    cancelled: `Your booking has been cancelled. Booking ID: ${id}`,
  };

  const { error: msgErr } = await supabaseAdmin.from("booking_messages").insert({
    booking_id: id,
    channel: "email",
    direction: "outbound",
    template: `status_${nextStatus}`,
    to: toEmail,
    subject: subjectByStatus[nextStatus] ?? "Tin Can Man — Update",
    body: bodyByStatus[nextStatus] ?? `Status updated to ${nextStatus}. Booking ID: ${id}`,
    provider: null,
    provider_message_id: null,
    status: "queued",
    error: null,
    sent_at: null,
  });

  if (msgErr) {
    return NextResponse.json(
      { ok: false, error: `booking_messages insert failed: ${msgErr.message}` },
      { status: 500 }
    );
  }

  queued = true;
}

return NextResponse.json({ ok: true, queued, toEmail, shouldNotify });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}