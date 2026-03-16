import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Resend } from "resend";

export async function POST() {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_API_KEY" },
        { status: 500 }
      );
    }

    const resend = new Resend(resendKey);

    // 1) Load up to 10 queued email messages
    const { data: messages, error } = await supabaseAdmin
      .from("booking_messages")
      .select(
        "id, booking_id, channel, to, subject, body, status, provider, provider_message_id"
      )
      .eq("status", "queued")
      .eq("channel", "email")
      .limit(10);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    let processed = 0;

    // 2) Send each message via Resend, then mark row sent (or failed)
    for (const msg of messages) {
      // Safety checks
      const toEmail = (msg.to ?? "").trim();
      if (!toEmail) {
        await supabaseAdmin
          .from("booking_messages")
          .update({
            status: "failed",
            error: "Missing recipient email",
          })
          .eq("id", msg.id);
        continue;
      }

      const subject = (msg.subject ?? "").trim() || "Tin Can Man — Update";
      const body = (msg.body ?? "").trim();

      if (!body) {
        await supabaseAdmin
          .from("booking_messages")
          .update({
            status: "failed",
            error: "Missing email body",
          })
          .eq("id", msg.id);
        continue;
      }

      try {
        const result = await resend.emails.send({
          from: "Tin Can Man <no-reply@yourdomain.com>",
          to: toEmail,
          subject,
          text: body,
        });

        const providerMessageId =
          (result as any)?.data?.id ?? (result as any)?.id ?? null;

        await supabaseAdmin
          .from("booking_messages")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider: "resend",
            provider_message_id: providerMessageId,
            error: null,
          })
          .eq("id", msg.id);

        processed += 1;
      } catch (sendErr: any) {
        await supabaseAdmin
          .from("booking_messages")
          .update({
            status: "failed",
            error: sendErr?.message ?? "Resend send failed",
          })
          .eq("id", msg.id);
      }
    }

    return NextResponse.json({ ok: true, processed });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}