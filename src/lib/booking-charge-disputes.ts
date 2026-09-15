import { queueBookingEmail, type QueueBookingEmailInput } from "./booking-messages.ts";
import { recordEntityHistory } from "./entity-history.ts";
import { formatUsdFromCents } from "./money.ts";

export type BookingChargeDisputeStatus = "open" | "resolved";

export type BookingChargeDispute = {
  id: string;
  businessId: string;
  bookingId: string;
  bookingChargeId: string;
  customerId: string;
  status: BookingChargeDisputeStatus;
  customerExplanation: string;
  resolutionNotes: string | null;
  submittedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type BookingChargeDisputeRow = {
  id: string;
  business_id: string;
  booking_id: string;
  booking_charge_id: string;
  customer_id: string;
  status: string;
  customer_explanation: string;
  resolution_notes: string | null;
  submitted_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
};

type BookingChargeRow = {
  id: string;
  business_id: string;
  booking_id: string;
  charge_type: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  provider_payment_id: string | null;
  paid_at: string | null;
};

type BookingRow = {
  id: string;
  business_id: string;
  customer_id: string | null;
  booking_ref: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
};

type SupabaseResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

export type BookingChargeDisputeSupabaseClient = {
  from(table: string): {
    select(columns: string): unknown;
    insert(values: Record<string, unknown>): unknown;
    update(values: Record<string, unknown>): unknown;
  };
};

type QueryBuilder<T> = {
  eq(column: string, value: string): QueryBuilder<T>;
  select(columns: string): {
    single<U = T>(): Promise<SupabaseResult<U>>;
  };
  maybeSingle<U = T>(): Promise<SupabaseResult<U>>;
  single<U = T>(): Promise<SupabaseResult<U>>;
};

type MutationBuilder<T> = QueryBuilder<T> & {
  select(columns: string): {
    single<U = T>(): Promise<SupabaseResult<U>>;
  };
};

type QueueEmail = (input: QueueBookingEmailInput) => Promise<unknown>;

export class BookingChargeDisputeServiceError extends Error {
  readonly code:
    | "EXPLANATION_REQUIRED"
    | "BOOKING_NOT_FOUND"
    | "CHARGE_NOT_FOUND"
    | "CHARGE_NOT_DISPUTABLE"
    | "DUPLICATE_OPEN_DISPUTE"
    | "DISPUTE_NOT_FOUND"
    | "DISPUTE_NOT_OPEN"
    | "RESOLUTION_NOTES_REQUIRED"
    | "DATABASE_ERROR";
  readonly cause?: unknown;

  constructor(message: string, code: BookingChargeDisputeServiceError["code"], cause?: unknown) {
    super(message);
    this.name = "BookingChargeDisputeServiceError";
    this.code = code;
    this.cause = cause;
  }
}

function clean(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function cleanUsefulExplanation(value: string | null | undefined) {
  const cleaned = clean(value);
  if (!cleaned || cleaned.length < 10) {
    throw new BookingChargeDisputeServiceError(
      "Please explain why you are disputing this charge.",
      "EXPLANATION_REQUIRED",
    );
  }
  return cleaned.slice(0, 2000);
}

function toDispute(row: BookingChargeDisputeRow): BookingChargeDispute {
  return {
    id: row.id,
    businessId: row.business_id,
    bookingId: row.booking_id,
    bookingChargeId: row.booking_charge_id,
    customerId: row.customer_id,
    status: row.status as BookingChargeDisputeStatus,
    customerExplanation: row.customer_explanation,
    resolutionNotes: row.resolution_notes,
    submittedAt: row.submitted_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function query<T>(value: unknown): QueryBuilder<T> {
  return value as QueryBuilder<T>;
}

function mutation<T>(value: unknown): MutationBuilder<T> {
  return value as MutationBuilder<T>;
}

async function getSupabaseClient(options?: { supabase?: BookingChargeDisputeSupabaseClient }) {
  if (options?.supabase) return options.supabase;
  const { supabaseAdmin } = await import("./supabaseAdmin");
  return supabaseAdmin as unknown as BookingChargeDisputeSupabaseClient;
}

async function loadOwnedBooking(input: {
  supabase: BookingChargeDisputeSupabaseClient;
  businessId: string;
  bookingId: string;
  customerId: string;
}) {
  const { data, error } = await query<BookingRow>(
    input.supabase
      .from("bookings")
      .select("id, business_id, customer_id, booking_ref, customer_first_name, customer_last_name, customer_email"),
  )
    .eq("id", input.bookingId)
    .eq("business_id", input.businessId)
    .eq("customer_id", input.customerId)
    .maybeSingle<BookingRow>();

  if (error) throw new BookingChargeDisputeServiceError(error.message, "DATABASE_ERROR", error);
  if (!data) {
    throw new BookingChargeDisputeServiceError("Booking not found.", "BOOKING_NOT_FOUND");
  }
  return data;
}

async function loadDisputableCharge(input: {
  supabase: BookingChargeDisputeSupabaseClient;
  businessId: string;
  bookingId: string;
  bookingChargeId: string;
}) {
  const { data, error } = await query<BookingChargeRow>(
    input.supabase
      .from("booking_charges")
      .select("id, business_id, booking_id, charge_type, description, amount_cents, currency, status, provider_payment_id, paid_at"),
  )
    .eq("id", input.bookingChargeId)
    .eq("business_id", input.businessId)
    .eq("booking_id", input.bookingId)
    .maybeSingle<BookingChargeRow>();

  if (error) throw new BookingChargeDisputeServiceError(error.message, "DATABASE_ERROR", error);
  if (!data) {
    throw new BookingChargeDisputeServiceError("Charge not found.", "CHARGE_NOT_FOUND");
  }
  if (data.status !== "paid") {
    throw new BookingChargeDisputeServiceError(
      "Only paid additional charges can be disputed.",
      "CHARGE_NOT_DISPUTABLE",
    );
  }
  return data;
}

async function loadOpenDispute(input: {
  supabase: BookingChargeDisputeSupabaseClient;
  businessId: string;
  bookingChargeId: string;
}) {
  const { data, error } = await query<BookingChargeDisputeRow>(
    input.supabase
      .from("booking_charge_disputes")
      .select("id, business_id, booking_id, booking_charge_id, customer_id, status, customer_explanation, resolution_notes, submitted_at, resolved_at, resolved_by, created_at, updated_at"),
  )
    .eq("business_id", input.businessId)
    .eq("booking_charge_id", input.bookingChargeId)
    .eq("status", "open")
    .maybeSingle<BookingChargeDisputeRow>();

  if (error) throw new BookingChargeDisputeServiceError(error.message, "DATABASE_ERROR", error);
  return data ? toDispute(data) : null;
}

function formatCustomerName(booking: BookingRow) {
  return [booking.customer_first_name, booking.customer_last_name].filter(Boolean).join(" ").trim() || "Customer";
}

function buildDisputeSubmittedEmail(input: {
  booking: BookingRow;
  charge: BookingChargeRow;
  explanation: string;
}) {
  const label = input.booking.booking_ref ? `booking ${input.booking.booking_ref}` : "your booking";
  const amount = formatUsdFromCents(input.charge.amount_cents);
  const subject = `We received your dispute for ${amount}`;
  const body = [
    `Hi ${formatCustomerName(input.booking)},`,
    "",
    `We received your dispute for the ${amount} additional charge on ${label}.`,
    "",
    "Your explanation:",
    input.explanation,
    "",
    "This dispute has been sent to the business for review. The payment has not been automatically refunded or reversed.",
  ].join("\n");

  return { subject, body };
}

function buildDisputeResolvedEmail(input: {
  booking: BookingRow;
  charge: BookingChargeRow;
  notes: string;
}) {
  const label = input.booking.booking_ref ? `booking ${input.booking.booking_ref}` : "your booking";
  const amount = formatUsdFromCents(input.charge.amount_cents);
  const subject = `Your dispute for ${amount} was reviewed`;
  const body = [
    `Hi ${formatCustomerName(input.booking)},`,
    "",
    `The dispute for the ${amount} additional charge on ${label} has been reviewed.`,
    "",
    "Resolution notes:",
    input.notes,
  ].join("\n");

  return { subject, body };
}

async function queueCustomerEmailSafely(input: {
  enqueue: QueueEmail;
  businessId: string;
  booking: BookingRow;
  bookingChargeId: string;
  template: string;
  subject: string;
  body: string;
  logger: Pick<Console, "error">;
}) {
  const to = clean(input.booking.customer_email);
  if (!to) return;

  try {
    await input.enqueue({
      businessId: input.businessId,
      bookingId: input.booking.id,
      bookingChargeId: input.bookingChargeId,
      template: input.template,
      to,
      subject: input.subject,
      body: input.body,
      provider: "ses",
    });
  } catch (error) {
    input.logger.error("[booking-charge-disputes] customer email queue failed", {
      businessId: input.businessId,
      bookingId: input.booking.id,
      bookingChargeId: input.bookingChargeId,
      template: input.template,
      error,
    });
  }
}

export async function createBookingChargeDispute(
  input: {
    businessId: string;
    customerId: string;
    bookingId: string;
    bookingChargeId: string;
    explanation: string;
  },
  options: {
    supabase?: BookingChargeDisputeSupabaseClient;
    queueBookingEmail?: QueueEmail;
    logger?: Pick<Console, "error">;
  } = {},
) {
  const explanation = cleanUsefulExplanation(input.explanation);
  const supabase = await getSupabaseClient(options);
  const logger = options.logger ?? console;
  const enqueue = options.queueBookingEmail ?? queueBookingEmail;
  const booking = await loadOwnedBooking({ ...input, supabase });
  const charge = await loadDisputableCharge({ ...input, supabase });
  const existing = await loadOpenDispute({
    supabase,
    businessId: input.businessId,
    bookingChargeId: input.bookingChargeId,
  });

  if (existing) {
    throw new BookingChargeDisputeServiceError(
      "An open dispute already exists for this charge.",
      "DUPLICATE_OPEN_DISPUTE",
    );
  }

  const { data, error } = await mutation<BookingChargeDisputeRow>(
    supabase.from("booking_charge_disputes").insert({
      business_id: input.businessId,
      booking_id: input.bookingId,
      booking_charge_id: input.bookingChargeId,
      customer_id: input.customerId,
      status: "open",
      customer_explanation: explanation,
    }),
  )
    .select("id, business_id, booking_id, booking_charge_id, customer_id, status, customer_explanation, resolution_notes, submitted_at, resolved_at, resolved_by, created_at, updated_at")
    .single<BookingChargeDisputeRow>();

  if (error || !data) {
    const duplicate =
      error?.code === "23505" ||
      error?.message?.includes("booking_charge_disputes_one_open_per_charge_idx");
    throw new BookingChargeDisputeServiceError(
      duplicate ? "An open dispute already exists for this charge." : (error?.message ?? "Unable to submit dispute."),
      duplicate ? "DUPLICATE_OPEN_DISPUTE" : "DATABASE_ERROR",
      error,
    );
  }

  const email = buildDisputeSubmittedEmail({ booking, charge, explanation });
  await queueCustomerEmailSafely({
    enqueue,
    businessId: input.businessId,
    booking,
    bookingChargeId: input.bookingChargeId,
    template: "booking_charge_dispute_submitted",
    subject: email.subject,
    body: email.body,
    logger,
  });

  return toDispute(data);
}

export async function resolveBookingChargeDispute(
  input: {
    businessId: string;
    disputeId: string;
    resolvedBy: string;
    resolutionNotes: string;
  },
  options: {
    supabase?: BookingChargeDisputeSupabaseClient;
    queueBookingEmail?: QueueEmail;
    recordEntityHistory?: typeof recordEntityHistory;
    logger?: Pick<Console, "error">;
  } = {},
) {
  const resolutionNotes = clean(input.resolutionNotes);
  if (!resolutionNotes || resolutionNotes.length < 5) {
    throw new BookingChargeDisputeServiceError(
      "Add resolution notes before resolving this dispute.",
      "RESOLUTION_NOTES_REQUIRED",
    );
  }

  const supabase = await getSupabaseClient(options);
  const logger = options.logger ?? console;
  const enqueue = options.queueBookingEmail ?? queueBookingEmail;
  const recordHistory = options.recordEntityHistory ?? recordEntityHistory;
  const current = await query<BookingChargeDisputeRow>(
    supabase
      .from("booking_charge_disputes")
      .select("id, business_id, booking_id, booking_charge_id, customer_id, status, customer_explanation, resolution_notes, submitted_at, resolved_at, resolved_by, created_at, updated_at"),
  )
    .eq("id", input.disputeId)
    .eq("business_id", input.businessId)
    .maybeSingle<BookingChargeDisputeRow>();

  if (current.error) {
    throw new BookingChargeDisputeServiceError(current.error.message, "DATABASE_ERROR", current.error);
  }
  if (!current.data) {
    throw new BookingChargeDisputeServiceError("Dispute not found.", "DISPUTE_NOT_FOUND");
  }
  if (current.data.status !== "open") {
    throw new BookingChargeDisputeServiceError("Only open disputes can be resolved.", "DISPUTE_NOT_OPEN");
  }

  const resolvedAt = new Date().toISOString();
  const { data, error } = await mutation<BookingChargeDisputeRow>(
    supabase
      .from("booking_charge_disputes")
      .update({
        status: "resolved",
        resolution_notes: resolutionNotes,
        resolved_at: resolvedAt,
        resolved_by: input.resolvedBy,
      }),
  )
    .eq("id", input.disputeId)
    .eq("business_id", input.businessId)
    .eq("status", "open")
    .select("id, business_id, booking_id, booking_charge_id, customer_id, status, customer_explanation, resolution_notes, submitted_at, resolved_at, resolved_by, created_at, updated_at")
    .single<BookingChargeDisputeRow>();

  if (error || !data) {
    throw new BookingChargeDisputeServiceError(error?.message ?? "Unable to resolve dispute.", "DATABASE_ERROR", error);
  }

  try {
    await recordHistory(
      supabase as never,
      [
        {
          entityType: "booking",
          entityId: data.booking_id,
          fieldName: "booking_charge_dispute_status",
          oldValue: "open",
          newValue: "resolved",
          changedByType: "admin",
          changedById: input.resolvedBy,
          changeReason: `Resolved dispute ${data.id}`,
        },
      ],
      input.businessId,
    );
  } catch (error) {
    logger.error("[booking-charge-disputes] entity history insert failed", {
      businessId: input.businessId,
      disputeId: input.disputeId,
      error,
    });
  }

  const [bookingResult, chargeResult] = await Promise.all([
    query<BookingRow>(
      supabase
        .from("bookings")
        .select("id, business_id, customer_id, booking_ref, customer_first_name, customer_last_name, customer_email"),
    )
      .eq("id", data.booking_id)
      .eq("business_id", input.businessId)
      .maybeSingle<BookingRow>(),
    query<BookingChargeRow>(
      supabase
        .from("booking_charges")
        .select("id, business_id, booking_id, charge_type, description, amount_cents, currency, status, provider_payment_id, paid_at"),
    )
      .eq("id", data.booking_charge_id)
      .eq("business_id", input.businessId)
      .maybeSingle<BookingChargeRow>(),
  ]);

  if (bookingResult.data && chargeResult.data) {
    const email = buildDisputeResolvedEmail({
      booking: bookingResult.data,
      charge: chargeResult.data,
      notes: resolutionNotes,
    });
    await queueCustomerEmailSafely({
      enqueue,
      businessId: input.businessId,
      booking: bookingResult.data,
      bookingChargeId: data.booking_charge_id,
      template: "booking_charge_dispute_resolved",
      subject: email.subject,
      body: email.body,
      logger,
    });
  }

  return toDispute(data);
}
