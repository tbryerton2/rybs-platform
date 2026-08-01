export type ExternalPaymentMethod =
  | "cash"
  | "check"
  | "square_invoice"
  | "manually_processed_card"
  | "other";

export type ExternalBookingChargePaymentSupabaseClient = {
  rpc(functionName: string, args: Record<string, unknown>): {
    single(): Promise<{ data: unknown | null; error: SupabaseErrorLike | null }>;
  };
};

export type RecordExternalBookingChargePaymentInput = {
  businessId: string;
  bookingId: string;
  bookingChargeId: string;
  operatorUserId: string;
  paymentMethod: ExternalPaymentMethod;
  amountCents: number;
  paymentDate: string;
  reference?: string | null;
  notes?: string | null;
  providerEnvironment: "production" | "sandbox";
};

export type RecordExternalBookingChargePaymentOptions = {
  supabase: ExternalBookingChargePaymentSupabaseClient;
  now?: () => Date;
};

type BookingChargeRow = {
  booking_charge_id: string;
  booking_payment_id: string;
  paid_at: string;
  recorded_at: string;
};

type SupabaseErrorLike = {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

export class ExternalBookingChargePaymentServiceError extends Error {
  code: string;
  cause?: unknown;

  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.name = "ExternalBookingChargePaymentServiceError";
    this.code = code;
    this.cause = cause;
  }
}

function getSafeExternalPaymentError(error: SupabaseErrorLike) {
  const message = error.message.toLowerCase();
  if (message.includes("function") || message.includes("schema cache")) {
    return {
      code: "DATABASE_ERROR",
      message: "The external payment could not be recorded. No changes were saved.",
    };
  }
  if (message.includes("already recorded")) {
    return {
      code: "PAYMENT_ALREADY_RECORDED",
      message: "A paid payment is already recorded for this charge.",
    };
  }
  if (message.includes("still need approval") || message.includes("eligible")) {
    return {
      code: "CHARGE_NOT_ELIGIBLE",
      message: "External payment can only be recorded for charges that still need approval.",
    };
  }
  if (message.includes("not found")) {
    return {
      code: "CHARGE_NOT_FOUND",
      message: "Charge was not found for this booking.",
    };
  }
  if (message.includes("amount")) {
    return {
      code: "INVALID_AMOUNT",
      message: "External payment amount must be greater than $0.00.",
    };
  }
  if (message.includes("payment method")) {
    return {
      code: "INVALID_PAYMENT_METHOD",
      message: "Choose a valid external payment method.",
    };
  }

  return {
    code: "DATABASE_ERROR",
    message: "The external payment could not be recorded. No changes were saved.",
  };
}

export async function recordExternalBookingChargePayment(
  input: RecordExternalBookingChargePaymentInput,
  options: RecordExternalBookingChargePaymentOptions,
) {
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    throw new ExternalBookingChargePaymentServiceError(
      "External payment amount must be greater than $0.00.",
      "INVALID_AMOUNT",
    );
  }

  const recordedAt = (options.now ?? (() => new Date()))().toISOString();
  const result = (await options.supabase.rpc("record_external_booking_charge_payment", {
    p_business_id: input.businessId,
    p_booking_id: input.bookingId,
    p_booking_charge_id: input.bookingChargeId,
    p_operator_user_id: input.operatorUserId,
    p_external_payment_method: input.paymentMethod,
    p_amount_cents: input.amountCents,
    p_payment_date: input.paymentDate,
    p_reference: input.reference ?? null,
    p_notes: input.notes ?? null,
    p_provider_environment: input.providerEnvironment,
    p_recorded_at: recordedAt,
  }).single()) as { data: BookingChargeRow | null; error: SupabaseErrorLike | null };

  if (result.error || !result.data) {
    const safe = getSafeExternalPaymentError(
      result.error ?? { message: "External payment transaction returned no result." },
    );

    throw new ExternalBookingChargePaymentServiceError(
      safe.message,
      safe.code,
      result.error,
    );
  }

  return {
    bookingChargeId: input.bookingChargeId,
    bookingPaymentId: result.data.booking_payment_id,
    amountCents: input.amountCents,
    paidAt: result.data.paid_at,
    recordedAt,
  };
}
