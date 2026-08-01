import { isBookingSchemaError } from "../booking-schema.ts";

export type AdminBookingChargeSummary = {
  id: string;
  charge_type:
    | "weight_overage"
    | "damage"
    | "extra_day"
    | "trip_fee"
    | "prohibited_material"
    | "manual_adjustment";
  description: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  evidence_notes: string | null;
  customer_payment_method_id: string | null;
  provider: string | null;
  provider_environment: string | null;
  provider_payment_id: string | null;
  paid_at: string | null;
  failed_at: string | null;
  customer_receipt_email_status: "not_applicable" | "queued" | "sent" | "failed" | null;
  customer_receipt_email_to: string | null;
  customer_receipt_email_message_id: string | null;
  customer_receipt_email_sent_at: string | null;
  customer_receipt_email_failed_at: string | null;
  customer_receipt_email_error: string | null;
  created_at: string;
};

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type QueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  eq(column: string, value: string): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
};

type BookingChargesClient = {
  from(table: "booking_charges"): {
    select(columns: string): QueryBuilder<Record<string, unknown>>;
  };
};

const BASE_BOOKING_CHARGE_SELECT =
  "id, charge_type, description, amount_cents, currency, status, evidence_notes, customer_payment_method_id, provider, provider_environment, provider_payment_id, paid_at, failed_at, created_at";

const BOOKING_CHARGE_SELECT_WITH_RECEIPT =
  `${BASE_BOOKING_CHARGE_SELECT}, customer_receipt_email_status, customer_receipt_email_to, customer_receipt_email_message_id, customer_receipt_email_sent_at, customer_receipt_email_failed_at, customer_receipt_email_error`;

function normalizeBaseBookingCharge(row: Record<string, unknown>): AdminBookingChargeSummary {
  return {
    ...(row as Omit<
      AdminBookingChargeSummary,
      | "customer_receipt_email_status"
      | "customer_receipt_email_to"
      | "customer_receipt_email_message_id"
      | "customer_receipt_email_sent_at"
      | "customer_receipt_email_failed_at"
      | "customer_receipt_email_error"
    >),
    customer_receipt_email_status: null,
    customer_receipt_email_to: null,
    customer_receipt_email_message_id: null,
    customer_receipt_email_sent_at: null,
    customer_receipt_email_failed_at: null,
    customer_receipt_email_error: null,
  };
}

async function queryBookingCharges(input: {
  supabase: BookingChargesClient;
  businessId: string;
  bookingId: string;
  columns: string;
}) {
  return input.supabase
    .from("booking_charges")
    .select(input.columns)
    .eq("business_id", input.businessId)
    .eq("booking_id", input.bookingId)
    .order("created_at", { ascending: false });
}

export async function loadAdminBookingCharges(input: {
  supabase: BookingChargesClient;
  businessId: string;
  bookingId: string;
}): Promise<QueryResult<AdminBookingChargeSummary>> {
  const fullResult = await queryBookingCharges({
    ...input,
    columns: BOOKING_CHARGE_SELECT_WITH_RECEIPT,
  });

  if (!fullResult.error) {
    return {
      data: (fullResult.data ?? []) as AdminBookingChargeSummary[],
      error: null,
    };
  }

  if (!isBookingSchemaError(fullResult.error)) {
    return { data: null, error: fullResult.error };
  }

  const fallbackResult = await queryBookingCharges({
    ...input,
    columns: BASE_BOOKING_CHARGE_SELECT,
  });

  if (fallbackResult.error) {
    return { data: null, error: fallbackResult.error };
  }

  return {
    data: (fallbackResult.data ?? []).map(normalizeBaseBookingCharge),
    error: null,
  };
}
