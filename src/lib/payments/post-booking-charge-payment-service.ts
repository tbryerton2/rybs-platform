import { queueBookingEmail } from "../booking-messages.ts";
import {
  buildPostBookingChargePaidEmail,
  type PostBookingChargeType,
} from "../messages/post-booking-charge-receipt.ts";
import { combineCustomerNameParts } from "../customer-name.ts";
import type {
  CurrencyCode,
  PaymentProvider,
  PaymentProviderAdapter,
  PaymentProviderChargeResult,
  PaymentProviderEnvironment,
  PaymentStatus,
  StoredCustomerPaymentMethod,
} from "./types";

const DEFAULT_PAYMENT_PROVIDER = "square" satisfies PaymentProvider;
const DEFAULT_CURRENCY = "USD";

const BOOKING_CHARGE_SELECT =
  "id, business_id, booking_id, customer_payment_method_id, charge_type, description, amount_cents, currency, status, provider, provider_environment, provider_payment_id, paid_at, failed_at, created_at, updated_at";

const BOOKING_PAYMENT_SELECT =
  "id, business_id, booking_hold_id, booking_id, booking_charge_id, provider, provider_environment, status, amount_cents, currency, provider_payment_id, provider_order_id, provider_location_id, idempotency_key, failure_code, failure_message, raw_provider_response, paid_at, failed_at, created_at, updated_at";

const BOOKING_SELECT = "id, customer_id, booking_ref, customer_first_name, customer_last_name, customer_email";

const TENANT_SETTING_SELECT = "value_json";

const CUSTOMER_PAYMENT_METHOD_SELECT =
  "id, business_id, customer_id, customer_provider_account_id, provider, provider_environment, provider_customer_id, provider_payment_method_id, card_brand, card_last_4, card_exp_month, card_exp_year, status, consent_text, consent_accepted_at, created_at, updated_at";

const BOOKING_CONSENT_SELECT = "id";

type SupabaseError = {
  message: string;
  code?: string;
};

type SupabaseResult<T> = {
  data: T | null;
  error: SupabaseError | null;
};

type QueryBuilder<T = unknown> = {
  eq(column: string, value: string): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  select(columns: string): {
    single<U = T>(): Promise<SupabaseResult<U>>;
  };
  maybeSingle<U = T>(): Promise<SupabaseResult<U>>;
  single<U = T>(): Promise<SupabaseResult<U>>;
};

type InsertBuilder<T = unknown> = {
  select(columns: string): {
    single<U = T>(): Promise<SupabaseResult<U>>;
  };
};

type TableClient = {
  select(columns: string): QueryBuilder;
  insert(values: Record<string, unknown>): InsertBuilder;
  update(values: Record<string, unknown>): QueryBuilder;
};

export type PostBookingChargePaymentSupabaseClient = {
  from(table: string): TableClient;
};

type BookingChargeRow = {
  id: string;
  business_id: string;
  booking_id: string;
  customer_payment_method_id: string | null;
  charge_type: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  provider: string | null;
  provider_environment: string | null;
  provider_payment_id: string | null;
  paid_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
};

type BookingPaymentRow = {
  id: string;
  business_id: string;
  booking_hold_id: string | null;
  booking_id: string | null;
  booking_charge_id: string | null;
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

type BookingRow = {
  id: string;
  customer_id: string | null;
  booking_ref: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
};

type CustomerPaymentMethodRow = {
  id: string;
  business_id: string;
  customer_id: string;
  customer_provider_account_id: string | null;
  provider: string;
  provider_environment: string;
  provider_customer_id: string;
  provider_payment_method_id: string;
  card_brand: string | null;
  card_last_4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  status: string;
  consent_text: string | null;
  consent_accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ChargePendingBookingChargeWithSavedCardInput = {
  businessId: string;
  bookingId: string;
  bookingChargeId: string;
  actorUserId?: string | null;
  idempotencyKey?: string;
};

export type PostBookingChargePaymentResult = {
  ok: boolean;
  bookingChargeId: string;
  bookingId: string;
  businessId: string;
  bookingPaymentId: string;
  customerPaymentMethodId: string | null;
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  status: PaymentStatus;
  amountCents: number;
  currency: CurrencyCode;
  providerPaymentId: string | null;
  paidAt: string | null;
  failedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  reusedExistingPaidPayment: boolean;
};

type ChargePendingBookingChargeOptions = {
  supabase?: PostBookingChargePaymentSupabaseClient;
  adapter?: PaymentProviderAdapter;
  now?: () => Date;
  queueBookingEmail?: typeof queueBookingEmail;
  logger?: Pick<Console, "error" | "warn">;
};

export class PostBookingChargePaymentServiceError extends Error {
  readonly code: string;
  readonly result?: PostBookingChargePaymentResult;
  readonly cause?: unknown;

  constructor(
    message: string,
    code = "POST_BOOKING_CHARGE_PAYMENT_ERROR",
    result?: PostBookingChargePaymentResult,
    cause?: unknown,
  ) {
    super(message);
    this.name = "PostBookingChargePaymentServiceError";
    this.code = code;
    this.result = result;
    this.cause = cause;
  }
}

async function getSupabaseClient() {
  const { supabaseAdmin } = await import("../supabaseAdmin");
  return supabaseAdmin as unknown as PostBookingChargePaymentSupabaseClient;
}

async function getAdapter(provider: PaymentProvider) {
  const { getPaymentProviderAdapter } = await import("./providers");
  return getPaymentProviderAdapter(provider);
}

function clean(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function cleanRequired(value: string | undefined, fieldName: string) {
  const cleaned = clean(value);
  if (!cleaned) {
    throw new PostBookingChargePaymentServiceError(`${fieldName} is required.`, "VALIDATION_ERROR");
  }
  return cleaned;
}

function assertUuid(value: string, fieldName: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new PostBookingChargePaymentServiceError(
      `${fieldName} must be a valid UUID.`,
      "VALIDATION_ERROR",
    );
  }
}

function normalizeCurrency(value: string) {
  const currency = clean(value)?.toUpperCase() ?? DEFAULT_CURRENCY;
  if (currency !== DEFAULT_CURRENCY) {
    throw new PostBookingChargePaymentServiceError(
      "Only USD post-booking charges are supported.",
      "VALIDATION_ERROR",
    );
  }
  return currency;
}

function normalizeIdempotencyKey(input: {
  bookingChargeId: string;
  idempotencyKey?: string;
}) {
  return clean(input.idempotencyKey) ?? `post-booking-charge:${input.bookingChargeId}`;
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

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

function toStoredCustomerPaymentMethod(row: CustomerPaymentMethodRow): StoredCustomerPaymentMethod {
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    customerProviderAccountId: row.customer_provider_account_id,
    provider: row.provider as PaymentProvider,
    providerEnvironment: row.provider_environment as PaymentProviderEnvironment,
    providerCustomerId: row.provider_customer_id,
    providerPaymentMethodId: row.provider_payment_method_id,
    cardBrand: row.card_brand,
    cardLast4: row.card_last_4,
    cardExpMonth: row.card_exp_month,
    cardExpYear: row.card_exp_year,
    status: row.status as StoredCustomerPaymentMethod["status"],
    consentText: row.consent_text,
    consentAcceptedAt: row.consent_accepted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPaymentResult(input: {
  payment: BookingPaymentRow;
  charge: BookingChargeRow;
  customerPaymentMethodId: string | null;
  reusedExistingPaidPayment?: boolean;
}): PostBookingChargePaymentResult {
  return {
    ok: input.payment.status === "paid",
    bookingChargeId: input.charge.id,
    bookingId: input.charge.booking_id,
    businessId: input.charge.business_id,
    bookingPaymentId: input.payment.id,
    customerPaymentMethodId: input.customerPaymentMethodId,
    provider: input.payment.provider as PaymentProvider,
    providerEnvironment: input.payment.provider_environment as PaymentProviderEnvironment,
    status: input.payment.status as PaymentStatus,
    amountCents: input.payment.amount_cents,
    currency: input.payment.currency,
    providerPaymentId: input.payment.provider_payment_id,
    paidAt: input.payment.paid_at,
    failedAt: input.payment.failed_at,
    failureCode: input.payment.failure_code,
    failureMessage: input.payment.failure_message,
    reusedExistingPaidPayment: input.reusedExistingPaidPayment ?? false,
  };
}

function requirePendingCharge(charge: BookingChargeRow) {
  if (charge.status !== "pending") {
    throw new PostBookingChargePaymentServiceError(
      "Only charges marked ready to charge can be charged.",
      "CHARGE_NOT_PENDING",
    );
  }

  if (!Number.isFinite(charge.amount_cents) || charge.amount_cents <= 0) {
    throw new PostBookingChargePaymentServiceError(
      "Charge amount must be greater than $0.00.",
      "INVALID_CHARGE",
    );
  }

  if (!clean(charge.description)) {
    throw new PostBookingChargePaymentServiceError(
      "Charge description is required before charging.",
      "INVALID_CHARGE",
    );
  }
}

async function loadBookingCharge(input: {
  supabase: PostBookingChargePaymentSupabaseClient;
  businessId: string;
  bookingId: string;
  bookingChargeId: string;
}) {
  const { data, error } = await input.supabase
    .from("booking_charges")
    .select(BOOKING_CHARGE_SELECT)
    .eq("id", input.bookingChargeId)
    .eq("booking_id", input.bookingId)
    .eq("business_id", input.businessId)
    .maybeSingle<BookingChargeRow>();

  if (error) {
    throw new PostBookingChargePaymentServiceError(error.message, "DATABASE_ERROR", undefined, error);
  }

  if (!data) {
    throw new PostBookingChargePaymentServiceError(
      "Pending charge was not found for this booking.",
      "CHARGE_NOT_FOUND",
    );
  }

  return data;
}

async function loadBooking(input: {
  supabase: PostBookingChargePaymentSupabaseClient;
  businessId: string;
  bookingId: string;
}) {
  const { data, error } = await input.supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("id", input.bookingId)
    .eq("business_id", input.businessId)
    .maybeSingle<BookingRow>();

  if (error) {
    throw new PostBookingChargePaymentServiceError(error.message, "DATABASE_ERROR", undefined, error);
  }

  if (!data) {
    throw new PostBookingChargePaymentServiceError("Booking was not found.", "BOOKING_NOT_FOUND");
  }

  if (!data.customer_id) {
    throw new PostBookingChargePaymentServiceError(
      "Booking does not have a customer linked.",
      "BOOKING_CUSTOMER_MISSING",
    );
  }

  return data;
}

async function hasCardOnFileConsent(input: {
  supabase: PostBookingChargePaymentSupabaseClient;
  businessId: string;
  bookingId: string;
  customerId: string;
}) {
  const { data, error } = await input.supabase
    .from("booking_consents")
    .select(BOOKING_CONSENT_SELECT)
    .eq("business_id", input.businessId)
    .eq("booking_id", input.bookingId)
    .eq("customer_id", input.customerId)
    .eq("consent_type", "card_on_file")
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new PostBookingChargePaymentServiceError(error.message, "DATABASE_ERROR", undefined, error);
  }

  return Boolean(data);
}

async function findLatestActiveSavedCard(input: {
  supabase: PostBookingChargePaymentSupabaseClient;
  businessId: string;
  customerId: string;
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
}) {
  const { data, error } = await input.supabase
    .from("customer_payment_methods")
    .select(CUSTOMER_PAYMENT_METHOD_SELECT)
    .eq("business_id", input.businessId)
    .eq("customer_id", input.customerId)
    .eq("provider", input.provider)
    .eq("provider_environment", input.providerEnvironment)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<CustomerPaymentMethodRow>();

  if (error) {
    throw new PostBookingChargePaymentServiceError(error.message, "DATABASE_ERROR", undefined, error);
  }

  return data ? toStoredCustomerPaymentMethod(data) : null;
}

async function findPaymentByStatus(input: {
  supabase: PostBookingChargePaymentSupabaseClient;
  bookingChargeId: string;
  status: "paid" | "pending";
}) {
  const { data, error } = await input.supabase
    .from("booking_payments")
    .select(BOOKING_PAYMENT_SELECT)
    .eq("booking_charge_id", input.bookingChargeId)
    .eq("status", input.status)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<BookingPaymentRow>();

  if (error) {
    throw new PostBookingChargePaymentServiceError(error.message, "DATABASE_ERROR", undefined, error);
  }

  return data;
}

async function insertPendingPayment(input: {
  supabase: PostBookingChargePaymentSupabaseClient;
  businessId: string;
  bookingId: string;
  bookingChargeId: string;
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  amountCents: number;
  currency: CurrencyCode;
  idempotencyKey: string;
}) {
  const { data, error } = await input.supabase
    .from("booking_payments")
    .insert({
      business_id: input.businessId,
      booking_id: input.bookingId,
      booking_charge_id: input.bookingChargeId,
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
    if (isUniqueViolation(error)) {
      throw new PostBookingChargePaymentServiceError(
        "A payment attempt already exists for this charge.",
        "PAYMENT_ALREADY_EXISTS",
        undefined,
        error,
      );
    }

    throw new PostBookingChargePaymentServiceError(
      error?.message ?? "Unable to create pending post-booking payment.",
      "DATABASE_ERROR",
      undefined,
      error,
    );
  }

  return data;
}

async function updatePaymentFromProviderResult(input: {
  supabase: PostBookingChargePaymentSupabaseClient;
  paymentId: string;
  providerResult: PaymentProviderChargeResult;
}) {
  const status = input.providerResult.status;
  const { data, error } = await input.supabase
    .from("booking_payments")
    .update({
      status,
      provider_payment_id: input.providerResult.providerPaymentId ?? null,
      provider_order_id: input.providerResult.providerOrderId ?? null,
      provider_location_id: input.providerResult.providerLocationId ?? null,
      failure_code: input.providerResult.failureCode ?? null,
      failure_message: input.providerResult.failureMessage ?? null,
      raw_provider_response: sanitizeJsonValue(input.providerResult.rawProviderResponse),
      paid_at: status === "paid" ? input.providerResult.paidAt ?? new Date().toISOString() : null,
      failed_at:
        status === "failed" || status === "canceled"
          ? input.providerResult.failedAt ?? new Date().toISOString()
          : null,
    })
    .eq("id", input.paymentId)
    .select(BOOKING_PAYMENT_SELECT)
    .single<BookingPaymentRow>();

  if (error || !data) {
    throw new PostBookingChargePaymentServiceError(
      error?.message ?? "Unable to update post-booking payment result.",
      "DATABASE_ERROR",
      undefined,
      error,
    );
  }

  return data;
}

async function updateBookingChargePaid(input: {
  supabase: PostBookingChargePaymentSupabaseClient;
  charge: BookingChargeRow;
  paymentMethod: StoredCustomerPaymentMethod;
  payment: BookingPaymentRow;
}) {
  const { data, error } = await input.supabase
    .from("booking_charges")
    .update({
      status: "paid",
      customer_payment_method_id: input.paymentMethod.id,
      provider: input.payment.provider,
      provider_environment: input.payment.provider_environment,
      provider_payment_id: input.payment.provider_payment_id,
      paid_at: input.payment.paid_at ?? new Date().toISOString(),
      failed_at: null,
    })
    .eq("id", input.charge.id)
    .eq("booking_id", input.charge.booking_id)
    .eq("business_id", input.charge.business_id)
    .select(BOOKING_CHARGE_SELECT)
    .single<BookingChargeRow>();

  if (error || !data) {
    throw new PostBookingChargePaymentServiceError(
      error?.message ?? "Payment succeeded, but the booking charge could not be marked paid.",
      "BOOKKEEPING_FAILED_AFTER_PROVIDER_SUCCESS",
      toPaymentResult({
        payment: input.payment,
        charge: input.charge,
        customerPaymentMethodId: input.paymentMethod.id,
      }),
      error,
    );
  }

  return data;
}

async function updateBookingChargeFailed(input: {
  supabase: PostBookingChargePaymentSupabaseClient;
  charge: BookingChargeRow;
  paymentMethod: StoredCustomerPaymentMethod | null;
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  failedAt: string;
}) {
  const { data, error } = await input.supabase
    .from("booking_charges")
    .update({
      status: "failed",
      customer_payment_method_id: input.paymentMethod?.id ?? input.charge.customer_payment_method_id,
      provider: input.provider,
      provider_environment: input.providerEnvironment,
      failed_at: input.failedAt,
    })
    .eq("id", input.charge.id)
    .eq("booking_id", input.charge.booking_id)
    .eq("business_id", input.charge.business_id)
    .select(BOOKING_CHARGE_SELECT)
    .single<BookingChargeRow>();

  if (error || !data) {
    throw new PostBookingChargePaymentServiceError(
      error?.message ?? "Unable to mark booking charge failed.",
      "DATABASE_ERROR",
      undefined,
      error,
    );
  }

  return data;
}

function asFailedProviderResult(
  providerResult: PaymentProviderChargeResult,
  fallback: {
    failedAt: string;
    failureCode: string;
    failureMessage: string;
  },
): PaymentProviderChargeResult {
  return {
    ...providerResult,
    status: "failed",
    failedAt: providerResult.failedAt ?? fallback.failedAt,
    failureCode: providerResult.failureCode ?? fallback.failureCode,
    failureMessage: providerResult.failureMessage ?? fallback.failureMessage,
  };
}

function buildChargeDescription(input: {
  booking: BookingRow;
  charge: BookingChargeRow;
}) {
  const bookingReference = clean(input.booking.booking_ref) ?? input.booking.id;
  const description = clean(input.charge.description) ?? clean(input.charge.charge_type) ?? "post-rental";
  return `${bookingReference}: ${description}`.slice(0, 45);
}

function isPostBookingChargeType(value: string): value is PostBookingChargeType {
  return (
    value === "weight_overage" ||
    value === "damage" ||
    value === "extra_day" ||
    value === "trip_fee" ||
    value === "prohibited_material" ||
    value === "manual_adjustment"
  );
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

async function loadTenantSetting(input: {
  supabase: PostBookingChargePaymentSupabaseClient;
  businessId: string;
  category: string;
  key: string;
}) {
  const { data, error } = await input.supabase
    .from("tenant_settings")
    .select(TENANT_SETTING_SELECT)
    .eq("tenant_id", input.businessId)
    .eq("category", input.category)
    .eq("key", input.key)
    .maybeSingle<{ value_json: unknown }>();

  if (error) {
    throw new PostBookingChargePaymentServiceError(error.message, "DATABASE_ERROR", undefined, error);
  }

  return asString(data?.value_json);
}

async function loadReceiptBusinessContact(input: {
  supabase: PostBookingChargePaymentSupabaseClient;
  businessId: string;
}) {
  const [businessName, businessPhone, businessEmail] = await Promise.all([
    loadTenantSetting({
      supabase: input.supabase,
      businessId: input.businessId,
      category: "brand",
      key: "name",
    }),
    loadTenantSetting({
      supabase: input.supabase,
      businessId: input.businessId,
      category: "support",
      key: "phone",
    }),
    loadTenantSetting({
      supabase: input.supabase,
      businessId: input.businessId,
      category: "support",
      key: "email",
    }),
  ]);

  return {
    businessName: businessName ?? "Our team",
    businessPhone,
    businessEmail,
  };
}

async function queuePostBookingChargePaidReceipt(input: {
  supabase: PostBookingChargePaymentSupabaseClient;
  enqueue: typeof queueBookingEmail;
  logger: Pick<Console, "error" | "warn">;
  businessId: string;
  booking: BookingRow;
  charge: BookingChargeRow;
  paymentMethod: StoredCustomerPaymentMethod;
}) {
  const customerEmail = clean(input.booking.customer_email);
  if (!customerEmail) {
    input.logger.warn("[post-booking-charge-payment] receipt email skipped: missing customer email", {
      bookingId: input.booking.id,
      bookingChargeId: input.charge.id,
    });
    return;
  }

  if (!isPostBookingChargeType(input.charge.charge_type)) {
    input.logger.warn("[post-booking-charge-payment] receipt email skipped: unsupported charge type", {
      bookingId: input.booking.id,
      bookingChargeId: input.charge.id,
      chargeType: input.charge.charge_type,
    });
    return;
  }

  try {
    const contact = await loadReceiptBusinessContact({
      supabase: input.supabase,
      businessId: input.businessId,
    });
    const email = buildPostBookingChargePaidEmail({
      ...contact,
      customerName: combineCustomerNameParts(input.booking.customer_first_name, input.booking.customer_last_name),
      bookingReference: input.booking.booking_ref,
      chargeType: input.charge.charge_type,
      chargeDescription: input.charge.description ?? "Additional rental charge",
      amountCents: input.charge.amount_cents,
      currency: input.charge.currency,
      paidAt: input.charge.paid_at ?? new Date().toISOString(),
      cardBrand: input.paymentMethod.cardBrand,
      cardLast4: input.paymentMethod.cardLast4,
    });

    await input.enqueue({
      bookingId: input.booking.id,
      bookingChargeId: input.charge.id,
      template: "post_booking_charge_paid",
      to: customerEmail,
      subject: email.subject,
      body: email.body,
    });
  } catch (error) {
    input.logger.error("[post-booking-charge-payment] receipt email queue failed", {
      bookingId: input.booking.id,
      bookingChargeId: input.charge.id,
      error,
    });
  }
}

export async function chargePendingBookingChargeWithSavedCard(
  input: ChargePendingBookingChargeWithSavedCardInput,
  options: ChargePendingBookingChargeOptions = {},
): Promise<PostBookingChargePaymentResult> {
  const businessId = cleanRequired(input.businessId, "businessId");
  const bookingId = cleanRequired(input.bookingId, "bookingId");
  const bookingChargeId = cleanRequired(input.bookingChargeId, "bookingChargeId");
  const idempotencyKey = normalizeIdempotencyKey({
    bookingChargeId,
    idempotencyKey: input.idempotencyKey,
  });

  assertUuid(businessId, "businessId");
  assertUuid(bookingId, "bookingId");
  assertUuid(bookingChargeId, "bookingChargeId");

  const supabase = options.supabase ?? (await getSupabaseClient());
  const paymentProvider = DEFAULT_PAYMENT_PROVIDER;
  const adapter = options.adapter ?? (await getAdapter(paymentProvider));
  const enqueueBookingEmail = options.queueBookingEmail ?? queueBookingEmail;
  const logger = options.logger ?? console;

  if (adapter.provider !== paymentProvider) {
    throw new PostBookingChargePaymentServiceError(
      `Payment adapter mismatch: expected ${paymentProvider}, received ${adapter.provider}.`,
      "PROVIDER_MISMATCH",
    );
  }

  const charge = await loadBookingCharge({ supabase, businessId, bookingId, bookingChargeId });

  const booking = await loadBooking({ supabase, businessId, bookingId });
  const customerId = booking.customer_id;
  if (!customerId) {
    throw new PostBookingChargePaymentServiceError(
      "Booking does not have a customer linked.",
      "BOOKING_CUSTOMER_MISSING",
    );
  }

  const existingPaidPayment = await findPaymentByStatus({
    supabase,
    bookingChargeId,
    status: "paid",
  });

  if (existingPaidPayment) {
    return toPaymentResult({
      payment: existingPaidPayment,
      charge,
      customerPaymentMethodId: charge.customer_payment_method_id,
      reusedExistingPaidPayment: true,
    });
  }

  requirePendingCharge(charge);
  const currency = normalizeCurrency(charge.currency);

  const existingPendingPayment = await findPaymentByStatus({
    supabase,
    bookingChargeId,
    status: "pending",
  });

  if (existingPendingPayment) {
    throw new PostBookingChargePaymentServiceError(
      "A payment attempt is already pending for this charge.",
      "PAYMENT_ALREADY_PENDING",
      toPaymentResult({
        payment: existingPendingPayment,
        charge,
        customerPaymentMethodId: charge.customer_payment_method_id,
      }),
    );
  }

  const consentExists = await hasCardOnFileConsent({
    supabase,
    businessId,
    bookingId,
    customerId,
  });

  if (!consentExists) {
    throw new PostBookingChargePaymentServiceError(
      "Card-on-file authorization was not found for this booking.",
      "CARD_ON_FILE_CONSENT_MISSING",
    );
  }

  const paymentMethod = await findLatestActiveSavedCard({
    supabase,
    businessId,
    customerId,
    provider: paymentProvider,
    providerEnvironment: adapter.environment,
  });

  if (!paymentMethod) {
    throw new PostBookingChargePaymentServiceError(
      "No active saved card was found for this customer.",
      "SAVED_CARD_MISSING",
    );
  }

  if (!clean(paymentMethod.providerPaymentMethodId) || !clean(paymentMethod.providerCustomerId)) {
    throw new PostBookingChargePaymentServiceError(
      "Saved card provider references are incomplete.",
      "SAVED_CARD_INVALID",
    );
  }

  const pendingPayment = await insertPendingPayment({
    supabase,
    businessId,
    bookingId,
    bookingChargeId,
    provider: paymentProvider,
    providerEnvironment: adapter.environment,
    amountCents: charge.amount_cents,
    currency,
    idempotencyKey,
  });

  let providerResult: PaymentProviderChargeResult;
  try {
    providerResult = await adapter.charge({
      paymentId: pendingPayment.id,
      businessId,
      bookingId,
      bookingChargeId,
      amountCents: charge.amount_cents,
      currency,
      paymentSourceId: paymentMethod.providerPaymentMethodId,
      providerCustomerId: paymentMethod.providerCustomerId,
      idempotencyKey: pendingPayment.id,
      description: buildChargeDescription({ booking, charge }),
    });
  } catch (error) {
    const failedAt = options.now?.().toISOString() ?? new Date().toISOString();
    const failedPayment = await updatePaymentFromProviderResult({
      supabase,
      paymentId: pendingPayment.id,
      providerResult: {
        status: "failed",
        rawProviderResponse: error instanceof Error ? { message: error.message } : { error },
        failedAt,
        failureCode: "PROVIDER_EXCEPTION",
        failureMessage: error instanceof Error ? error.message : "Payment provider failed.",
      },
    });

    await updateBookingChargeFailed({
      supabase,
      charge,
      paymentMethod,
      provider: paymentProvider,
      providerEnvironment: adapter.environment,
      failedAt,
    });

    const result = toPaymentResult({
      payment: failedPayment,
      charge,
      customerPaymentMethodId: paymentMethod.id,
    });

    throw new PostBookingChargePaymentServiceError(
      result.failureMessage ?? "Saved card charge failed.",
      "PROVIDER_CHARGE_FAILED",
      result,
      error,
    );
  }

  if (providerResult.status !== "paid") {
    providerResult = asFailedProviderResult(providerResult, {
      failedAt: options.now?.().toISOString() ?? new Date().toISOString(),
      failureCode: providerResult.status === "canceled" ? "PROVIDER_CANCELED" : "PROVIDER_NOT_PAID",
      failureMessage: `Saved card charge did not complete. Provider status: ${providerResult.status}.`,
    });
  }

  const updatedPayment = await updatePaymentFromProviderResult({
    supabase,
    paymentId: pendingPayment.id,
    providerResult,
  });

  if (updatedPayment.status !== "paid") {
    await updateBookingChargeFailed({
      supabase,
      charge,
      paymentMethod,
      provider: paymentProvider,
      providerEnvironment: adapter.environment,
      failedAt: updatedPayment.failed_at ?? new Date().toISOString(),
    });

    const result = toPaymentResult({
      payment: updatedPayment,
      charge,
      customerPaymentMethodId: paymentMethod.id,
    });

    throw new PostBookingChargePaymentServiceError(
      result.failureMessage ?? "Saved card charge failed.",
      "PROVIDER_CHARGE_FAILED",
      result,
    );
  }

  const paidCharge = await updateBookingChargePaid({
    supabase,
    charge,
    paymentMethod,
    payment: updatedPayment,
  });

  await queuePostBookingChargePaidReceipt({
    supabase,
    enqueue: enqueueBookingEmail,
    logger,
    businessId,
    booking,
    charge: paidCharge,
    paymentMethod,
  });

  return toPaymentResult({
    payment: updatedPayment,
    charge: paidCharge,
    customerPaymentMethodId: paymentMethod.id,
  });
}
