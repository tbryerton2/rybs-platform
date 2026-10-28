import { formatInputDateET } from "@/lib/time";

export const COMPLETION_OPTIONS = [
  { key: "all", label: "All jobs" },
  { key: "completed", label: "Completed jobs" },
  { key: "uncompleted", label: "Uncompleted jobs" },
] as const;
export type CompletionFilter = (typeof COMPLETION_OPTIONS)[number]["key"];

export function parseCompletionFilter(value: string | null | undefined): CompletionFilter {
  return value === "completed" || value === "uncompleted" ? value : "all";
}

export type CollectionBooking = {
  id: string;
  business_id: string;
  booking_ref: string | null;
  status: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string | null;
  pickup_date: string | null;
};

export type CollectionPayment = {
  id: string;
  business_id: string;
  booking_id: string | null;
  status: string;
  amount_cents: number;
  currency: string;
  paid_at: string | null;
  provider: string;
  raw_provider_response: unknown;
  booking: CollectionBooking | null;
};

export type CollectionRow = {
  id: string;
  booking: CollectionBooking | null;
  paid_at: string;
  payment_date: string;
  collected_cents: number;
  refunded_cents: number;
  net_cents: number;
};

export type CollectionFilters = {
  completion?: CompletionFilter;
  start?: string;
  end?: string;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

// SDK responses use camelCase; stored Square webhook events use snake_case.
function recordedRefundCents(payment: CollectionPayment): number | null {
  if (payment.status === "refunded") return payment.amount_cents;
  if (payment.provider !== "square") return payment.status === "partially_refunded" ? null : 0;
  const raw = record(payment.raw_provider_response);
  const squarePayment = record(raw.payment ?? record(record(raw.data).object).payment);
  const money = record(squarePayment.refundedMoney ?? squarePayment.refunded_money);
  if (money.amount === undefined) return payment.status === "partially_refunded" ? null : 0;
  if (money.currency !== payment.currency) return null;
  const amount = typeof money.amount === "string" && /^\d+$/.test(money.amount)
    ? Number(money.amount) : money.amount;
  return typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0 && amount <= payment.amount_cents
    ? amount : null;
}

export function buildCollectionsReport(
  payments: CollectionPayment[], businessId: string, filters: CollectionFilters = {},
) {
  const rows: CollectionRow[] = [];
  let incompletePayments = 0;
  const seen = new Set<string>();
  for (const payment of payments) {
    if (payment.business_id !== businessId || seen.has(payment.id)) continue;
    seen.add(payment.id);
    if (!["paid", "refunded", "partially_refunded"].includes(payment.status)) continue;
    // Never expose a related booking from a different business, even if linked incorrectly.
    if (payment.booking && payment.booking.business_id !== businessId) {
      throw new Error("Payment and job belong to different businesses.");
    }
    const status = payment.booking?.status;
    if (filters.completion === "completed" && status !== "picked_up") continue;
    if (filters.completion === "uncompleted" && !["confirmed", "scheduled", "delivered"].includes(status ?? "")) continue;
    const paymentDate = payment.paid_at && Number.isFinite(Date.parse(payment.paid_at))
      ? formatInputDateET(payment.paid_at) : null;
    if (paymentDate && ((filters.start && paymentDate < filters.start) || (filters.end && paymentDate > filters.end))) continue;
    const refund = recordedRefundCents(payment);
    if (!paymentDate || refund === null || payment.currency !== "USD" || !Number.isSafeInteger(payment.amount_cents) || payment.amount_cents < 0) {
      incompletePayments += 1;
      continue;
    }
    rows.push({
      id: payment.id, booking: payment.booking, paid_at: payment.paid_at!, payment_date: paymentDate,
      collected_cents: payment.amount_cents, refunded_cents: refund, net_cents: payment.amount_cents - refund,
    });
  }
  rows.sort((a, b) => a.paid_at.localeCompare(b.paid_at) || a.id.localeCompare(b.id));
  const netCents = rows.reduce((sum, row) => sum + row.net_cents, 0);
  const jobs = new Set(rows.filter(row => row.booking && row.net_cents > 0).map(row => row.booking!.id));
  const linkedNetCents = rows.reduce((sum, row) => sum + (row.booking ? row.net_cents : 0), 0);
  return { rows, netCents, jobCount: jobs.size, averagePerJobCents: jobs.size ? linkedNetCents / jobs.size : 0, incompletePayments };
}
