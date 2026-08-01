import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import { processQueuedBookingMessages } from "../src/lib/messages/process-booking-messages.ts";

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const BOOKING_ID = "22222222-2222-4222-8222-222222222222";
const BOOKING_CHARGE_ID = "33333333-3333-4333-8333-333333333333";

type Row = Record<string, unknown>;
type Filter = { column: string; value: unknown };

const originalEnv = {
  SES_FROM_EMAIL: process.env.SES_FROM_EMAIL,
  SES_REPLY_TO_EMAIL: process.env.SES_REPLY_TO_EMAIL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

function queuedMessage(overrides: Row = {}): Row {
  return {
    id: "message-1",
    business_id: BUSINESS_ID,
    booking_id: BOOKING_ID,
    booking_charge_id: BOOKING_CHARGE_ID,
    channel: "email",
    direction: "outbound",
    template: "post_booking_charge_paid",
    to: "customer@example.com",
    subject: "Additional charge for your dumpster rental",
    body: "Your saved card was charged.",
    provider: "ses",
    provider_message_id: null,
    status: "queued",
    error: null,
    created_at: "2026-06-25T18:00:00.000Z",
    sent_at: null,
    ...overrides,
  };
}

function bookingCharge(overrides: Row = {}): Row {
  return {
    id: BOOKING_CHARGE_ID,
    business_id: BUSINESS_ID,
    booking_id: BOOKING_ID,
    status: "paid",
    customer_receipt_email_status: "queued",
    customer_receipt_email_to: "customer@example.com",
    customer_receipt_email_message_id: "message-1",
    customer_receipt_email_sent_at: null,
    customer_receipt_email_failed_at: null,
    customer_receipt_email_error: null,
    ...overrides,
  };
}

function matches(row: Row, filters: Filter[]) {
  return filters.every((filter) => row[filter.column] === filter.value);
}

function createMockSupabase(initial: { booking_messages?: Row[]; booking_charges?: Row[] }) {
  const tables: Record<string, Row[]> = {
    booking_messages: (initial.booking_messages ?? []).map((row) => ({ ...row })),
    booking_charges: (initial.booking_charges ?? []).map((row) => ({ ...row })),
  };

  class SelectBuilder {
    table: string;
    filters: Filter[] = [];
    limitCount: number | null = null;

    constructor(table: string) {
      this.table = table;
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, value });
      return this;
    }

    limit(count: number) {
      this.limitCount = count;
      return this;
    }

    result() {
      const rows = tables[this.table].filter((row) => matches(row, this.filters));
      return {
        data: this.limitCount == null ? rows : rows.slice(0, this.limitCount),
        error: null,
      };
    }

    then(resolve: (value: { data: Row[]; error: null }) => void) {
      resolve(this.result());
    }
  }

  class UpdateBuilder {
    table: string;
    values: Row;
    filters: Filter[] = [];

    constructor(table: string, values: Row) {
      this.table = table;
      this.values = values;
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, value });
      return this;
    }

    result() {
      for (const row of tables[this.table]) {
        if (matches(row, this.filters)) {
          Object.assign(row, this.values);
        }
      }
      return { data: null, error: null };
    }

    then(resolve: (value: { data: null; error: null }) => void) {
      resolve(this.result());
    }
  }

  const client = {
    from(table: string) {
      return {
        select: () => new SelectBuilder(table),
        update: (values: Row) => new UpdateBuilder(table, values),
      };
    },
  };

  return { tables, client };
}

test("processQueuedBookingMessages sends SES receipt and updates message and charge", async () => {
  process.env.SES_FROM_EMAIL = "bookings@tancanman.com";
  process.env.SES_REPLY_TO_EMAIL = "info@tancanman.com";
  const supabase = createMockSupabase({
    booking_messages: [queuedMessage()],
    booking_charges: [bookingCharge()],
  });
  const sentInputs: unknown[] = [];

  const result = await processQueuedBookingMessages({
    supabase: supabase.client as never,
    now: () => new Date("2026-06-25T18:35:00.000Z"),
    sendSesEmail: async (input) => {
      sentInputs.push(input);
      return { MessageId: "ses-message-1" };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.processed, 1);
  assert.equal(sentInputs.length, 1);
  assert.deepEqual(sentInputs[0], {
    to: "customer@example.com",
    subject: "Additional charge for your dumpster rental",
    text: "Your saved card was charged.",
    html: '<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827; white-space: pre-wrap;">Your saved card was charged.</div>',
    replyTo: "info@tancanman.com",
  });
  assert.equal(supabase.tables.booking_messages[0].status, "sent");
  assert.equal(supabase.tables.booking_messages[0].provider, "ses");
  assert.equal(supabase.tables.booking_messages[0].provider_message_id, "ses-message-1");
  assert.equal(supabase.tables.booking_messages[0].sent_at, "2026-06-25T18:35:00.000Z");
  assert.equal(supabase.tables.booking_charges[0].status, "paid");
  assert.equal(supabase.tables.booking_charges[0].customer_receipt_email_status, "sent");
  assert.equal(supabase.tables.booking_charges[0].customer_receipt_email_sent_at, "2026-06-25T18:35:00.000Z");
  assert.equal(supabase.tables.booking_charges[0].customer_receipt_email_error, null);
});

test("processQueuedBookingMessages tracks SES failure on message and charge without changing paid charge", async () => {
  process.env.SES_FROM_EMAIL = "bookings@tancanman.com";
  process.env.SES_REPLY_TO_EMAIL = "info@tancanman.com";
  const supabase = createMockSupabase({
    booking_messages: [queuedMessage()],
    booking_charges: [bookingCharge()],
  });

  const result = await processQueuedBookingMessages({
    supabase: supabase.client as never,
    now: () => new Date("2026-06-25T18:40:00.000Z"),
    sendSesEmail: async () => {
      throw new Error("SES rejected the message because of a test failure.");
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.processed, 0);
  assert.equal(supabase.tables.booking_messages[0].status, "failed");
  assert.match(String(supabase.tables.booking_messages[0].error), /SES rejected/);
  assert.equal(supabase.tables.booking_charges[0].status, "paid");
  assert.equal(supabase.tables.booking_charges[0].customer_receipt_email_status, "failed");
  assert.equal(supabase.tables.booking_charges[0].customer_receipt_email_failed_at, "2026-06-25T18:40:00.000Z");
  assert.match(String(supabase.tables.booking_charges[0].customer_receipt_email_error), /SES rejected/);
});

test("processQueuedBookingMessages can process only a specific queued message id", async () => {
  process.env.SES_FROM_EMAIL = "bookings@tancanman.com";
  process.env.SES_REPLY_TO_EMAIL = "info@tancanman.com";
  const supabase = createMockSupabase({
    booking_messages: [
      queuedMessage({ id: "message-1" }),
      queuedMessage({
        id: "message-2",
        booking_charge_id: "44444444-4444-4444-8444-444444444444",
        to: "other@example.com",
      }),
    ],
    booking_charges: [
      bookingCharge({ customer_receipt_email_message_id: "message-1" }),
      bookingCharge({
        id: "44444444-4444-4444-8444-444444444444",
        customer_receipt_email_to: "other@example.com",
        customer_receipt_email_message_id: "message-2",
      }),
    ],
  });
  const sentInputs: unknown[] = [];

  const result = await processQueuedBookingMessages({
    supabase: supabase.client as never,
    messageId: "message-1",
    now: () => new Date("2026-06-25T18:45:00.000Z"),
    sendSesEmail: async (input) => {
      sentInputs.push(input);
      return { MessageId: "ses-message-1" };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.processed, 1);
  assert.equal(sentInputs.length, 1);
  assert.equal(supabase.tables.booking_messages[0].status, "sent");
  assert.equal(supabase.tables.booking_messages[1].status, "queued");
  assert.equal(supabase.tables.booking_charges[0].customer_receipt_email_status, "sent");
  assert.equal(supabase.tables.booking_charges[1].customer_receipt_email_status, "queued");
});
