export type BookingConsentType = "rental_terms" | "card_on_file";
export type BookingConsentSourcePage = "confirm" | "checkout" | "admin";

export type StoredBookingConsent = {
  id: string;
  businessId: string;
  bookingHoldId: string | null;
  bookingId: string | null;
  customerId: string | null;
  consentType: BookingConsentType;
  consentVersion: string;
  consentText: string;
  acceptedAt: string;
  sourcePage: BookingConsentSourcePage;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecordBookingConsentInput = {
  businessId: string;
  bookingHoldId: string;
  bookingId?: string | null;
  customerId?: string | null;
  consentType: BookingConsentType;
  consentVersion: string;
  consentText: string;
  acceptedAt: string | Date;
  sourcePage: BookingConsentSourcePage;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type LinkBookingConsentsToBookingInput = {
  businessId: string;
  bookingHoldId: string;
  bookingId: string;
  customerId?: string | null;
};

export type FindBookingConsentInput = {
  businessId: string;
  bookingHoldId?: string | null;
  bookingId?: string | null;
  consentType: BookingConsentType;
  consentVersion: string;
};

const BOOKING_CONSENT_SELECT =
  "id, business_id, booking_hold_id, booking_id, customer_id, consent_type, consent_version, consent_text, accepted_at, source_page, ip_address, user_agent, created_at, updated_at";

type BookingConsentRow = {
  id: string;
  business_id: string;
  booking_hold_id: string | null;
  booking_id: string | null;
  customer_id: string | null;
  consent_type: string;
  consent_version: string;
  consent_text: string;
  accepted_at: string;
  source_page: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

type BookingConsentSelectQuery<T> = {
  eq(column: string, value: string): BookingConsentSelectQuery<T>;
  maybeSingle<U = T>(): Promise<SupabaseResult<U>>;
};

type BookingConsentInsertQuery<T> = {
  select(columns: string): {
    single<U = T>(): Promise<SupabaseResult<U>>;
  };
};

type BookingConsentUpdateQuery<T> = {
  eq(column: string, value: string): BookingConsentUpdateQuery<T>;
  is(column: string, value: null): BookingConsentUpdateQuery<T>;
  select(columns: string): {
    returns<U>(): Promise<SupabaseResult<U>>;
  };
};

type BookingConsentTableClient = {
  select(columns: string): BookingConsentSelectQuery<BookingConsentRow>;
  insert(values: Record<string, unknown>): BookingConsentInsertQuery<BookingConsentRow>;
  update(values: Record<string, unknown>): BookingConsentUpdateQuery<BookingConsentRow[]>;
};

type BookingConsentSupabaseClient = {
  from(table: "booking_consents"): BookingConsentTableClient;
};

let supabaseClientForTesting: BookingConsentSupabaseClient | null = null;

export function setBookingConsentSupabaseClientForTesting(client: BookingConsentSupabaseClient | null) {
  supabaseClientForTesting = client;
}

async function getSupabaseClient() {
  if (supabaseClientForTesting) return supabaseClientForTesting;
  const { supabaseAdmin } = await import("./supabaseAdmin");
  return supabaseAdmin as unknown as BookingConsentSupabaseClient;
}

export class BookingConsentServiceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "BookingConsentServiceError";
    this.cause = cause;
  }
}

function clean(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function cleanRequired(value: string | undefined, fieldName: string) {
  const cleaned = value?.trim();
  if (!cleaned) {
    throw new BookingConsentServiceError(`${fieldName} is required.`);
  }
  return cleaned;
}

function assertUuid(value: string, fieldName: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new BookingConsentServiceError(`${fieldName} must be a valid UUID.`);
  }
}

function normalizeOptionalUuid(value: string | null | undefined, fieldName: string) {
  const cleaned = clean(value);
  if (!cleaned) return null;
  assertUuid(cleaned, fieldName);
  return cleaned;
}

function normalizeConsentType(value: BookingConsentType) {
  if (value !== "rental_terms" && value !== "card_on_file") {
    throw new BookingConsentServiceError("consentType must be rental_terms or card_on_file.");
  }
  return value;
}

function normalizeSourcePage(value: BookingConsentSourcePage) {
  if (value !== "confirm" && value !== "checkout" && value !== "admin") {
    throw new BookingConsentServiceError("sourcePage must be confirm, checkout, or admin.");
  }
  return value;
}

function normalizeAcceptedAt(value: string | Date) {
  const iso = value instanceof Date ? value.toISOString() : value.trim();
  if (!iso || Number.isNaN(Date.parse(iso))) {
    throw new BookingConsentServiceError("acceptedAt must be a valid timestamp.");
  }
  return iso;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

function toStoredBookingConsent(row: BookingConsentRow): StoredBookingConsent {
  return {
    id: row.id,
    businessId: row.business_id,
    bookingHoldId: row.booking_hold_id,
    bookingId: row.booking_id,
    customerId: row.customer_id,
    consentType: row.consent_type as BookingConsentType,
    consentVersion: row.consent_version,
    consentText: row.consent_text,
    acceptedAt: row.accepted_at,
    sourcePage: row.source_page as BookingConsentSourcePage,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findByHold(input: {
  supabase: BookingConsentSupabaseClient;
  businessId: string;
  bookingHoldId: string;
  consentType: BookingConsentType;
  consentVersion: string;
}) {
  const { data, error } = await input.supabase
    .from("booking_consents")
    .select(BOOKING_CONSENT_SELECT)
    .eq("business_id", input.businessId)
    .eq("booking_hold_id", input.bookingHoldId)
    .eq("consent_type", input.consentType)
    .eq("consent_version", input.consentVersion)
    .maybeSingle<BookingConsentRow>();

  if (error) {
    throw new BookingConsentServiceError(error.message, error);
  }

  return data ? toStoredBookingConsent(data) : null;
}

async function findByBooking(input: {
  supabase: BookingConsentSupabaseClient;
  businessId: string;
  bookingId: string;
  consentType: BookingConsentType;
  consentVersion: string;
}) {
  const { data, error } = await input.supabase
    .from("booking_consents")
    .select(BOOKING_CONSENT_SELECT)
    .eq("business_id", input.businessId)
    .eq("booking_id", input.bookingId)
    .eq("consent_type", input.consentType)
    .eq("consent_version", input.consentVersion)
    .maybeSingle<BookingConsentRow>();

  if (error) {
    throw new BookingConsentServiceError(error.message, error);
  }

  return data ? toStoredBookingConsent(data) : null;
}

export async function findBookingConsent(input: FindBookingConsentInput) {
  const supabase = await getSupabaseClient();
  const businessId = cleanRequired(input.businessId, "businessId");
  const bookingHoldId = normalizeOptionalUuid(input.bookingHoldId, "bookingHoldId");
  const bookingId = normalizeOptionalUuid(input.bookingId, "bookingId");
  const consentType = normalizeConsentType(input.consentType);
  const consentVersion = cleanRequired(input.consentVersion, "consentVersion");

  assertUuid(businessId, "businessId");

  if (bookingHoldId) {
    return findByHold({
      supabase,
      businessId,
      bookingHoldId,
      consentType,
      consentVersion,
    });
  }

  if (bookingId) {
    return findByBooking({
      supabase,
      businessId,
      bookingId,
      consentType,
      consentVersion,
    });
  }

  throw new BookingConsentServiceError("bookingHoldId or bookingId is required.");
}

export async function recordBookingConsent(input: RecordBookingConsentInput) {
  const supabase = await getSupabaseClient();
  const businessId = cleanRequired(input.businessId, "businessId");
  const bookingHoldId = cleanRequired(input.bookingHoldId, "bookingHoldId");
  const bookingId = normalizeOptionalUuid(input.bookingId, "bookingId");
  const customerId = normalizeOptionalUuid(input.customerId, "customerId");
  const consentType = normalizeConsentType(input.consentType);
  const consentVersion = cleanRequired(input.consentVersion, "consentVersion");
  const consentText = cleanRequired(input.consentText, "consentText");
  const acceptedAt = normalizeAcceptedAt(input.acceptedAt);
  const sourcePage = normalizeSourcePage(input.sourcePage);
  const ipAddress = clean(input.ipAddress);
  const userAgent = clean(input.userAgent);

  assertUuid(businessId, "businessId");
  assertUuid(bookingHoldId, "bookingHoldId");

  const existing = await findByHold({
    supabase,
    businessId,
    bookingHoldId,
    consentType,
    consentVersion,
  });

  if (existing) return existing;

  const { data, error } = await supabase
    .from("booking_consents")
    .insert({
      business_id: businessId,
      booking_hold_id: bookingHoldId,
      booking_id: bookingId,
      customer_id: customerId,
      consent_type: consentType,
      consent_version: consentVersion,
      consent_text: consentText,
      accepted_at: acceptedAt,
      source_page: sourcePage,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    .select(BOOKING_CONSENT_SELECT)
    .single<BookingConsentRow>();

  if (error || !data) {
    if (isUniqueViolation(error)) {
      const raced = await findByHold({
        supabase,
        businessId,
        bookingHoldId,
        consentType,
        consentVersion,
      });
      if (raced) return raced;
    }

    throw new BookingConsentServiceError(error?.message ?? "Unable to record booking consent.", error);
  }

  return toStoredBookingConsent(data);
}

export async function linkBookingConsentsToBooking(input: LinkBookingConsentsToBookingInput) {
  const supabase = await getSupabaseClient();
  const businessId = cleanRequired(input.businessId, "businessId");
  const bookingHoldId = cleanRequired(input.bookingHoldId, "bookingHoldId");
  const bookingId = cleanRequired(input.bookingId, "bookingId");
  const customerId = normalizeOptionalUuid(input.customerId, "customerId");

  assertUuid(businessId, "businessId");
  assertUuid(bookingHoldId, "bookingHoldId");
  assertUuid(bookingId, "bookingId");

  const update: {
    booking_id: string;
    customer_id?: string;
  } = {
    booking_id: bookingId,
  };

  if (customerId) {
    update.customer_id = customerId;
  }

  const { data, error } = await supabase
    .from("booking_consents")
    .update(update)
    .eq("business_id", businessId)
    .eq("booking_hold_id", bookingHoldId)
    .is("booking_id", null)
    .select(BOOKING_CONSENT_SELECT)
    .returns<BookingConsentRow[]>();

  if (error) {
    throw new BookingConsentServiceError(error.message, error);
  }

  return (data ?? []).map(toStoredBookingConsent);
}
