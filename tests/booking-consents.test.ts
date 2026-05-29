import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  findBookingConsent,
  linkBookingConsentsToBooking,
  recordBookingConsent,
  setBookingConsentSupabaseClientForTesting,
  type StoredBookingConsent,
} from "../src/lib/booking-consents.ts";

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_BUSINESS_ID = "11111111-1111-4111-8111-222222222222";
const HOLD_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_HOLD_ID = "22222222-2222-4222-8222-333333333333";
const BOOKING_ID = "33333333-3333-4333-8333-333333333333";
const EXISTING_BOOKING_ID = "33333333-3333-4333-8333-444444444444";
const CUSTOMER_ID = "44444444-4444-4444-8444-444444444444";
const ACCEPTED_AT = "2026-05-29T12:00:00.000Z";

type ConsentRow = {
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

type MockFilter = {
  column: string;
  value: string | null;
  operator: "eq" | "is";
};

function baseRow(overrides: Partial<ConsentRow> = {}): ConsentRow {
  return {
    id: "consent-existing",
    business_id: BUSINESS_ID,
    booking_hold_id: HOLD_ID,
    booking_id: null,
    customer_id: null,
    consent_type: "rental_terms",
    consent_version: "terms-v1",
    consent_text: "I accept the rental terms.",
    accepted_at: ACCEPTED_AT,
    source_page: "confirm",
    ip_address: null,
    user_agent: null,
    created_at: "2026-05-29T12:00:01.000Z",
    updated_at: "2026-05-29T12:00:01.000Z",
    ...overrides,
  };
}

function matchesFilters(row: ConsentRow, filters: MockFilter[]) {
  return filters.every((filter) => {
    const value = row[filter.column as keyof ConsentRow];
    if (filter.operator === "is") return value === filter.value;
    return value === filter.value;
  });
}

function createMockSupabase(initialRows: ConsentRow[] = []) {
  const rows = initialRows.map((row) => ({ ...row }));
  let insertCount = 0;

  class SelectBuilder {
    filters: MockFilter[] = [];

    eq(column: string, value: string) {
      this.filters.push({ column, value, operator: "eq" });
      return this;
    }

    async maybeSingle(): Promise<SupabaseResult<ConsentRow>> {
      return {
        data: rows.find((row) => matchesFilters(row, this.filters)) ?? null,
        error: null,
      };
    }
  }

  class InsertBuilder {
    values: Record<string, unknown>;

    constructor(values: Record<string, unknown>) {
      this.values = values;
    }

    select() {
      return {
        single: async (): Promise<SupabaseResult<ConsentRow>> => {
          insertCount += 1;
          const row = baseRow({
            id: `consent-${insertCount}`,
            business_id: String(this.values.business_id),
            booking_hold_id: (this.values.booking_hold_id as string | null) ?? null,
            booking_id: (this.values.booking_id as string | null) ?? null,
            customer_id: (this.values.customer_id as string | null) ?? null,
            consent_type: String(this.values.consent_type),
            consent_version: String(this.values.consent_version),
            consent_text: String(this.values.consent_text),
            accepted_at: String(this.values.accepted_at),
            source_page: String(this.values.source_page),
            ip_address: (this.values.ip_address as string | null) ?? null,
            user_agent: (this.values.user_agent as string | null) ?? null,
          });
          rows.push(row);
          return { data: row, error: null };
        },
      };
    }
  }

  class UpdateBuilder {
    filters: MockFilter[] = [];
    values: Record<string, unknown>;

    constructor(values: Record<string, unknown>) {
      this.values = values;
    }

    eq(column: string, value: string) {
      this.filters.push({ column, value, operator: "eq" });
      return this;
    }

    is(column: string, value: null) {
      this.filters.push({ column, value, operator: "is" });
      return this;
    }

    select() {
      return {
        returns: async <T>(): Promise<SupabaseResult<T>> => {
          const updated: ConsentRow[] = [];
          for (const row of rows) {
            if (!matchesFilters(row, this.filters)) continue;
            Object.assign(row, this.values);
            updated.push({ ...row });
          }
          return { data: updated as T, error: null };
        },
      };
    }
  }

  const client = {
    from(table: "booking_consents") {
      assert.equal(table, "booking_consents");
      return {
        select: () => new SelectBuilder(),
        insert: (values: Record<string, unknown>) => new InsertBuilder(values),
        update: (values: Record<string, unknown>) => new UpdateBuilder(values),
      };
    },
  };

  return {
    rows,
    get insertCount() {
      return insertCount;
    },
    client: client as Parameters<typeof setBookingConsentSupabaseClientForTesting>[0],
  };
}

function useMockSupabase(initialRows: ConsentRow[] = []) {
  const mock = createMockSupabase(initialRows);
  setBookingConsentSupabaseClientForTesting(mock.client);
  return mock;
}

function validRecordInput() {
  return {
    businessId: BUSINESS_ID,
    bookingHoldId: HOLD_ID,
    consentType: "rental_terms" as const,
    consentVersion: "terms-v1",
    consentText: "I accept the rental terms.",
    acceptedAt: ACCEPTED_AT,
    sourcePage: "confirm" as const,
    ipAddress: "203.0.113.10",
    userAgent: "node-test",
  };
}

afterEach(() => {
  setBookingConsentSupabaseClientForTesting(null);
});

test("recordBookingConsent validates required fields", async () => {
  useMockSupabase();

  await assert.rejects(
    () => recordBookingConsent({ ...validRecordInput(), businessId: "not-a-uuid" }),
    /businessId must be a valid UUID/,
  );
  await assert.rejects(
    () => recordBookingConsent({ ...validRecordInput(), bookingHoldId: "not-a-uuid" }),
    /bookingHoldId must be a valid UUID/,
  );
  await assert.rejects(
    () => recordBookingConsent({ ...validRecordInput(), consentType: "bad" as "rental_terms" }),
    /consentType must be rental_terms or card_on_file/,
  );
  await assert.rejects(
    () => recordBookingConsent({ ...validRecordInput(), sourcePage: "bad" as "confirm" }),
    /sourcePage must be confirm, checkout, or admin/,
  );
  await assert.rejects(
    () => recordBookingConsent({ ...validRecordInput(), consentVersion: "   " }),
    /consentVersion is required/,
  );
  await assert.rejects(
    () => recordBookingConsent({ ...validRecordInput(), consentText: "   " }),
    /consentText is required/,
  );
  await assert.rejects(
    () => recordBookingConsent({ ...validRecordInput(), acceptedAt: "not-a-date" }),
    /acceptedAt must be a valid timestamp/,
  );
});

test("recordBookingConsent inserts a consent row with expected fields", async () => {
  const mock = useMockSupabase();

  const consent = await recordBookingConsent({
    ...validRecordInput(),
    consentType: "card_on_file",
    consentVersion: "cof-v1",
    consentText: "I authorize future documented charges.",
    sourcePage: "checkout",
  });

  assert.equal(mock.insertCount, 1);
  assert.equal(consent.businessId, BUSINESS_ID);
  assert.equal(consent.bookingHoldId, HOLD_ID);
  assert.equal(consent.bookingId, null);
  assert.equal(consent.customerId, null);
  assert.equal(consent.consentType, "card_on_file");
  assert.equal(consent.consentVersion, "cof-v1");
  assert.equal(consent.consentText, "I authorize future documented charges.");
  assert.equal(consent.acceptedAt, ACCEPTED_AT);
  assert.equal(consent.sourcePage, "checkout");
  assert.equal(consent.ipAddress, "203.0.113.10");
  assert.equal(consent.userAgent, "node-test");
});

test("recordBookingConsent returns an existing hold consent idempotently", async () => {
  const existing = baseRow({ id: "existing-consent", consent_text: "Original text." });
  const mock = useMockSupabase([existing]);

  const consent = await recordBookingConsent({
    ...validRecordInput(),
    consentText: "Different incoming text should not create a duplicate.",
  });

  assert.equal(mock.insertCount, 0);
  assert.equal(consent.id, "existing-consent");
  assert.equal(consent.consentText, "Original text.");
});

test("findBookingConsent returns a matching row or null", async () => {
  useMockSupabase([baseRow({ id: "found-consent" })]);

  const foundByHold = await findBookingConsent({
    businessId: BUSINESS_ID,
    bookingHoldId: HOLD_ID,
    consentType: "rental_terms",
    consentVersion: "terms-v1",
  });

  assert.equal(foundByHold?.id, "found-consent");

  const missing = await findBookingConsent({
    businessId: BUSINESS_ID,
    bookingHoldId: OTHER_HOLD_ID,
    consentType: "rental_terms",
    consentVersion: "terms-v1",
  });

  assert.equal(missing, null);
});

test("findBookingConsent can find by booking id", async () => {
  useMockSupabase([
    baseRow({
      id: "booking-consent",
      booking_hold_id: null,
      booking_id: BOOKING_ID,
      consent_type: "card_on_file",
      consent_version: "cof-v1",
    }),
  ]);

  const found = await findBookingConsent({
    businessId: BUSINESS_ID,
    bookingId: BOOKING_ID,
    consentType: "card_on_file",
    consentVersion: "cof-v1",
  });

  assert.equal(found?.id, "booking-consent");
});

test("linkBookingConsentsToBooking updates only unlinked matching hold rows", async () => {
  const mock = useMockSupabase([
    baseRow({ id: "terms-unlinked" }),
    baseRow({
      id: "cof-unlinked",
      consent_type: "card_on_file",
      consent_version: "cof-v1",
      source_page: "checkout",
    }),
    baseRow({
      id: "already-linked",
      booking_id: EXISTING_BOOKING_ID,
      customer_id: "44444444-4444-4444-8444-555555555555",
    }),
    baseRow({ id: "other-hold", booking_hold_id: OTHER_HOLD_ID }),
    baseRow({ id: "other-business", business_id: OTHER_BUSINESS_ID }),
  ]);

  const updated = await linkBookingConsentsToBooking({
    businessId: BUSINESS_ID,
    bookingHoldId: HOLD_ID,
    bookingId: BOOKING_ID,
    customerId: CUSTOMER_ID,
  });

  assert.deepEqual(
    updated.map((row: StoredBookingConsent) => row.id).sort(),
    ["cof-unlinked", "terms-unlinked"],
  );
  assert.equal(mock.rows.find((row) => row.id === "terms-unlinked")?.booking_id, BOOKING_ID);
  assert.equal(mock.rows.find((row) => row.id === "terms-unlinked")?.customer_id, CUSTOMER_ID);
  assert.equal(mock.rows.find((row) => row.id === "cof-unlinked")?.booking_id, BOOKING_ID);
  assert.equal(mock.rows.find((row) => row.id === "cof-unlinked")?.customer_id, CUSTOMER_ID);
  assert.equal(mock.rows.find((row) => row.id === "already-linked")?.booking_id, EXISTING_BOOKING_ID);
  assert.equal(mock.rows.find((row) => row.id === "other-hold")?.booking_id, null);
  assert.equal(mock.rows.find((row) => row.id === "other-business")?.booking_id, null);
});

test("linkBookingConsentsToBooking leaves customer_id untouched when not provided", async () => {
  const mock = useMockSupabase([baseRow({ id: "terms-unlinked", customer_id: CUSTOMER_ID })]);

  const updated = await linkBookingConsentsToBooking({
    businessId: BUSINESS_ID,
    bookingHoldId: HOLD_ID,
    bookingId: BOOKING_ID,
  });

  assert.equal(updated.length, 1);
  assert.equal(updated[0].bookingId, BOOKING_ID);
  assert.equal(updated[0].customerId, CUSTOMER_ID);
  assert.equal(mock.rows[0].customer_id, CUSTOMER_ID);
});
