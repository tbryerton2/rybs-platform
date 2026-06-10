import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  findBookingMessageByChargeAndTemplate,
  queueBookingEmail,
  setBookingMessageSupabaseClientForTesting,
} from "../src/lib/booking-messages.ts";

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";
const BOOKING_CHARGE_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_BOOKING_CHARGE_ID = "33333333-3333-4333-8333-333333333333";

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

type MockFilter = {
  column: string;
  values: string[];
  operator: "eq" | "in";
};

function baseMessage(overrides: Partial<BookingMessageRow> = {}): BookingMessageRow {
  return {
    id: "message-existing",
    booking_id: BOOKING_ID,
    booking_charge_id: BOOKING_CHARGE_ID,
    channel: "email",
    direction: "outbound",
    template: "post_booking_charge_paid",
    to: "customer@example.com",
    subject: "Additional charge receipt",
    body: "Your saved card was charged.",
    provider: "resend",
    provider_message_id: null,
    status: "queued",
    error: null,
    created_at: "2026-05-29T12:00:00.000Z",
    sent_at: null,
    ...overrides,
  };
}

function matchesFilters(row: BookingMessageRow, filters: MockFilter[]) {
  return filters.every((filter) => {
    const value = row[filter.column as keyof BookingMessageRow];
    return filter.values.includes(String(value));
  });
}

function createMockSupabase(
  initialRows: BookingMessageRow[] = [],
  options: {
    uniqueViolationOnInsert?: boolean;
    revealRowsAfterInsertError?: BookingMessageRow[];
  } = {},
) {
  const rows = initialRows.map((row) => ({ ...row }));
  let insertCount = 0;

  class SelectBuilder {
    filters: MockFilter[] = [];

    eq(column: string, value: string) {
      this.filters.push({ column, values: [value], operator: "eq" });
      return this;
    }

    in(column: string, values: string[]) {
      this.filters.push({ column, values, operator: "in" });
      return this;
    }

    async maybeSingle(): Promise<SupabaseResult<BookingMessageRow>> {
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
        single: async (): Promise<SupabaseResult<BookingMessageRow>> => {
          insertCount += 1;

          if (options.uniqueViolationOnInsert) {
            rows.push(...(options.revealRowsAfterInsertError ?? []).map((row) => ({ ...row })));
            return {
              data: null,
              error: {
                code: "23505",
                message: "duplicate key value violates unique constraint",
              },
            };
          }

          const row = baseMessage({
            id: `message-${insertCount}`,
            booking_id: String(this.values.booking_id),
            booking_charge_id: (this.values.booking_charge_id as string | null) ?? null,
            channel: String(this.values.channel),
            direction: String(this.values.direction),
            template: String(this.values.template),
            to: String(this.values.to),
            subject: String(this.values.subject),
            body: String(this.values.body),
            provider: (this.values.provider as string | null) ?? null,
            provider_message_id: (this.values.provider_message_id as string | null) ?? null,
            status: String(this.values.status),
            error: (this.values.error as string | null) ?? null,
            sent_at: (this.values.sent_at as string | null) ?? null,
          });
          rows.push(row);
          return { data: row, error: null };
        },
      };
    }
  }

  const client = {
    from(table: "booking_messages") {
      assert.equal(table, "booking_messages");
      return {
        select: () => new SelectBuilder(),
        insert: (values: Record<string, unknown>) => new InsertBuilder(values),
      };
    },
  };

  return {
    rows,
    get insertCount() {
      return insertCount;
    },
    client: client as Parameters<typeof setBookingMessageSupabaseClientForTesting>[0],
  };
}

function useMockSupabase(
  initialRows: BookingMessageRow[] = [],
  options?: Parameters<typeof createMockSupabase>[1],
) {
  const mock = createMockSupabase(initialRows, options);
  setBookingMessageSupabaseClientForTesting(mock.client);
  return mock;
}

function validQueueInput() {
  return {
    bookingId: BOOKING_ID,
    template: "booking_confirmed",
    to: "customer@example.com",
    subject: "Your booking is confirmed",
    body: "Booking confirmed.",
  };
}

afterEach(() => {
  setBookingMessageSupabaseClientForTesting(null);
});

test("queueBookingEmail validates required fields", async () => {
  useMockSupabase();

  await assert.rejects(
    () => queueBookingEmail({ ...validQueueInput(), bookingId: "not-a-uuid" }),
    /bookingId must be a valid UUID/,
  );
  await assert.rejects(
    () => queueBookingEmail({ ...validQueueInput(), bookingChargeId: "not-a-uuid" }),
    /bookingChargeId must be a valid UUID/,
  );
  await assert.rejects(
    () => queueBookingEmail({ ...validQueueInput(), template: "   " }),
    /template is required/,
  );
  await assert.rejects(
    () => queueBookingEmail({ ...validQueueInput(), to: "   " }),
    /to is required/,
  );
  await assert.rejects(
    () => queueBookingEmail({ ...validQueueInput(), subject: "   " }),
    /subject is required/,
  );
  await assert.rejects(
    () => queueBookingEmail({ ...validQueueInput(), body: "   " }),
    /body is required/,
  );
});

test("queueBookingEmail inserts a queued outbound email row", async () => {
  const mock = useMockSupabase();

  const message = await queueBookingEmail({
    ...validQueueInput(),
    bookingChargeId: BOOKING_CHARGE_ID,
    template: "post_booking_charge_paid",
    subject: "Additional charge receipt",
    body: "Your saved card was charged.",
  });

  assert.equal(mock.insertCount, 1);
  assert.equal(message.bookingId, BOOKING_ID);
  assert.equal(message.bookingChargeId, BOOKING_CHARGE_ID);
  assert.equal(message.channel, "email");
  assert.equal(message.direction, "outbound");
  assert.equal(message.template, "post_booking_charge_paid");
  assert.equal(message.to, "customer@example.com");
  assert.equal(message.subject, "Additional charge receipt");
  assert.equal(message.body, "Your saved card was charged.");
  assert.equal(message.provider, "resend");
  assert.equal(message.providerMessageId, null);
  assert.equal(message.status, "queued");
  assert.equal(message.error, null);
  assert.equal(message.sentAt, null);
});

test("queueBookingEmail allows provider override", async () => {
  const mock = useMockSupabase();

  const message = await queueBookingEmail({
    ...validQueueInput(),
    provider: "custom-provider",
  });

  assert.equal(mock.insertCount, 1);
  assert.equal(message.provider, "custom-provider");
});

test("findBookingMessageByChargeAndTemplate returns queued or sent matching rows", async () => {
  useMockSupabase([
    baseMessage({ id: "failed-message", status: "failed" }),
    baseMessage({ id: "queued-message", status: "queued" }),
    baseMessage({ id: "other-charge", booking_charge_id: OTHER_BOOKING_CHARGE_ID }),
  ]);

  const found = await findBookingMessageByChargeAndTemplate({
    bookingChargeId: BOOKING_CHARGE_ID,
    template: "post_booking_charge_paid",
  });

  assert.equal(found?.id, "queued-message");

  const missing = await findBookingMessageByChargeAndTemplate({
    bookingChargeId: OTHER_BOOKING_CHARGE_ID,
    template: "different_template",
  });

  assert.equal(missing, null);
});

test("queueBookingEmail returns an existing charge/template message idempotently", async () => {
  const existing = baseMessage({
    id: "existing-receipt",
    subject: "Original receipt",
  });
  const mock = useMockSupabase([existing]);

  const message = await queueBookingEmail({
    ...validQueueInput(),
    bookingChargeId: BOOKING_CHARGE_ID,
    template: "post_booking_charge_paid",
    subject: "Different incoming receipt",
  });

  assert.equal(mock.insertCount, 0);
  assert.equal(message.id, "existing-receipt");
  assert.equal(message.subject, "Original receipt");
});

test("queueBookingEmail handles a unique violation race idempotently", async () => {
  const raced = baseMessage({ id: "raced-receipt" });
  const mock = useMockSupabase([], {
    uniqueViolationOnInsert: true,
    revealRowsAfterInsertError: [raced],
  });

  const message = await queueBookingEmail({
    ...validQueueInput(),
    bookingChargeId: BOOKING_CHARGE_ID,
    template: "post_booking_charge_paid",
    subject: "Additional charge receipt",
  });

  assert.equal(mock.insertCount, 1);
  assert.equal(message.id, "raced-receipt");
  assert.equal(mock.rows.length, 1);
});

test("queueBookingEmail throws when a unique violation cannot be resolved", async () => {
  useMockSupabase([], { uniqueViolationOnInsert: true });

  await assert.rejects(
    () =>
      queueBookingEmail({
        ...validQueueInput(),
        bookingChargeId: BOOKING_CHARGE_ID,
        template: "post_booking_charge_paid",
      }),
    /duplicate key value violates unique constraint/,
  );
});
