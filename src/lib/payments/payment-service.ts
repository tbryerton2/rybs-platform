import "server-only";

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPaymentProviderAdapter } from "./providers";
import type {
  CheckoutPaymentResult,
  CreateCheckoutPaymentInput,
  PaymentProvider,
  PaymentProviderAdapter,
  PaymentProviderChargeResult,
  PaymentProviderEnvironment,
  PaymentStatus,
  StoredCheckoutPayment,
} from "./types";

const DEFAULT_PAYMENT_PROVIDER = "square" satisfies PaymentProvider;
const DEFAULT_CURRENCY = "USD";
const BOOKING_PAYMENT_SELECT =
  "id, business_id, booking_hold_id, booking_id, provider, provider_environment, status, amount_cents, currency, provider_payment_id, provider_order_id, provider_location_id, idempotency_key, failure_code, failure_message, raw_provider_response, paid_at, failed_at, created_at, updated_at";

type BookingPaymentRow = {
  id: string;
  business_id: string;
  booking_hold_id: string | null;
  booking_id: string | null;
  provider: string;
  provider_environment: string;
  status: string;
  amount_cents: number;
  currency: string;
  provider_payment_id: string | null;
  provider_order_id: string | null;
  provider_location_id: string | null;
  idempotency_key: string;
  failure_code: string | null;
  failure_message: string | null;
  raw_provider_response: unknown | null;
  paid_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
};

export class PaymentServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "PaymentServiceError";
  }
}

function assertUuid(value: string, fieldName: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new PaymentServiceError(`${fieldName} must be a valid UUID.`);
  }
}

function normalizeAmountCents(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new PaymentServiceError("amountCents must be a non-negative finite number.");
  }

  return Math.round(value);
}

function normalizeCurrency(value: string | undefined) {
  const currency = (value || DEFAULT_CURRENCY).trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new PaymentServiceError("currency must be a 3-letter ISO currency code.");
  }

  return currency;
}

function normalizeIdempotencyKey(value: string | undefined) {
  const key = value?.trim();
  return key || randomUUID();
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

function toStoredPayment(row: BookingPaymentRow): StoredCheckoutPayment {
  return {
    id: row.id,
    businessId: row.business_id,
    bookingHoldId: row.booking_hold_id ?? "",
    bookingId: row.booking_id,
    provider: row.provider as PaymentProvider,
    providerEnvironment: row.provider_environment as PaymentProviderEnvironment,
    status: row.status as PaymentStatus,
    amountCents: row.amount_cents,
    currency: row.currency,
    providerPaymentId: row.provider_payment_id,
    providerOrderId: row.provider_order_id,
    providerLocationId: row.provider_location_id,
    idempotencyKey: row.idempotency_key,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    rawProviderResponse: row.raw_provider_response,
    paidAt: row.paid_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCheckoutPaymentResult(payment: StoredCheckoutPayment): CheckoutPaymentResult {
  return {
    ok: payment.status === "paid",
    paymentId: payment.id,
    businessId: payment.businessId,
    bookingHoldId: payment.bookingHoldId,
    bookingId: payment.bookingId,
    paymentProvider: payment.provider,
    providerEnvironment: payment.providerEnvironment,
    status: payment.status,
    amountCents: payment.amountCents,
    currency: payment.currency,
    idempotencyKey: payment.idempotencyKey,
    providerPaymentId: payment.providerPaymentId,
    providerOrderId: payment.providerOrderId,
    providerLocationId: payment.providerLocationId,
    paidAt: payment.paidAt,
    failedAt: payment.failedAt,
    failureCode: payment.failureCode,
    failureMessage: payment.failureMessage,
  };
}

async function insertPendingPayment(input: {
  businessId: string;
  bookingHoldId: string;
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("booking_payments")
    .insert({
      business_id: input.businessId,
      booking_hold_id: input.bookingHoldId,
      provider: input.provider,
      provider_environment: input.providerEnvironment,
      status: "pending",
      amount_cents: input.amountCents,
      currency: input.currency,
      idempotency_key: input.idempotencyKey,
    })
    .select(BOOKING_PAYMENT_SELECT)
    .single<BookingPaymentRow>();

  if (error || !data) {
    if (error && "code" in error && error.code === "23505") {
      const existing = await supabaseAdmin
        .from("booking_payments")
        .select(BOOKING_PAYMENT_SELECT)
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle<BookingPaymentRow>();

      if (existing.error || !existing.data) {
        throw new PaymentServiceError(
          existing.error?.message ?? "Unable to load existing idempotent payment.",
          existing.error,
        );
      }

      const existingPayment = toStoredPayment(existing.data);
      if (
        existingPayment.businessId !== input.businessId ||
        existingPayment.bookingHoldId !== input.bookingHoldId ||
        existingPayment.provider !== input.provider ||
        existingPayment.providerEnvironment !== input.providerEnvironment ||
        existingPayment.amountCents !== input.amountCents ||
        existingPayment.currency !== input.currency
      ) {
        throw new PaymentServiceError(
          "idempotencyKey already belongs to a different checkout payment request.",
        );
      }

      return existingPayment;
    }

    throw new PaymentServiceError(error?.message ?? "Unable to create pending payment.", error);
  }

  return toStoredPayment(data);
}

function terminalFailureStatus(status: PaymentStatus) {
  return status === "failed" || status === "canceled" ? status : "failed";
}

async function updatePaymentFromProviderResult(
  paymentId: string,
  providerResult: PaymentProviderChargeResult,
) {
  const status = providerResult.status;
  const update = {
    status,
    provider_payment_id: providerResult.providerPaymentId ?? null,
    provider_order_id: providerResult.providerOrderId ?? null,
    provider_location_id: providerResult.providerLocationId ?? null,
    failure_code: providerResult.failureCode ?? null,
    failure_message: providerResult.failureMessage ?? null,
    raw_provider_response: sanitizeJsonValue(providerResult.rawProviderResponse),
    paid_at: status === "paid" ? providerResult.paidAt ?? new Date().toISOString() : null,
    failed_at:
      status === "failed" || status === "canceled"
        ? providerResult.failedAt ?? new Date().toISOString()
        : null,
  };

  const { data, error } = await supabaseAdmin
    .from("booking_payments")
    .update(update)
    .eq("id", paymentId)
    .select(BOOKING_PAYMENT_SELECT)
    .single<BookingPaymentRow>();

  if (error || !data) {
    throw new PaymentServiceError(error?.message ?? "Unable to update payment result.", error);
  }

  return toStoredPayment(data);
}

async function markPaymentFailed(input: {
  paymentId: string;
  status?: PaymentStatus;
  failureCode: string;
  failureMessage: string;
  rawProviderResponse?: unknown;
}) {
  const { data, error } = await supabaseAdmin
    .from("booking_payments")
    .update({
      status: terminalFailureStatus(input.status ?? "failed"),
      failure_code: input.failureCode,
      failure_message: input.failureMessage,
      raw_provider_response: sanitizeJsonValue(input.rawProviderResponse),
      failed_at: new Date().toISOString(),
    })
    .eq("id", input.paymentId)
    .select(BOOKING_PAYMENT_SELECT)
    .single<BookingPaymentRow>();

  if (error || !data) {
    throw new PaymentServiceError(error?.message ?? "Unable to mark payment failed.", error);
  }

  return toStoredPayment(data);
}

export async function createCheckoutPayment(
  input: CreateCheckoutPaymentInput,
  options?: { adapter?: PaymentProviderAdapter },
): Promise<CheckoutPaymentResult> {
  assertUuid(input.businessId, "businessId");
  assertUuid(input.bookingHoldId, "bookingHoldId");

  const amountCents = normalizeAmountCents(input.amountCents);
  const currency = normalizeCurrency(input.currency);
  const paymentProvider = input.paymentProvider ?? DEFAULT_PAYMENT_PROVIDER;
  const paymentMethodToken = input.paymentMethodToken.trim();
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

  if (!paymentMethodToken) {
    throw new PaymentServiceError("paymentMethodToken is required.");
  }

  const adapter = options?.adapter ?? getPaymentProviderAdapter(paymentProvider);

  if (adapter.provider !== paymentProvider) {
    throw new PaymentServiceError(
      `Payment adapter mismatch: expected ${paymentProvider}, received ${adapter.provider}.`,
    );
  }

  const pendingPayment = await insertPendingPayment({
    businessId: input.businessId,
    bookingHoldId: input.bookingHoldId,
    provider: paymentProvider,
    providerEnvironment: adapter.environment,
    amountCents,
    currency,
    idempotencyKey,
  });

  if (pendingPayment.status !== "pending") {
    return toCheckoutPaymentResult(pendingPayment);
  }

  let providerResult: PaymentProviderChargeResult;
  try {
    providerResult = await adapter.charge({
      paymentId: pendingPayment.id,
      businessId: input.businessId,
      bookingHoldId: input.bookingHoldId,
      amountCents,
      currency,
      paymentMethodToken,
      idempotencyKey,
      description: input.description,
    });
  } catch (error) {
    const failedPayment = await markPaymentFailed({
      paymentId: pendingPayment.id,
      failureCode: "PROVIDER_EXCEPTION",
      failureMessage: error instanceof Error ? error.message : "Payment provider failed.",
      rawProviderResponse: error instanceof Error ? { message: error.message } : { error },
    });

    return toCheckoutPaymentResult(failedPayment);
  }

  const updatedPayment = await updatePaymentFromProviderResult(pendingPayment.id, providerResult);
  return toCheckoutPaymentResult(updatedPayment);
}

export async function linkCheckoutPaymentToBooking(
  paymentId: string,
  bookingId: string,
): Promise<CheckoutPaymentResult> {
  assertUuid(paymentId, "paymentId");
  assertUuid(bookingId, "bookingId");

  const { data, error } = await supabaseAdmin
    .from("booking_payments")
    .update({ booking_id: bookingId })
    .eq("id", paymentId)
    .select(BOOKING_PAYMENT_SELECT)
    .single<BookingPaymentRow>();

  if (error || !data) {
    throw new PaymentServiceError(error?.message ?? "Unable to link payment to booking.", error);
  }

  return toCheckoutPaymentResult(toStoredPayment(data));
}
