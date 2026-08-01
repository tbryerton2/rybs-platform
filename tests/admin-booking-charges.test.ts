import test from "node:test";
import assert from "node:assert/strict";

import { loadAdminBookingCharges } from "../src/lib/admin/booking-charges.ts";

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const BOOKING_ID = "22222222-2222-4222-8222-222222222222";

type Row = Record<string, unknown>;
type MockResult = {
  data: Row[] | null;
  error: { message: string } | null;
};

function draftCharge(): Row {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    charge_type: "weight_overage",
    description: "Weight ticket overage",
    amount_cents: 12500,
    currency: "USD",
    status: "draft",
    evidence_notes: "Internal scale ticket note",
    customer_payment_method_id: null,
    provider: null,
    provider_environment: null,
    provider_payment_id: null,
    paid_at: null,
    failed_at: null,
    created_at: "2026-06-25T18:00:00.000Z",
  };
}

function createMockSupabase(resultsBySelect: (columns: string) => MockResult) {
  const selectCalls: string[] = [];

  class QueryBuilder {
    columns: string;

    constructor(columns: string) {
      this.columns = columns;
    }

    eq() {
      return this;
    }

    order() {
      return this;
    }

    then(resolve: (value: MockResult) => void) {
      resolve(resultsBySelect(this.columns));
    }
  }

  return {
    selectCalls,
    client: {
      from(table: string) {
        assert.equal(table, "booking_charges");

        return {
          select(columns: string) {
            selectCalls.push(columns);
            return new QueryBuilder(columns);
          },
        };
      },
    },
  };
}

test("loadAdminBookingCharges falls back to base columns when receipt columns are missing", async () => {
  const mock = createMockSupabase((columns) => {
    if (columns.includes("customer_receipt_email_status")) {
      return {
        data: null,
        error: {
          message: "Could not find the 'customer_receipt_email_status' column of 'booking_charges' in the schema cache",
        },
      };
    }

    return {
      data: [draftCharge()],
      error: null,
    };
  });

  const result = await loadAdminBookingCharges({
    supabase: mock.client as never,
    businessId: BUSINESS_ID,
    bookingId: BOOKING_ID,
  });

  assert.equal(result.error, null);
  assert.equal(result.data?.length, 1);
  assert.equal(result.data?.[0]?.status, "draft");
  assert.equal(result.data?.[0]?.description, "Weight ticket overage");
  assert.equal(result.data?.[0]?.customer_receipt_email_status, null);
  assert.equal(result.data?.[0]?.customer_receipt_email_to, null);
  assert.equal(result.data?.[0]?.customer_receipt_email_message_id, null);
  assert.equal(mock.selectCalls.length, 2);
  assert.match(mock.selectCalls[0], /customer_receipt_email_status/);
  assert.doesNotMatch(mock.selectCalls[1], /customer_receipt_email_status/);
});

test("loadAdminBookingCharges keeps receipt fields when full query succeeds", async () => {
  const mock = createMockSupabase(() => ({
    data: [
      {
        ...draftCharge(),
        status: "paid",
        customer_receipt_email_status: "sent",
        customer_receipt_email_to: "customer@example.com",
        customer_receipt_email_message_id: "44444444-4444-4444-8444-444444444444",
        customer_receipt_email_sent_at: "2026-06-25T19:00:00.000Z",
        customer_receipt_email_failed_at: null,
        customer_receipt_email_error: null,
      },
    ],
    error: null,
  }));

  const result = await loadAdminBookingCharges({
    supabase: mock.client as never,
    businessId: BUSINESS_ID,
    bookingId: BOOKING_ID,
  });

  assert.equal(result.error, null);
  assert.equal(result.data?.length, 1);
  assert.equal(result.data?.[0]?.status, "paid");
  assert.equal(result.data?.[0]?.customer_receipt_email_status, "sent");
  assert.equal(result.data?.[0]?.customer_receipt_email_to, "customer@example.com");
  assert.equal(mock.selectCalls.length, 1);
});
