import test from "node:test";
import assert from "node:assert/strict";

import {
  ExternalBookingChargePaymentServiceError,
  recordExternalBookingChargePayment,
  type ExternalBookingChargePaymentSupabaseClient,
} from "../src/lib/payments/external-booking-charge-payment-service.ts";

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const BOOKING_ID = "22222222-2222-4222-8222-222222222222";
const BOOKING_CHARGE_ID = "33333333-3333-4333-8333-333333333333";
const OPERATOR_ID = "44444444-4444-4444-8444-444444444444";

type MockRow = Record<string, unknown>;
type MockTables = Record<string, MockRow[]>;
type RpcFailureStage = "ambiguous_column" | "charge_update" | "audit_history" | null;

function bookingCharge(overrides: MockRow = {}): MockRow {
  return {
    id: BOOKING_CHARGE_ID,
    business_id: BUSINESS_ID,
    booking_id: BOOKING_ID,
    status: "draft",
    amount_cents: 2500,
    currency: "USD",
    customer_payment_method_id: null,
    provider: null,
    provider_environment: null,
    provider_payment_id: null,
    paid_at: null,
    failed_at: null,
    customer_receipt_email_status: null,
    customer_receipt_email_error: null,
    ...overrides,
  };
}

function defaultTables(overrides: Partial<MockTables> = {}): MockTables {
  return {
    booking_charges: [bookingCharge()],
    booking_payments: [],
    entity_history: [],
    ...overrides,
  };
}

function cloneTables(tables: MockTables): MockTables {
  return Object.fromEntries(
    Object.entries(tables).map(([table, rows]) => [
      table,
      rows.map((row) => ({ ...row })),
    ]),
  );
}

function createMockSupabase(initialTables: MockTables, failureStage: RpcFailureStage = null) {
  const tables = cloneTables(initialTables);

  function runExternalPaymentTransaction(args: Record<string, unknown>) {
    const working = cloneTables(tables);
    const charge = working.booking_charges.find(
      (row) =>
        row.id === args.p_booking_charge_id &&
        row.booking_id === args.p_booking_id &&
        row.business_id === args.p_business_id,
    );

    if (!charge) return { data: null, error: { message: "Charge was not found for this booking." } };
    if (charge.status !== "draft") {
      return {
        data: null,
        error: { message: "External payment can only be recorded for charges that still need approval." },
      };
    }

    if (
      working.booking_payments.some(
        (row) =>
          row.business_id === args.p_business_id &&
          row.booking_id === args.p_booking_id &&
          row.booking_charge_id === args.p_booking_charge_id &&
          row.status === "paid",
      )
    ) {
      return { data: null, error: { message: "A paid payment is already recorded for this charge." } };
    }

    const payment = {
      id: `booking_payments-${working.booking_payments.length + 1}`,
      business_id: args.p_business_id,
      booking_id: args.p_booking_id,
      booking_charge_id: args.p_booking_charge_id,
      provider: "external",
      provider_environment: args.p_provider_environment,
      status: "paid",
      amount_cents: args.p_amount_cents,
      currency: charge.currency ?? "USD",
      provider_payment_id: null,
      provider_order_id: null,
      provider_location_id: null,
      idempotency_key: `external-charge-${String(args.p_booking_charge_id)}`,
      payment_collection_type: "external",
      external_payment_method: args.p_external_payment_method,
      external_reference: args.p_reference,
      external_notes: args.p_notes,
      external_recorded_by: args.p_operator_user_id,
      external_recorded_at: args.p_recorded_at,
      paid_at: `${String(args.p_payment_date)}T12:00:00.000Z`,
      raw_provider_response: null,
    };
    working.booking_payments.push(payment);

    if (failureStage === "ambiguous_column") {
      return {
        data: null,
        error: {
          code: "42702",
          message: 'column reference "booking_charge_id" is ambiguous',
          details: "It could refer to either a PL/pgSQL variable or a table column.",
        },
      };
    }

    if (failureStage === "charge_update") {
      return {
        data: null,
        error: {
          message:
            'new row for relation "booking_charges" violates check constraint "booking_charges_provider_check"',
        },
      };
    }

    Object.assign(charge, {
      status: "paid",
      customer_payment_method_id: null,
      paid_at: payment.paid_at,
      failed_at: null,
      customer_receipt_email_status: "not_applicable",
      customer_receipt_email_error: "External payment recorded by admin.",
    });

    if (failureStage === "audit_history") {
      return { data: null, error: { message: "entity_history insert failed" } };
    }

    working.entity_history.push(
      {
        entity_type: "booking",
        entity_id: args.p_booking_id,
        field_name: "external_charge_payment",
      },
      {
        entity_type: "booking",
        entity_id: args.p_booking_id,
        field_name: "booking_charge_status",
      },
    );

    for (const [table, rows] of Object.entries(working)) {
      tables[table] = rows;
    }

    return {
      data: {
        booking_charge_id: args.p_booking_charge_id,
        booking_payment_id: payment.id,
        paid_at: payment.paid_at,
        recorded_at: args.p_recorded_at,
      },
      error: null,
    };
  }

  const client = {
    rpc(functionName: string, args: Record<string, unknown>) {
      return {
        single: async () => {
          if (functionName !== "record_external_booking_charge_payment") {
            return { data: null, error: { message: `Unknown RPC ${functionName}` } };
          }
          return runExternalPaymentTransaction(args);
        },
      };
    },
  };

  return {
    tables,
    client: client as unknown as ExternalBookingChargePaymentSupabaseClient,
  };
}

function recordExternalPayment(tables: MockTables, failureStage: RpcFailureStage = null) {
  const supabase = createMockSupabase(tables, failureStage);
  const promise = recordExternalBookingChargePayment(
    {
      businessId: BUSINESS_ID,
      bookingId: BOOKING_ID,
      bookingChargeId: BOOKING_CHARGE_ID,
      operatorUserId: OPERATOR_ID,
      paymentMethod: "check",
      amountCents: 2500,
      paymentDate: "2026-07-30",
      reference: "CHK-1001",
      notes: "Collected at pickup.",
      providerEnvironment: "sandbox",
    },
    {
      supabase: supabase.client,
      now: () => new Date("2026-07-30T17:00:00.000Z"),
    },
  );

  return { promise, supabase };
}

test("recordExternalBookingChargePayment records payment, marks charge paid, and writes audit history", async () => {
  const { promise, supabase } = recordExternalPayment(defaultTables());

  const result = await promise;

  assert.equal(result.bookingChargeId, BOOKING_CHARGE_ID);
  assert.equal(result.amountCents, 2500);
  assert.equal(supabase.tables.booking_payments.length, 1);
  assert.equal(supabase.tables.booking_payments[0].provider, "external");
  assert.equal(supabase.tables.booking_payments[0].payment_collection_type, "external");
  assert.equal(supabase.tables.booking_payments[0].external_payment_method, "check");
  assert.equal(supabase.tables.booking_payments[0].external_reference, "CHK-1001");
  assert.equal(supabase.tables.booking_payments[0].external_notes, "Collected at pickup.");
  assert.equal(supabase.tables.booking_payments[0].external_recorded_by, OPERATOR_ID);
  assert.equal(supabase.tables.booking_payments[0].external_recorded_at, "2026-07-30T17:00:00.000Z");
  assert.equal(supabase.tables.booking_payments[0].provider_payment_id, null);
  assert.equal(supabase.tables.booking_payments[0].raw_provider_response, null);
  assert.equal(supabase.tables.booking_charges[0].status, "paid");
  assert.equal(supabase.tables.booking_charges[0].provider, null);
  assert.equal(supabase.tables.booking_charges[0].provider_payment_id, null);
  assert.equal(supabase.tables.booking_charges[0].customer_payment_method_id, null);
  assert.equal(supabase.tables.entity_history.length, 2);
  assert.equal(supabase.tables.entity_history[0].field_name, "external_charge_payment");
  assert.equal(supabase.tables.entity_history[1].field_name, "booking_charge_status");
});

test("recordExternalBookingChargePayment preserves an existing valid booking charge provider value", async () => {
  const { promise, supabase } = recordExternalPayment(
    defaultTables({
      booking_charges: [bookingCharge({ provider: "square", provider_environment: "sandbox" })],
    }),
  );

  await promise;

  assert.equal(supabase.tables.booking_charges[0].provider, "square");
  assert.equal(supabase.tables.booking_charges[0].provider_environment, "sandbox");
  assert.equal(supabase.tables.booking_charges[0].provider_payment_id, null);
});

test("recordExternalBookingChargePayment rolls back the payment insert when charge update fails", async () => {
  const { promise, supabase } = recordExternalPayment(defaultTables(), "charge_update");

  await assert.rejects(
    promise,
    (error) =>
      error instanceof ExternalBookingChargePaymentServiceError &&
      error.code === "DATABASE_ERROR" &&
      error.message === "The external payment could not be recorded. No changes were saved.",
  );
  assert.equal(supabase.tables.booking_payments.length, 0);
  assert.equal(supabase.tables.booking_charges[0].status, "draft");
  assert.equal(supabase.tables.entity_history.length, 0);
});

test("recordExternalBookingChargePayment rolls back payment and charge when audit history fails", async () => {
  const { promise, supabase } = recordExternalPayment(defaultTables(), "audit_history");

  await assert.rejects(
    promise,
    (error) =>
      error instanceof ExternalBookingChargePaymentServiceError &&
      error.code === "DATABASE_ERROR" &&
      error.message === "The external payment could not be recorded. No changes were saved.",
  );
  assert.equal(supabase.tables.booking_payments.length, 0);
  assert.equal(supabase.tables.booking_charges[0].status, "draft");
  assert.equal(supabase.tables.entity_history.length, 0);
});

test("recordExternalBookingChargePayment rejects an already-paid charge without inserting payment", async () => {
  const { promise, supabase } = recordExternalPayment(
    defaultTables({
      booking_charges: [bookingCharge({ status: "paid" })],
    }),
  );

  await assert.rejects(
    promise,
    (error) =>
      error instanceof ExternalBookingChargePaymentServiceError &&
      error.code === "CHARGE_NOT_ELIGIBLE",
  );
  assert.equal(supabase.tables.booking_payments.length, 0);
  assert.equal(supabase.tables.entity_history.length, 0);
});

test("recordExternalBookingChargePayment prevents duplicate paid payments for the same charge", async () => {
  const { promise, supabase } = recordExternalPayment(
    defaultTables({
      booking_payments: [
        {
          id: "existing-payment",
          business_id: BUSINESS_ID,
          booking_id: BOOKING_ID,
          booking_charge_id: BOOKING_CHARGE_ID,
          status: "paid",
          idempotency_key: `external-charge-${BOOKING_CHARGE_ID}`,
        },
      ],
    }),
  );

  await assert.rejects(
    promise,
    (error) =>
      error instanceof ExternalBookingChargePaymentServiceError &&
      error.code === "PAYMENT_ALREADY_RECORDED",
  );
  assert.equal(supabase.tables.booking_payments.length, 1);
  assert.equal(supabase.tables.booking_charges[0].status, "draft");
  assert.equal(supabase.tables.entity_history.length, 0);
});

test("recordExternalBookingChargePayment does not expose raw database constraint errors", async () => {
  const { promise } = recordExternalPayment(defaultTables(), "charge_update");

  await assert.rejects(
    promise,
    (error) =>
      error instanceof ExternalBookingChargePaymentServiceError &&
      !error.message.includes("booking_charges_provider_check") &&
      !error.message.includes("violates check constraint"),
  );
});

test("recordExternalBookingChargePayment does not expose ambiguous RPC column errors", async () => {
  const { promise, supabase } = recordExternalPayment(defaultTables(), "ambiguous_column");

  await assert.rejects(
    promise,
    (error) =>
      error instanceof ExternalBookingChargePaymentServiceError &&
      error.code === "DATABASE_ERROR" &&
      error.message === "The external payment could not be recorded. No changes were saved." &&
      !error.message.includes("booking_charge_id") &&
      !error.message.includes("ambiguous"),
  );
  assert.equal(supabase.tables.booking_payments.length, 0);
  assert.equal(supabase.tables.booking_charges[0].status, "draft");
  assert.equal(supabase.tables.entity_history.length, 0);
});
