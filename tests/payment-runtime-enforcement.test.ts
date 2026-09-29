import test from "node:test";
import assert from "node:assert/strict";

import { createCheckoutPayment } from "../src/lib/payments/payment-service.ts";
import { TenantPaymentProviderConnectionError } from "../src/lib/payments/tenant-payment-provider-connections.ts";
import type { PaymentProviderAdapter, PaymentProviderChargeInput } from "../src/lib/payments/types.ts";

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const BOOKING_HOLD_ID = "22222222-2222-4222-8222-222222222222";
const PAYMENT_ID = "33333333-3333-4333-8333-333333333333";

type MockRow = Record<string, unknown>;
type Filter = { column: string; value: unknown };

function matches(row: MockRow, filters: Filter[]) {
  return filters.every((filter) => row[filter.column] === filter.value);
}

function paymentSetting(mode: "disabled" | "sandbox" | "production"): MockRow {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    business_id: BUSINESS_ID,
    provider: "square",
    mode,
    updated_by: null,
    created_at: "2026-09-29T00:00:00.000Z",
    updated_at: "2026-09-29T00:00:00.000Z",
  };
}

function bookingPayment(overrides: MockRow = {}): MockRow {
  return {
    id: PAYMENT_ID,
    business_id: BUSINESS_ID,
    booking_hold_id: BOOKING_HOLD_ID,
    booking_id: null,
    provider: "square",
    provider_environment: "sandbox",
    status: "paid",
    amount_cents: 12345,
    currency: "USD",
    provider_payment_id: "square-payment-existing",
    provider_order_id: "square-order-existing",
    provider_location_id: "sandbox-location",
    idempotency_key: "checkout-retry-key",
    failure_code: null,
    failure_message: null,
    raw_provider_response: null,
    paid_at: "2026-09-29T00:01:00.000Z",
    failed_at: null,
    created_at: "2026-09-29T00:00:00.000Z",
    updated_at: "2026-09-29T00:01:00.000Z",
    ...overrides,
  };
}

function createMockSupabase(tables: {
  tenant_payment_settings?: MockRow[];
  tenant_payment_provider_connections?: MockRow[];
  booking_payments?: MockRow[];
}) {
  const data = {
    tenant_payment_settings: [...(tables.tenant_payment_settings ?? [])],
    tenant_payment_provider_connections: [...(tables.tenant_payment_provider_connections ?? [])],
    booking_payments: [...(tables.booking_payments ?? [])],
  };
  const insertedPayments: MockRow[] = [];

  class QueryBuilder {
    filters: Filter[] = [];
    table: keyof typeof data;
    updateValues: MockRow | null;

    constructor(table: keyof typeof data, updateValues: MockRow | null = null) {
      this.table = table;
      this.updateValues = updateValues;
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, value });
      return this;
    }

    order() {
      return this;
    }

    limit() {
      return this;
    }

    maybeSingle() {
      return Promise.resolve({
        data: data[this.table].find((row) => matches(row, this.filters)) ?? null,
        error: null,
      });
    }

    single() {
      const row = data[this.table].find((candidate) => matches(candidate, this.filters));
      if (!row) return Promise.resolve({ data: null, error: { message: "No row found" } });
      if (this.updateValues) Object.assign(row, this.updateValues);
      return Promise.resolve({ data: { ...row }, error: null });
    }

    select() {
      return {
        single: () => this.single(),
      };
    }
  }

  class InsertBuilder {
    table: keyof typeof data;
    values: MockRow;

    constructor(table: keyof typeof data, values: MockRow) {
      this.table = table;
      this.values = values;
    }

    select() {
      return {
        single: () => {
          if (this.table === "booking_payments") {
            const existing = data.booking_payments.find(
              (row) => row.idempotency_key === this.values.idempotency_key,
            );
            if (existing) {
              return Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key" } });
            }

            const row = bookingPayment({
              id: PAYMENT_ID,
              created_at: "2026-09-29T00:00:00.000Z",
              updated_at: "2026-09-29T00:00:00.000Z",
              ...this.values,
            });
            data.booking_payments.push(row);
            insertedPayments.push(row);
            return Promise.resolve({ data: { ...row }, error: null });
          }

          return Promise.resolve({ data: null, error: { message: `Unexpected insert into ${this.table}` } });
        },
      };
    }
  }

  const client = {
    from(table: keyof typeof data) {
      return {
        select: () => new QueryBuilder(table),
        insert: (values: MockRow) => new InsertBuilder(table, values),
        update: (values: MockRow) => new QueryBuilder(table, values),
      };
    },
  };

  return { client, data, insertedPayments };
}

function createAdapter(environment: "sandbox" | "production", providerLocationId: string) {
  const calls: PaymentProviderChargeInput[] = [];
  const adapter: PaymentProviderAdapter = {
    provider: "square",
    environment,
    paymentProviderConnectionId: "55555555-5555-4555-8555-555555555555",
    providerMerchantId: "merchant-1",
    providerLocationId,
    connectionMode: "tenant_connection",
    async charge(input) {
      calls.push(input);
      return {
        status: "paid",
        providerPaymentId: "square-payment-1",
        providerOrderId: "square-order-1",
        providerLocationId,
        paymentProviderConnectionId: adapter.paymentProviderConnectionId,
        providerMerchantId: adapter.providerMerchantId,
        rawProviderResponse: { ok: true },
        paidAt: "2026-09-29T00:02:00.000Z",
      };
    },
  };

  return { adapter, calls };
}

test("disabled tenant payment mode rejects checkout before payment insert or provider call", async () => {
  const supabase = createMockSupabase({
    tenant_payment_settings: [paymentSetting("disabled")],
    booking_payments: [],
  });

  await assert.rejects(
    () =>
      createCheckoutPayment(
        {
          businessId: BUSINESS_ID,
          bookingHoldId: BOOKING_HOLD_ID,
          amountCents: 12345,
          paymentMethodToken: "cnon:card-token",
          idempotencyKey: "checkout-disabled-key",
        },
        { supabase: supabase.client },
      ),
    (error) =>
      error instanceof TenantPaymentProviderConnectionError &&
      error.code === "TENANT_PAYMENT_POLICY_DISABLED",
  );

  assert.equal(supabase.insertedPayments.length, 0);
});

test("checkout preserves idempotent paid-payment reuse without calling the provider", async () => {
  const supabase = createMockSupabase({
    booking_payments: [bookingPayment()],
  });
  const { adapter, calls } = createAdapter("sandbox", "sandbox-location");

  const result = await createCheckoutPayment(
    {
      businessId: BUSINESS_ID,
      bookingHoldId: BOOKING_HOLD_ID,
      amountCents: 12345,
      paymentMethodToken: "cnon:card-token",
      idempotencyKey: "checkout-retry-key",
    },
    { supabase: supabase.client, adapter },
  );

  assert.equal(result.ok, true);
  assert.equal(result.providerPaymentId, "square-payment-existing");
  assert.equal(result.providerLocationId, "sandbox-location");
  assert.equal(calls.length, 0);
});

test("checkout records selected adapter environment and provider location", async () => {
  const supabase = createMockSupabase({ booking_payments: [] });
  const { adapter, calls } = createAdapter("production", "live-location");

  const result = await createCheckoutPayment(
    {
      businessId: BUSINESS_ID,
      bookingHoldId: BOOKING_HOLD_ID,
      amountCents: 12345,
      paymentMethodToken: "cnon:card-token",
      idempotencyKey: "checkout-live-key",
    },
    { supabase: supabase.client, adapter },
  );

  assert.equal(result.ok, true);
  assert.equal(result.providerEnvironment, "production");
  assert.equal(result.providerLocationId, "live-location");
  assert.equal(calls.length, 1);
  assert.equal(supabase.data.booking_payments[0].provider_environment, "production");
  assert.equal(supabase.data.booking_payments[0].provider_location_id, "live-location");
});
