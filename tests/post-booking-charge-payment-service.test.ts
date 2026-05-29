import test from "node:test";
import assert from "node:assert/strict";

import {
  chargePendingBookingChargeWithSavedCard,
  PostBookingChargePaymentServiceError,
  type PostBookingChargePaymentSupabaseClient,
} from "../src/lib/payments/post-booking-charge-payment-service.ts";
import type { PaymentProviderAdapter, PaymentProviderChargeInput } from "../src/lib/payments/types.ts";

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const BOOKING_ID = "22222222-2222-4222-8222-222222222222";
const BOOKING_CHARGE_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "44444444-4444-4444-8444-444444444444";
const PAYMENT_METHOD_ID = "55555555-5555-4555-8555-555555555555";
const ACCEPTED_AT = "2026-05-29T12:00:00.000Z";

type MockRow = Record<string, unknown>;
type MockTables = Record<string, MockRow[]>;
type MockFilter = {
  column: string;
  value: string;
};
type MockOrder = {
  column: string;
  ascending: boolean;
};

function bookingCharge(overrides: MockRow = {}): MockRow {
  return {
    id: BOOKING_CHARGE_ID,
    business_id: BUSINESS_ID,
    booking_id: BOOKING_ID,
    customer_payment_method_id: null,
    charge_type: "weight_overage",
    description: "Weight overage documented after pickup",
    amount_cents: 2500,
    currency: "USD",
    status: "pending",
    provider: null,
    provider_environment: null,
    provider_payment_id: null,
    paid_at: null,
    failed_at: null,
    created_at: "2026-05-29T12:00:01.000Z",
    updated_at: "2026-05-29T12:00:01.000Z",
    ...overrides,
  };
}

function booking(overrides: MockRow = {}): MockRow {
  return {
    id: BOOKING_ID,
    customer_id: CUSTOMER_ID,
    booking_ref: "BK-123456",
    ...overrides,
  };
}

function cardOnFileConsent(overrides: MockRow = {}): MockRow {
  return {
    id: "consent-card-on-file",
    business_id: BUSINESS_ID,
    booking_id: BOOKING_ID,
    customer_id: CUSTOMER_ID,
    consent_type: "card_on_file",
    accepted_at: ACCEPTED_AT,
    ...overrides,
  };
}

function customerPaymentMethod(overrides: MockRow = {}): MockRow {
  return {
    id: PAYMENT_METHOD_ID,
    business_id: BUSINESS_ID,
    customer_id: CUSTOMER_ID,
    customer_provider_account_id: "66666666-6666-4666-8666-666666666666",
    provider: "square",
    provider_environment: "sandbox",
    provider_customer_id: "square-customer-1",
    provider_payment_method_id: "ccof:saved-card-1",
    card_brand: "VISA",
    card_last_4: "1111",
    card_exp_month: 12,
    card_exp_year: 2030,
    status: "active",
    consent_text: "I authorize future documented charges.",
    consent_accepted_at: ACCEPTED_AT,
    created_at: "2026-05-29T12:00:02.000Z",
    updated_at: "2026-05-29T12:00:02.000Z",
    ...overrides,
  };
}

function bookingPayment(overrides: MockRow = {}): MockRow {
  return {
    id: "77777777-7777-4777-8777-777777777777",
    business_id: BUSINESS_ID,
    booking_hold_id: null,
    booking_id: BOOKING_ID,
    booking_charge_id: BOOKING_CHARGE_ID,
    provider: "square",
    provider_environment: "sandbox",
    status: "pending",
    amount_cents: 2500,
    currency: "USD",
    provider_payment_id: null,
    provider_order_id: null,
    provider_location_id: null,
    idempotency_key: `post-booking-charge:${BOOKING_CHARGE_ID}`,
    failure_code: null,
    failure_message: null,
    raw_provider_response: null,
    paid_at: null,
    failed_at: null,
    created_at: "2026-05-29T12:00:03.000Z",
    updated_at: "2026-05-29T12:00:03.000Z",
    ...overrides,
  };
}

function defaultTables(overrides: Partial<MockTables> = {}): MockTables {
  return {
    booking_charges: [bookingCharge()],
    bookings: [booking()],
    booking_consents: [cardOnFileConsent()],
    customer_payment_methods: [customerPaymentMethod()],
    booking_payments: [],
    ...overrides,
  };
}

function matches(row: MockRow, filters: MockFilter[]) {
  return filters.every((filter) => row[filter.column] === filter.value);
}

function applyQuery(rows: MockRow[], filters: MockFilter[], orders: MockOrder[], limitCount: number | null) {
  let result = rows.filter((row) => matches(row, filters)).map((row) => row);

  for (const order of [...orders].reverse()) {
    result = result.sort((left, right) => {
      const leftValue = String(left[order.column] ?? "");
      const rightValue = String(right[order.column] ?? "");
      return order.ascending
        ? leftValue.localeCompare(rightValue)
        : rightValue.localeCompare(leftValue);
    });
  }

  return limitCount == null ? result : result.slice(0, limitCount);
}

function createMockSupabase(initialTables: MockTables) {
  const tables: MockTables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [
      table,
      rows.map((row) => ({ ...row })),
    ]),
  );
  let paymentInsertCount = 0;

  class QueryBuilder {
    filters: MockFilter[] = [];
    orders: MockOrder[] = [];
    limitCount: number | null = null;
    table: string;
    updateValues: MockRow | null;

    constructor(table: string, updateValues: MockRow | null = null) {
      this.table = table;
      this.updateValues = updateValues;
    }

    eq(column: string, value: string) {
      this.filters.push({ column, value });
      return this;
    }

    order(column: string, options: { ascending?: boolean } = {}) {
      this.orders.push({ column, ascending: options.ascending ?? true });
      return this;
    }

    limit(count: number) {
      this.limitCount = count;
      return this;
    }

    maybeSingle() {
      const rows = applyQuery(tables[this.table] ?? [], this.filters, this.orders, this.limitCount);
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    }

    single() {
      if (this.updateValues) {
        const row = (tables[this.table] ?? []).find((candidate) => matches(candidate, this.filters));
        if (!row) {
          return Promise.resolve({ data: null, error: { message: "No row found" } });
        }
        Object.assign(row, this.updateValues);
        return Promise.resolve({ data: { ...row }, error: null });
      }

      const rows = applyQuery(tables[this.table] ?? [], this.filters, this.orders, this.limitCount);
      return Promise.resolve({ data: rows[0] ?? null, error: rows[0] ? null : { message: "No row found" } });
    }

    select() {
      return {
        single: () => this.single(),
      };
    }
  }

  class InsertBuilder {
    table: string;
    values: MockRow;

    constructor(table: string, values: MockRow) {
      this.table = table;
      this.values = values;
    }

    select() {
      return {
        single: () => {
          if (this.table === "booking_payments") {
            paymentInsertCount += 1;
            const row = bookingPayment({
              id: `77777777-7777-4777-8777-${String(paymentInsertCount).padStart(12, "0")}`,
              ...this.values,
            });
            tables.booking_payments.push(row);
            return Promise.resolve({ data: { ...row }, error: null });
          }

          const row = { ...this.values };
          tables[this.table].push(row);
          return Promise.resolve({ data: row, error: null });
        },
      };
    }
  }

  const client = {
    from(table: string) {
      return {
        select: () => new QueryBuilder(table),
        insert: (values: MockRow) => new InsertBuilder(table, values),
        update: (values: MockRow) => new QueryBuilder(table, values),
      };
    },
  };

  return {
    tables,
    client,
  };
}

function createAdapter(result: "paid" | "failed" = "paid") {
  const calls: PaymentProviderChargeInput[] = [];
  const adapter: PaymentProviderAdapter = {
    provider: "square",
    environment: "sandbox",
    async charge(input) {
      calls.push(input);
      if (result === "failed") {
        return {
          status: "failed",
          providerLocationId: "square-location-1",
          failedAt: "2026-05-29T12:01:00.000Z",
          failureCode: "CARD_DECLINED",
          failureMessage: "Card declined.",
          rawProviderResponse: { status: "failed" },
        };
      }

      return {
        status: "paid",
        providerPaymentId: "square-payment-1",
        providerOrderId: "square-order-1",
        providerLocationId: "square-location-1",
        paidAt: "2026-05-29T12:01:00.000Z",
        rawProviderResponse: { status: "paid" },
      };
    },
  };

  return { adapter, calls };
}

async function callService(
  tables: MockTables,
  adapterResult: "paid" | "failed" = "paid",
) {
  const supabase = createMockSupabase(tables);
  const adapter = createAdapter(adapterResult);

  const promise = chargePendingBookingChargeWithSavedCard(
    {
      businessId: BUSINESS_ID,
      bookingId: BOOKING_ID,
      bookingChargeId: BOOKING_CHARGE_ID,
    },
    {
      supabase: supabase.client as unknown as PostBookingChargePaymentSupabaseClient,
      adapter: adapter.adapter,
      now: () => new Date("2026-05-29T12:02:00.000Z"),
    },
  );

  return { promise, supabase, adapter };
}

test("chargePendingBookingChargeWithSavedCard rejects a missing charge without calling the provider", async () => {
  const { promise, adapter } = await callService(defaultTables({ booking_charges: [] }));

  await assert.rejects(promise, /Pending charge was not found/);
  assert.equal(adapter.calls.length, 0);
});

test("chargePendingBookingChargeWithSavedCard rejects a charge that is not pending", async () => {
  const { promise, adapter } = await callService(
    defaultTables({ booking_charges: [bookingCharge({ status: "draft" })] }),
  );

  await assert.rejects(promise, /Only charges marked ready to charge/);
  assert.equal(adapter.calls.length, 0);
});

test("chargePendingBookingChargeWithSavedCard requires card-on-file consent", async () => {
  const { promise, adapter } = await callService(defaultTables({ booking_consents: [] }));

  await assert.rejects(promise, /Card-on-file authorization was not found/);
  assert.equal(adapter.calls.length, 0);
});

test("chargePendingBookingChargeWithSavedCard requires an active saved card", async () => {
  const { promise, adapter } = await callService(defaultTables({ customer_payment_methods: [] }));

  await assert.rejects(promise, /No active saved card/);
  assert.equal(adapter.calls.length, 0);
});

test("chargePendingBookingChargeWithSavedCard returns an existing paid payment without calling the provider", async () => {
  const { promise, adapter } = await callService(
    defaultTables({
      booking_charges: [bookingCharge({ status: "paid" })],
      booking_payments: [
        bookingPayment({
          status: "paid",
          provider_payment_id: "existing-square-payment",
          paid_at: "2026-05-29T12:00:00.000Z",
        }),
      ],
    }),
  );

  const result = await promise;

  assert.equal(result.ok, true);
  assert.equal(result.reusedExistingPaidPayment, true);
  assert.equal(result.providerPaymentId, "existing-square-payment");
  assert.equal(adapter.calls.length, 0);
});

test("chargePendingBookingChargeWithSavedCard charges the saved card and marks charge paid", async () => {
  const { promise, supabase, adapter } = await callService(defaultTables());

  const result = await promise;

  assert.equal(result.ok, true);
  assert.equal(result.status, "paid");
  assert.equal(result.providerPaymentId, "square-payment-1");
  assert.equal(result.customerPaymentMethodId, PAYMENT_METHOD_ID);
  assert.equal(adapter.calls.length, 1);
  assert.equal(adapter.calls[0].paymentSourceId, "ccof:saved-card-1");
  assert.equal(adapter.calls[0].providerCustomerId, "square-customer-1");
  assert.equal(adapter.calls[0].idempotencyKey, "77777777-7777-4777-8777-000000000001");
  assert.ok(adapter.calls[0].idempotencyKey.length <= 45);
  assert.ok(adapter.calls[0].description);
  assert.ok(adapter.calls[0].description.length <= 45);
  assert.match(adapter.calls[0].description, /^BK-123456:/);
  assert.equal(supabase.tables.booking_payments[0].status, "paid");
  assert.equal(supabase.tables.booking_payments[0].booking_charge_id, BOOKING_CHARGE_ID);
  assert.equal(supabase.tables.booking_charges[0].status, "paid");
  assert.equal(supabase.tables.booking_charges[0].customer_payment_method_id, PAYMENT_METHOD_ID);
  assert.equal(supabase.tables.booking_charges[0].provider_payment_id, "square-payment-1");
});

test("chargePendingBookingChargeWithSavedCard marks payment and charge failed when provider fails", async () => {
  const { promise, supabase, adapter } = await callService(defaultTables(), "failed");

  await assert.rejects(
    promise,
    (error) =>
      error instanceof PostBookingChargePaymentServiceError &&
      error.code === "PROVIDER_CHARGE_FAILED" &&
      error.result?.status === "failed",
  );

  assert.equal(adapter.calls.length, 1);
  assert.equal(supabase.tables.booking_payments[0].status, "failed");
  assert.equal(supabase.tables.booking_payments[0].failure_code, "CARD_DECLINED");
  assert.equal(supabase.tables.booking_charges[0].status, "failed");
  assert.equal(supabase.tables.booking_charges[0].customer_payment_method_id, PAYMENT_METHOD_ID);
  assert.equal(supabase.tables.booking_charges[0].provider, "square");
  assert.equal(supabase.tables.booking_charges[0].provider_environment, "sandbox");
});
