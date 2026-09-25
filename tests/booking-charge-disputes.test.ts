import test from "node:test";
import assert from "node:assert/strict";

import {
  BookingChargeDisputeServiceError,
  createBookingChargeDispute,
  resolveBookingChargeDispute,
  type BookingChargeDisputeSupabaseClient,
} from "../src/lib/booking-charge-disputes.ts";
import type { QueueBookingEmailInput } from "../src/lib/booking-messages.ts";

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_BUSINESS_ID = "99999999-9999-4999-8999-999999999999";
const BOOKING_ID = "22222222-2222-4222-8222-222222222222";
const BOOKING_CHARGE_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_CUSTOMER_ID = "55555555-5555-4555-8555-555555555555";
const DISPUTE_ID = "66666666-6666-4666-8666-666666666666";
const ADMIN_USER_ID = "77777777-7777-4777-8777-777777777777";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
type Filter = {
  column: string;
  value: string;
};

function booking(overrides: Row = {}): Row {
  return {
    id: BOOKING_ID,
    business_id: BUSINESS_ID,
    customer_id: CUSTOMER_ID,
    booking_ref: "BK-123456",
    customer_first_name: "Taylor",
    customer_last_name: "Customer",
    customer_email: "customer@example.test",
    ...overrides,
  };
}

function paidCharge(overrides: Row = {}): Row {
  return {
    id: BOOKING_CHARGE_ID,
    business_id: BUSINESS_ID,
    booking_id: BOOKING_ID,
    charge_type: "weight_overage",
    description: "Weight ticket overage",
    amount_cents: 525,
    currency: "USD",
    status: "paid",
    provider_payment_id: "square-payment-1",
    paid_at: "2026-09-15T12:00:00.000Z",
    ...overrides,
  };
}

function dispute(overrides: Row = {}): Row {
  return {
    id: DISPUTE_ID,
    business_id: BUSINESS_ID,
    booking_id: BOOKING_ID,
    booking_charge_id: BOOKING_CHARGE_ID,
    customer_id: CUSTOMER_ID,
    status: "open",
    customer_explanation: "The charge does not match the ticket I received.",
    resolution_notes: null,
    submitted_at: "2026-09-15T12:05:00.000Z",
    resolved_at: null,
    resolved_by: null,
    created_at: "2026-09-15T12:05:00.000Z",
    updated_at: "2026-09-15T12:05:00.000Z",
    ...overrides,
  };
}

function defaultTables(overrides: Partial<Tables> = {}): Tables {
  return {
    bookings: [booking()],
    booking_charges: [paidCharge()],
    booking_charge_disputes: [],
    entity_history: [],
    ...overrides,
  };
}

function matches(row: Row, filters: Filter[]) {
  return filters.every((filter) => row[filter.column] === filter.value);
}

function createMockSupabase(initial: Tables) {
  const tables: Tables = Object.fromEntries(
    Object.entries(initial).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))]),
  );

  class QueryBuilder {
    private readonly table: string;
    private readonly operation: "select" | "insert" | "update";
    private readonly values: Row | null;
    private filters: Filter[] = [];

    constructor(table: string, operation: "select" | "insert" | "update", values: Row | null = null) {
      this.table = table;
      this.operation = operation;
      this.values = values;
    }

    eq(column: string, value: string) {
      this.filters.push({ column, value });
      return this;
    }

    select() {
      return this;
    }

    maybeSingle() {
      const rows = tables[this.table]?.filter((row) => matches(row, this.filters)) ?? [];
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    }

    single() {
      if (this.operation === "insert" && this.values) {
        const now = "2026-09-15T12:10:00.000Z";
        const row = {
          id: `inserted-${tables[this.table].length + 1}`,
          submitted_at: now,
          created_at: now,
          updated_at: now,
          resolved_at: null,
          resolved_by: null,
          resolution_notes: null,
          ...this.values,
        };
        tables[this.table].push(row);
        return Promise.resolve({ data: row, error: null });
      }

      if (this.operation === "update" && this.values) {
        const row = tables[this.table].find((candidate) => matches(candidate, this.filters));
        if (!row) return Promise.resolve({ data: null, error: { message: "No row updated." } });
        Object.assign(row, this.values, { updated_at: "2026-09-15T12:15:00.000Z" });
        return Promise.resolve({ data: row, error: null });
      }

      return this.maybeSingle();
    }
  }

  return {
    tables,
    client: {
      from(table: string) {
        if (!tables[table]) tables[table] = [];
        return {
          select() {
            return new QueryBuilder(table, "select");
          },
          insert(values: Row) {
            return new QueryBuilder(table, "insert", values);
          },
          update(values: Row) {
            return new QueryBuilder(table, "update", values);
          },
        };
      },
    } as BookingChargeDisputeSupabaseClient,
  };
}

test("createBookingChargeDispute records a tenant/customer scoped dispute for a paid additional charge", async () => {
  const mock = createMockSupabase(defaultTables());
  const queued: QueueBookingEmailInput[] = [];

  const result = await createBookingChargeDispute(
    {
      businessId: BUSINESS_ID,
      customerId: CUSTOMER_ID,
      bookingId: BOOKING_ID,
      bookingChargeId: BOOKING_CHARGE_ID,
      explanation: "The charge does not match the ticket I received.",
    },
    {
      supabase: mock.client,
      queueBookingEmail: async (input) => {
        queued.push(input);
      },
    },
  );

  assert.equal(result.businessId, BUSINESS_ID);
  assert.equal(result.customerId, CUSTOMER_ID);
  assert.equal(result.bookingChargeId, BOOKING_CHARGE_ID);
  assert.equal(result.status, "open");
  assert.equal(mock.tables.booking_charge_disputes.length, 1);
  assert.equal(mock.tables.booking_charges[0].status, "paid");
  assert.equal(mock.tables.booking_charges[0].provider_payment_id, "square-payment-1");
  assert.equal(queued.length, 1);
  assert.equal(queued[0].template, "booking_charge_dispute_submitted");
  assert.equal(queued[0].businessId, BUSINESS_ID);
});

test("createBookingChargeDispute rejects another customer's booking", async () => {
  const mock = createMockSupabase(defaultTables());

  await assert.rejects(
    createBookingChargeDispute(
      {
        businessId: BUSINESS_ID,
        customerId: OTHER_CUSTOMER_ID,
        bookingId: BOOKING_ID,
        bookingChargeId: BOOKING_CHARGE_ID,
        explanation: "This is not my charge and should not be visible.",
      },
      { supabase: mock.client, queueBookingEmail: async () => undefined },
    ),
    (error) =>
      error instanceof BookingChargeDisputeServiceError &&
      error.code === "BOOKING_NOT_FOUND",
  );
});

test("createBookingChargeDispute rejects unpaid and cross-tenant charges", async () => {
  const unpaid = createMockSupabase(defaultTables({
    booking_charges: [paidCharge({ status: "pending", provider_payment_id: null, paid_at: null })],
  }));

  await assert.rejects(
    createBookingChargeDispute(
      {
        businessId: BUSINESS_ID,
        customerId: CUSTOMER_ID,
        bookingId: BOOKING_ID,
        bookingChargeId: BOOKING_CHARGE_ID,
        explanation: "This charge is not paid yet and should not be disputable.",
      },
      { supabase: unpaid.client, queueBookingEmail: async () => undefined },
    ),
    (error) =>
      error instanceof BookingChargeDisputeServiceError &&
      error.code === "CHARGE_NOT_DISPUTABLE",
  );

  const otherTenant = createMockSupabase(defaultTables({
    bookings: [booking({ business_id: OTHER_BUSINESS_ID })],
    booking_charges: [paidCharge({ business_id: OTHER_BUSINESS_ID })],
  }));

  await assert.rejects(
    createBookingChargeDispute(
      {
        businessId: BUSINESS_ID,
        customerId: CUSTOMER_ID,
        bookingId: BOOKING_ID,
        bookingChargeId: BOOKING_CHARGE_ID,
        explanation: "This charge belongs to another tenant.",
      },
      { supabase: otherTenant.client, queueBookingEmail: async () => undefined },
    ),
    (error) =>
      error instanceof BookingChargeDisputeServiceError &&
      error.code === "BOOKING_NOT_FOUND",
  );
});

test("createBookingChargeDispute prevents duplicate open disputes", async () => {
  const mock = createMockSupabase(defaultTables({
    booking_charge_disputes: [dispute()],
  }));

  await assert.rejects(
    createBookingChargeDispute(
      {
        businessId: BUSINESS_ID,
        customerId: CUSTOMER_ID,
        bookingId: BOOKING_ID,
        bookingChargeId: BOOKING_CHARGE_ID,
        explanation: "I already have an open dispute.",
      },
      { supabase: mock.client, queueBookingEmail: async () => undefined },
    ),
    (error) =>
      error instanceof BookingChargeDisputeServiceError &&
      error.code === "DUPLICATE_OPEN_DISPUTE",
  );
});

test("resolveBookingChargeDispute records resolution notes without changing the charge", async () => {
  const mock = createMockSupabase(defaultTables({
    booking_charge_disputes: [dispute()],
  }));
  const queued: QueueBookingEmailInput[] = [];
  const history: unknown[] = [];

  const result = await resolveBookingChargeDispute(
    {
      businessId: BUSINESS_ID,
      disputeId: DISPUTE_ID,
      resolvedBy: ADMIN_USER_ID,
      resolutionNotes: "Reviewed the scale ticket and credited the customer manually.",
    },
    {
      supabase: mock.client,
      queueBookingEmail: async (input) => {
        queued.push(input);
      },
      recordEntityHistory: async (_supabase, entries) => {
        history.push(...entries);
      },
    },
  );

  assert.equal(result.status, "resolved");
  assert.equal(result.resolutionNotes, "Reviewed the scale ticket and credited the customer manually.");
  assert.equal(mock.tables.booking_charges[0].status, "paid");
  assert.equal(mock.tables.booking_charges[0].provider_payment_id, "square-payment-1");
  assert.equal(queued.length, 1);
  assert.equal(queued[0].template, "booking_charge_dispute_resolved");
  assert.equal(history.length, 1);
});
