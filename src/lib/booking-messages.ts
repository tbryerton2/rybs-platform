export type BookingMessageStatus = "queued" | "sent" | "failed";

export type StoredBookingMessage = {
  id: string;
  bookingId: string;
  bookingChargeId: string | null;
  channel: "email";
  direction: "outbound";
  template: string;
  to: string;
  subject: string;
  body: string;
  provider: string | null;
  providerMessageId: string | null;
  status: BookingMessageStatus;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
};

export type QueueBookingEmailInput = {
  bookingId: string;
  bookingChargeId?: string | null;
  template: string;
  to: string;
  subject: string;
  body: string;
  provider?: string | null;
};

export type FindBookingMessageByChargeAndTemplateInput = {
  bookingChargeId: string;
  template: string;
};

const BOOKING_MESSAGE_SELECT =
  "id, booking_id, booking_charge_id, channel, direction, template, to, subject, body, provider, provider_message_id, status, error, created_at, sent_at";

type BookingMessageRow = {
  id: string;
  booking_id: string;
  booking_charge_id: string | null;
  channel: string;
  direction: string;
  template: string;
  to: string;
  subject: string;
  body: string;
  provider: string | null;
  provider_message_id: string | null;
  status: string;
  error: string | null;
  created_at: string;
  sent_at: string | null;
};

type SupabaseResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

type BookingMessageSelectQuery<T> = {
  eq(column: string, value: string): BookingMessageSelectQuery<T>;
  in(column: string, values: string[]): BookingMessageSelectQuery<T>;
  maybeSingle<U = T>(): Promise<SupabaseResult<U>>;
};

type BookingMessageInsertQuery<T> = {
  select(columns: string): {
    single<U = T>(): Promise<SupabaseResult<U>>;
  };
};

type BookingMessageTableClient = {
  select(columns: string): BookingMessageSelectQuery<BookingMessageRow>;
  insert(values: Record<string, unknown>): BookingMessageInsertQuery<BookingMessageRow>;
};

type BookingMessageSupabaseClient = {
  from(table: "booking_messages"): BookingMessageTableClient;
};

let supabaseClientForTesting: BookingMessageSupabaseClient | null = null;

export function setBookingMessageSupabaseClientForTesting(client: BookingMessageSupabaseClient | null) {
  supabaseClientForTesting = client;
}

async function getSupabaseClient() {
  if (supabaseClientForTesting) return supabaseClientForTesting;
  const { supabaseAdmin } = await import("./supabaseAdmin");
  return supabaseAdmin as unknown as BookingMessageSupabaseClient;
}

export class BookingMessageServiceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "BookingMessageServiceError";
    this.cause = cause;
  }
}

function clean(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function cleanRequired(value: string | null | undefined, fieldName: string) {
  const cleaned = clean(value);
  if (!cleaned) {
    throw new BookingMessageServiceError(`${fieldName} is required.`);
  }
  return cleaned;
}

function assertUuid(value: string, fieldName: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new BookingMessageServiceError(`${fieldName} must be a valid UUID.`);
  }
}

function normalizeOptionalUuid(value: string | null | undefined, fieldName: string) {
  const cleaned = clean(value);
  if (!cleaned) return null;
  assertUuid(cleaned, fieldName);
  return cleaned;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

function toStoredBookingMessage(row: BookingMessageRow): StoredBookingMessage {
  return {
    id: row.id,
    bookingId: row.booking_id,
    bookingChargeId: row.booking_charge_id,
    channel: "email",
    direction: "outbound",
    template: row.template,
    to: row.to,
    subject: row.subject,
    body: row.body,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    status: row.status as BookingMessageStatus,
    error: row.error,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

async function findByChargeAndTemplate(input: {
  supabase: BookingMessageSupabaseClient;
  bookingChargeId: string;
  template: string;
}) {
  const { data, error } = await input.supabase
    .from("booking_messages")
    .select(BOOKING_MESSAGE_SELECT)
    .eq("booking_charge_id", input.bookingChargeId)
    .eq("template", input.template)
    .in("status", ["queued", "sent"])
    .maybeSingle<BookingMessageRow>();

  if (error) {
    throw new BookingMessageServiceError(error.message, error);
  }

  return data ? toStoredBookingMessage(data) : null;
}

export async function findBookingMessageByChargeAndTemplate(
  input: FindBookingMessageByChargeAndTemplateInput,
) {
  const supabase = await getSupabaseClient();
  const bookingChargeId = cleanRequired(input.bookingChargeId, "bookingChargeId");
  const template = cleanRequired(input.template, "template");

  assertUuid(bookingChargeId, "bookingChargeId");

  return findByChargeAndTemplate({
    supabase,
    bookingChargeId,
    template,
  });
}

export async function queueBookingEmail(input: QueueBookingEmailInput) {
  const supabase = await getSupabaseClient();
  const bookingId = cleanRequired(input.bookingId, "bookingId");
  const bookingChargeId = normalizeOptionalUuid(input.bookingChargeId, "bookingChargeId");
  const template = cleanRequired(input.template, "template");
  const to = cleanRequired(input.to, "to");
  const subject = cleanRequired(input.subject, "subject");
  const body = cleanRequired(input.body, "body");
  const provider = clean(input.provider) ?? "resend";

  assertUuid(bookingId, "bookingId");

  if (bookingChargeId) {
    const existing = await findByChargeAndTemplate({
      supabase,
      bookingChargeId,
      template,
    });

    if (existing) return existing;
  }

  const { data, error } = await supabase
    .from("booking_messages")
    .insert({
      booking_id: bookingId,
      booking_charge_id: bookingChargeId,
      channel: "email",
      direction: "outbound",
      template,
      to,
      subject,
      body,
      provider,
      provider_message_id: null,
      status: "queued",
      error: null,
      sent_at: null,
    })
    .select(BOOKING_MESSAGE_SELECT)
    .single<BookingMessageRow>();

  if (error || !data) {
    if (bookingChargeId && isUniqueViolation(error)) {
      const raced = await findByChargeAndTemplate({
        supabase,
        bookingChargeId,
        template,
      });
      if (raced) return raced;
    }

    throw new BookingMessageServiceError(error?.message ?? "Unable to queue booking email.", error);
  }

  return toStoredBookingMessage(data);
}
