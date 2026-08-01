import { NextResponse } from "next/server";
import { WebhooksHelper } from "square";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PaymentStatus } from "@/lib/payments/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SquareWebhookEvent = {
  event_id?: string;
  id?: string;
  type?: string;
  data?: {
    type?: string;
    id?: string;
    object?: {
      payment?: SquareWebhookPayment;
    };
  };
};

type SquareWebhookPayment = {
  id?: string;
  status?: string;
  order_id?: string;
  location_id?: string;
  updated_at?: string;
  created_at?: string;
  amount_money?: {
    amount?: number;
    currency?: string;
  };
  errors?: Array<{
    code?: string;
    detail?: string;
  }>;
};

type BookingPaymentWebhookRow = {
  id: string;
  business_id: string;
  booking_id: string | null;
  status: string;
};

function getSquareWebhookSignatureKey() {
  return process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim() ?? "";
}

function getSquareWebhookNotificationUrl() {
  const configured = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim();
  if (configured) return configured;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) return "";

  return `${siteUrl.replace(/\/$/, "")}/api/webhooks/square`;
}

function getConfiguredSquareEnvironment() {
  const raw = (process.env.SQUARE_ENVIRONMENT || "sandbox").trim().toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

function sanitizeJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => sanitizeJsonValue(item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        sanitizeJsonValue(nestedValue),
      ]),
    );
  }
  return value;
}

function mapSquarePaymentStatus(status: string | null | undefined): PaymentStatus {
  switch ((status || "").toUpperCase()) {
    case "COMPLETED":
      return "paid";
    case "FAILED":
      return "failed";
    case "CANCELED":
    case "CANCELLED":
      return "canceled";
    case "APPROVED":
    case "PENDING":
    default:
      return "pending";
  }
}

function firstSquarePaymentError(payment: SquareWebhookPayment | null) {
  const first = payment?.errors?.[0];
  return {
    code: first?.code ?? null,
    message: first?.detail ?? null,
  };
}

function getPaymentFromEvent(event: SquareWebhookEvent) {
  return event.data?.object?.payment ?? null;
}

function getEventId(event: SquareWebhookEvent) {
  return (event.event_id || event.id || "").trim();
}

function getEventType(event: SquareWebhookEvent) {
  return (event.type || "").trim();
}

function isSupportedPaymentEvent(eventType: string) {
  return eventType === "payment.created" || eventType === "payment.updated";
}

function toBookingPaymentStatus(status: PaymentStatus) {
  return status === "canceled" ? "failed" : status;
}

async function markWebhookEvent(
  eventId: string,
  values: {
    businessId?: string | null;
    bookingPaymentId?: string | null;
    bookingId?: string | null;
    processingStatus: "processed" | "ignored" | "unmatched" | "failed";
    processingError?: string | null;
  },
) {
  const { error } = await supabaseAdmin
    .from("square_webhook_events")
    .update({
      business_id: values.businessId ?? null,
      booking_payment_id: values.bookingPaymentId ?? null,
      booking_id: values.bookingId ?? null,
      processing_status: values.processingStatus,
      processing_error: values.processingError ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("event_id", eventId);

  if (error) {
    console.error("[square-webhook] failed to update webhook event record:", error);
  }
}

async function insertWebhookEvent(input: {
  eventId: string;
  eventType: string;
  providerPaymentId: string | null;
  rawEvent: SquareWebhookEvent;
}) {
  const { error } = await supabaseAdmin.from("square_webhook_events").insert({
    event_id: input.eventId,
    event_type: input.eventType,
    provider_payment_id: input.providerPaymentId,
    provider_environment: getConfiguredSquareEnvironment(),
    raw_event: sanitizeJsonValue(input.rawEvent),
  });

  if (!error) return { inserted: true };

  if ("code" in error && error.code === "23505") {
    return { inserted: false };
  }

  throw new Error(error.message);
}

async function reconcilePaymentEvent(input: {
  eventId: string;
  eventType: string;
  payment: SquareWebhookPayment;
  rawEvent: SquareWebhookEvent;
}) {
  const providerPaymentId = input.payment.id?.trim();
  if (!providerPaymentId) {
    await markWebhookEvent(input.eventId, {
      processingStatus: "unmatched",
      processingError: "Square payment event did not include a payment ID.",
    });
    return;
  }

  const existing = await supabaseAdmin
    .from("booking_payments")
    .select("id, business_id, booking_id, status")
    .eq("provider", "square")
    .eq("provider_environment", getConfiguredSquareEnvironment())
    .eq("provider_payment_id", providerPaymentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<BookingPaymentWebhookRow>();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (!existing.data) {
    await markWebhookEvent(input.eventId, {
      processingStatus: "unmatched",
      processingError: `No booking payment matched Square payment ${providerPaymentId}.`,
    });
    console.warn("[square-webhook] unmatched Square payment event", {
      eventId: input.eventId,
      eventType: input.eventType,
      providerPaymentId,
    });
    return;
  }

  const status = mapSquarePaymentStatus(input.payment.status);
  const squareError = firstSquarePaymentError(input.payment);
  const terminalFailure = status === "failed" || status === "canceled";
  const paidAt = status === "paid" ? input.payment.updated_at ?? new Date().toISOString() : null;
  const failedAt = terminalFailure ? input.payment.updated_at ?? new Date().toISOString() : null;

  const paymentUpdate = await supabaseAdmin
    .from("booking_payments")
    .update({
      status,
      provider_order_id: input.payment.order_id ?? null,
      provider_location_id: input.payment.location_id ?? null,
      failure_code: terminalFailure ? squareError.code ?? status : null,
      failure_message: terminalFailure ? squareError.message ?? `Square payment ${status}.` : null,
      raw_provider_response: sanitizeJsonValue(input.rawEvent),
      paid_at: paidAt,
      failed_at: failedAt,
    })
    .eq("id", existing.data.id);

  if (paymentUpdate.error) {
    throw new Error(paymentUpdate.error.message);
  }

  if (existing.data.booking_id) {
    const bookingUpdate: Record<string, unknown> = {
      payment_status: toBookingPaymentStatus(status),
      payment_provider: "square",
      payment_provider_payment_id: providerPaymentId,
    };

    if (status === "paid") {
      bookingUpdate.paid_at = paidAt ?? new Date().toISOString();
    }

    const bookingResult = await supabaseAdmin
      .from("bookings")
      .update(bookingUpdate)
      .eq("id", existing.data.booking_id)
      .eq("business_id", existing.data.business_id);

    if (bookingResult.error) {
      throw new Error(bookingResult.error.message);
    }
  }

  await markWebhookEvent(input.eventId, {
    businessId: existing.data.business_id,
    bookingPaymentId: existing.data.id,
    bookingId: existing.data.booking_id,
    processingStatus: "processed",
  });
}

export async function POST(req: Request) {
  const requestBody = await req.text();
  const signatureHeader = req.headers.get("x-square-hmacsha256-signature") ?? "";
  const signatureKey = getSquareWebhookSignatureKey();
  const notificationUrl = getSquareWebhookNotificationUrl();

  if (!signatureKey || !notificationUrl) {
    console.error("[square-webhook] missing webhook signature configuration");
    return NextResponse.json({ ok: false, error: "Webhook is not configured." }, { status: 500 });
  }

  const signatureValid = await WebhooksHelper.verifySignature({
    requestBody,
    signatureHeader,
    signatureKey,
    notificationUrl,
  });

  if (!signatureValid) {
    return NextResponse.json({ ok: false, error: "Invalid Square webhook signature." }, { status: 401 });
  }

  let event: SquareWebhookEvent;
  try {
    event = JSON.parse(requestBody) as SquareWebhookEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const eventId = getEventId(event);
  const eventType = getEventType(event);
  const payment = getPaymentFromEvent(event);
  const providerPaymentId = payment?.id?.trim() ?? null;

  if (!eventId || !eventType) {
    return NextResponse.json({ ok: false, error: "Square webhook event is missing id or type." }, { status: 400 });
  }

  try {
    const insertResult = await insertWebhookEvent({
      eventId,
      eventType,
      providerPaymentId,
      rawEvent: event,
    });

    if (!insertResult.inserted) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (!isSupportedPaymentEvent(eventType)) {
      await markWebhookEvent(eventId, {
        processingStatus: "ignored",
        processingError: `Unsupported Square event type: ${eventType}.`,
      });
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (!payment) {
      await markWebhookEvent(eventId, {
        processingStatus: "unmatched",
        processingError: "Square payment event did not include a payment object.",
      });
      return NextResponse.json({ ok: true, unmatched: true });
    }

    await reconcilePaymentEvent({
      eventId,
      eventType,
      payment,
      rawEvent: event,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[square-webhook] processing failed:", error);
    await markWebhookEvent(eventId, {
      processingStatus: "failed",
      processingError: error instanceof Error ? error.message : "Square webhook processing failed.",
    });
    return NextResponse.json({ ok: false, error: "Square webhook processing failed." }, { status: 500 });
  }
}
