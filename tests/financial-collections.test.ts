import test from "node:test";
import assert from "node:assert/strict";
import { buildCollectionsReport, parseCompletionFilter, type CollectionPayment } from "../src/lib/financials/collections";

function payment(id: string, status = "confirmed", overrides: Partial<CollectionPayment> = {}): CollectionPayment {
  return {
    id, business_id: "demo", booking_id: "job-" + id, status: "paid", amount_cents: 40000,
    currency: "USD", paid_at: "2026-10-27T14:00:00Z", provider: "square", raw_provider_response: {},
    booking: {
      id: "job-" + id, business_id: "demo", booking_ref: "DEMO-" + id, status,
      customer_first_name: "Demo", customer_last_name: "Customer", customer_email: null,
      customer_phone: null, customer_street: null, customer_city: null, customer_zip: null,
      delivery_date: "2027-01-01", pickup_date: "2027-01-08",
    }, ...overrides,
  };
}

test("default reports paid bookings immediately, including jobs not yet delivered", () => {
  const report = buildCollectionsReport([payment("1"), payment("2", "scheduled"), payment("3", "delivered"), payment("4", "picked_up")], "demo");
  assert.equal(report.netCents, 160000);
  assert.equal(report.jobCount, 4);
  assert.equal(report.averagePerJobCents, 40000);
  assert.equal(parseCompletionFilter(undefined), "all");
  assert.equal(parseCompletionFilter("invalid"), "all");
});

test("completed means picked up; delivered remains uncompleted; cancelled and unlinked are all-only", () => {
  const payments = [payment("1"), payment("2", "scheduled"), payment("3", "delivered"), payment("4", "picked_up"), payment("5", "cancelled"), payment("6", "confirmed", { booking_id: null, booking: null })];
  assert.deepEqual(buildCollectionsReport(payments, "demo", { completion: "completed" }).rows.map(row => row.id), ["4"]);
  assert.deepEqual(buildCollectionsReport(payments, "demo", { completion: "uncompleted" }).rows.map(row => row.id), ["1", "2", "3"]);
  const all = buildCollectionsReport(payments, "demo");
  assert.equal(all.netCents, 240000);
  assert.equal(all.jobCount, 5);
  assert.equal(all.averagePerJobCents, 40000);
});

test("uses inclusive Eastern payment dates rather than delivery dates, including DST", () => {
  const payments = [payment("before", "confirmed", { paid_at: "2026-11-01T03:59:59Z" }), payment("start", "confirmed", { paid_at: "2026-11-01T04:00:00Z" }), payment("end", "confirmed", { paid_at: "2026-11-02T04:59:59Z" }), payment("after", "confirmed", { paid_at: "2026-11-02T05:00:00Z" })];
  assert.deepEqual(buildCollectionsReport(payments, "demo", { start: "2026-11-01", end: "2026-11-01" }).rows.map(row => row.id), ["start", "end"]);
});

test("excludes failed, pending and canceled attempts and isolates tenants", () => {
  const payments = [payment("1"), ...["pending", "failed", "canceled"].map(status => payment(status, "confirmed", { status })), payment("other", "confirmed", { business_id: "other" })];
  assert.equal(buildCollectionsReport(payments, "demo").netCents, 40000);
  const foreign = payment("foreign");
  foreign.booking!.business_id = "other";
  assert.throws(() => buildCollectionsReport([foreign], "demo"), /different businesses/);
});

test("counts multiple payments for the same job once and ignores duplicate payment rows", () => {
  const first = payment("1");
  const extra = payment("2", "confirmed", { booking: first.booking, booking_id: first.booking_id, amount_cents: 5000 });
  const report = buildCollectionsReport([first, extra, first], "demo");
  assert.equal(report.netCents, 45000);
  assert.equal(report.jobCount, 1);
  assert.equal(report.averagePerJobCents, 45000);
});

test("subtracts recorded SDK and webhook refunds, including fully refunded payments", () => {
  const payments = [payment("full", "cancelled", { status: "refunded" }), payment("sdk", "confirmed", { status: "partially_refunded", raw_provider_response: { payment: { refundedMoney: { amount: "5000", currency: "USD" } } } }), payment("webhook", "confirmed", { raw_provider_response: { data: { object: { payment: { refunded_money: { amount: 10000, currency: "USD" } } } } } })];
  const report = buildCollectionsReport(payments, "demo");
  assert.equal(report.netCents, 65000);
  assert.equal(report.jobCount, 2);
  assert.equal(report.incompletePayments, 0);
});

test("flags incomplete payment records without inventing dates or refund amounts", () => {
  const payments = [payment("missing-date", "confirmed", { paid_at: null }), payment("bad-date", "confirmed", { paid_at: "invalid" }), payment("refund", "confirmed", { status: "partially_refunded" }), payment("currency", "confirmed", { currency: "CAD" })];
  const report = buildCollectionsReport(payments, "demo");
  assert.equal(report.incompletePayments, 4);
  assert.equal(report.netCents, 0);
});

test("loads all pages with a business filter and propagates database failures", async (t) => {
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { loadCollectionsReport } = await import("../src/lib/financials/collections-server");
  const payments = Array.from({ length: 1001 }, (_, i) => payment(String(i)));
  const ranges: number[][] = [];
  t.mock.method(supabaseAdmin, "from", (table: string) => {
    assert.equal(table, "booking_payments");
    let tenantScoped = false;
    const query = {
      select: () => query,
      eq: (column: string, value: string) => {
        assert.equal(column, "business_id");
        assert.equal(value, "demo");
        tenantScoped = true;
        return query;
      },
      in: () => query,
      order: () => query,
      range: async (start: number, end: number) => {
        assert.ok(tenantScoped);
        ranges.push([start, end]);
        return { data: payments.slice(start, end + 1), error: null };
      },
    };
    return query;
  });
  const report = await loadCollectionsReport("demo");
  assert.equal(report.jobCount, 1001);
  assert.equal(report.netCents, 40040000);
  assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499]]);
  t.mock.restoreAll();
  t.mock.method(supabaseAdmin, "from", () => {
    const query = {
      select: () => query, eq: () => query, in: () => query, order: () => query,
      range: async () => ({ data: null, error: { message: "Database unavailable" } }),
    };
    return query;
  });
  await assert.rejects(loadCollectionsReport("demo"), /Database unavailable/);
});

test("CSV follows the same filtered payment rows and protects spreadsheet cells", async () => {
  const { buildCollectionsCsv } = await import("../src/lib/financials/collections-csv");
  const completed = payment("done", "picked_up");
  completed.booking!.booking_ref = '=HYPERLINK("bad")';
  completed.booking!.customer_first_name = 'Demo, "Customer"';
  const report = buildCollectionsReport([completed, payment("open")], "demo", { completion: "completed", start: "2026-10-27", end: "2026-10-27" });
  const csv = buildCollectionsCsv(report.rows);
  assert.match(csv, /Payment date \(Eastern\)/);
  assert.match(csv, /"2026-10-27"/);
  assert.match(csv, /"done"/);
  assert.doesNotMatch(csv, /"open"/);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('Demo, ""Customer""'));
  assert.match(csv, /"\$400\.00","\$0\.00","\$400\.00"/);
  assert.equal(csv.split('\n').length, 2);
});
