// src/app/admin/financials/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { centsToDollars, formatUsd, formatUsdFromCents } from "@/lib/money";

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

type BookingStatus =
  | "confirmed"
  | "scheduled"
  | "delivered"
  | "picked_up"
  | "cancelled";

type BookingRow = {
  id: string;
  customer_name: string | null;
  customer_zip: string | null;
  customer_city: string | null;
  delivery_date: string | null;
  pickup_date: string | null;
  status: BookingStatus;
  total_price_cents: number | null;
  created_at: string | null;
};

const REVENUE_STATUSES: BookingStatus[] = ["delivered", "picked_up"];
const ALL_ACTIVE_STATUSES: BookingStatus[] = [
  "confirmed",
  "scheduled",
  "delivered",
  "picked_up",
];

function sp(obj: SearchParams, key: string) {
  const value = obj[key];
  return Array.isArray(value) ? value[0] : value;
}

function numberFmt(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function sumRevenue(rows: Array<{ total_price_cents: number | null }>) {
  return rows.reduce(
    (sum, row) => sum + (centsToDollars(row.total_price_cents) ?? 0),
    0
  );
}

function getTodayISOET() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysISO(iso: string, delta: number) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return date.toISOString().slice(0, 10);
}

function getMonthStartISO(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

function getMonthEndISO(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0));
  return lastDay.toISOString().slice(0, 10);
}

function getPresetDates(
  preset: string,
  todayISO: string
): { start?: string; end?: string } {
  switch (preset) {
    case "7d":
      return { start: addDaysISO(todayISO, -6), end: todayISO };
    case "30d":
      return { start: addDaysISO(todayISO, -29), end: todayISO };
    case "month":
      return {
        start: getMonthStartISO(todayISO),
        end: getMonthEndISO(todayISO),
      };
    case "all":
    default:
      return {};
  }
}

function buildHref(params: {
  preset?: string;
  start?: string;
  end?: string;
  zip?: string;
  status?: string;
}) {
  const qs = new URLSearchParams();

  if (params.preset) qs.set("preset", params.preset);
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  if (params.zip) qs.set("zip", params.zip);
  if (params.status) qs.set("status", params.status);

  const str = qs.toString();
  return str ? `/admin/financials?${str}` : "/admin/financials";
}

function statusBadgeClasses(status: BookingStatus) {
  switch (status) {
    case "picked_up":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "delivered":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
    case "scheduled":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "confirmed":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
    case "cancelled":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
}

function prettyStatus(status: BookingStatus) {
  switch (status) {
    case "picked_up":
      return "Picked Up";
    case "delivered":
      return "Delivered";
    case "scheduled":
      return "Scheduled";
    case "confirmed":
      return "Confirmed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function cardShell(extra = "") {
  return `rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200/70 ${extra}`;
}

export default async function FinancialsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};

  const todayISO = getTodayISOET();
  const monthStart = getMonthStartISO(todayISO);
  const monthEnd = getMonthEndISO(todayISO);
  const last30Start = addDaysISO(todayISO, -29);

  const preset = sp(resolvedSearchParams, "preset") ?? "30d";
  const zipFilter = (sp(resolvedSearchParams, "zip") ?? "").trim();
  const statusScope = (sp(resolvedSearchParams, "status") ?? "revenue").trim();

  const presetDates = getPresetDates(preset, todayISO);
  const startDate = sp(resolvedSearchParams, "start") ?? presetDates.start ?? "";
  const endDate = sp(resolvedSearchParams, "end") ?? presetDates.end ?? "";

  const tableStatuses =
    statusScope === "all-active" ? ALL_ACTIVE_STATUSES : REVENUE_STATUSES;

  const [
    monthSummaryResult,
    last30Result,
    allTimeSummaryResult,
    zipOptionsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("total_price_cents")
      .in("status", REVENUE_STATUSES)
      .gte("delivery_date", monthStart)
      .lte("delivery_date", monthEnd),

    supabaseAdmin
      .from("bookings")
      .select("total_price_cents")
      .in("status", REVENUE_STATUSES)
      .gte("delivery_date", last30Start)
      .lte("delivery_date", todayISO),

    supabaseAdmin
      .from("bookings")
      .select("total_price_cents, customer_zip")
      .in("status", REVENUE_STATUSES),

    supabaseAdmin
      .from("bookings")
      .select("customer_zip")
      .not("customer_zip", "is", null),
  ]);

  if (monthSummaryResult.error) throw new Error(monthSummaryResult.error.message);
  if (last30Result.error) throw new Error(last30Result.error.message);
  if (allTimeSummaryResult.error) {
    throw new Error(allTimeSummaryResult.error.message);
  }
  if (zipOptionsResult.error) throw new Error(zipOptionsResult.error.message);

  let tableQuery = supabaseAdmin
    .from("bookings")
    .select(`
      id,
      customer_name,
      customer_zip,
      customer_city,
      delivery_date,
      pickup_date,
      status,
      total_price_cents,
      created_at
    `)
    .in("status", tableStatuses)
    .order("delivery_date", { ascending: false, nullsFirst: false });

  if (startDate) tableQuery = tableQuery.gte("delivery_date", startDate);
  if (endDate) tableQuery = tableQuery.lte("delivery_date", endDate);
  if (zipFilter) tableQuery = tableQuery.eq("customer_zip", zipFilter);

  const tableResult = await tableQuery;

  if (tableResult.error) throw new Error(tableResult.error.message);

  const tableRows = (tableResult.data ?? []) as BookingRow[];

  const monthRows = (monthSummaryResult.data ?? []) as Array<{
    total_price_cents: number | null;
  }>;

  const last30Rows = (last30Result.data ?? []) as Array<{
    total_price_cents: number | null;
  }>;

  const allTimeRows = (allTimeSummaryResult.data ?? []) as Array<{
    total_price_cents: number | null;
    customer_zip: string | null;
  }>;

  const zipOptionRows = (zipOptionsResult.data ?? []) as Array<{
    customer_zip: string | null;
  }>;

  const revenueThisMonth = sumRevenue(monthRows);
  const revenueLast30Days = sumRevenue(last30Rows);
  const totalRevenueJobs = allTimeRows.length;
  const averageBookingValue =
  totalRevenueJobs > 0 ? sumRevenue(allTimeRows) / totalRevenueJobs : 0;

  const revenueByZipAllTime = new Map<string, number>();

  for (const row of allTimeRows) {
    const zip = row.customer_zip?.trim();
    if (!zip) continue;

    revenueByZipAllTime.set(
      zip,
      (revenueByZipAllTime.get(zip) ?? 0) +
        (centsToDollars(row.total_price_cents) ?? 0)
    );
  }

  const topZipAllTime =
    [...revenueByZipAllTime.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  const filteredRevenueRows = tableRows.filter((row) =>
    REVENUE_STATUSES.includes(row.status)
  );

  const filteredRevenue = filteredRevenueRows.reduce(
    (sum, row) => sum + (centsToDollars(row.total_price_cents) ?? 0),
    0
  );

  const filteredRevenueByZip = new Map<
    string,
    { zip: string; revenue: number; jobs: number }
  >();

  const filteredRevenueByMonth = new Map<
    string,
    { label: string; revenue: number; jobs: number }
  >();

  const filteredRevenueByCustomer = new Map<
    string,
    { customer: string; revenue: number; jobs: number }
  >();

  for (const row of filteredRevenueRows) {
    const revenue = centsToDollars(row.total_price_cents) ?? 0;

    const zip = row.customer_zip?.trim();
    if (zip) {
      const existing = filteredRevenueByZip.get(zip) ?? {
        zip,
        revenue: 0,
        jobs: 0,
      };
      existing.revenue += revenue;
      existing.jobs += 1;
      filteredRevenueByZip.set(zip, existing);
    }

    const monthKey = row.delivery_date ? row.delivery_date.slice(0, 7) : null;
    if (monthKey) {
      const dt = new Date(`${monthKey}-01T00:00:00`);
      const label = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        month: "short",
        year: "numeric",
      }).format(dt);

      const existing = filteredRevenueByMonth.get(monthKey) ?? {
        label,
        revenue: 0,
        jobs: 0,
      };
      existing.revenue += revenue;
      existing.jobs += 1;
      filteredRevenueByMonth.set(monthKey, existing);
    }

    const customer = row.customer_name?.trim() || "Unnamed customer";
    const customerExisting = filteredRevenueByCustomer.get(customer) ?? {
      customer,
      revenue: 0,
      jobs: 0,
    };
    customerExisting.revenue += revenue;
    customerExisting.jobs += 1;
    filteredRevenueByCustomer.set(customer, customerExisting);
  }

  const topZipBreakdown = [...filteredRevenueByZip.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const monthlyBreakdown = [...filteredRevenueByMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, value]) => value)
    .slice(-6);

  const topCustomers = [...filteredRevenueByCustomer.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const zipOptions = Array.from(
    new Set(
      zipOptionRows
        .map((row) => row.customer_zip?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="mx-auto max-w-7xl px-6 pb-16 pt-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Financials
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Track revenue, booking value, and business performance.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className={cardShell("p-5")}>
          <p className="text-sm font-medium text-slate-500">Revenue this month</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {formatUsd(revenueThisMonth, { maximumFractionDigits: 0 })}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Delivered and picked up jobs by delivery date
          </p>
        </div>

        <div className={cardShell("p-5")}>
          <p className="text-sm font-medium text-slate-500">Revenue last 30 days</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {formatUsd(revenueLast30Days, { maximumFractionDigits: 0 })}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Rolling 30-day operational revenue
          </p>
        </div>

        <div className={cardShell("p-5")}>
          <p className="text-sm font-medium text-slate-500">Average booking value</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {formatUsd(averageBookingValue, { maximumFractionDigits: 0 })}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            All revenue-producing jobs
          </p>
        </div>

        <div className={cardShell("p-5")}>
          <p className="text-sm font-medium text-slate-500">
            Revenue-producing jobs
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {numberFmt(totalRevenueJobs)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Delivered and picked up bookings
          </p>
        </div>

        <div className={cardShell("p-5")}>
          <p className="text-sm font-medium text-slate-500">Highest value ZIP</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {topZipAllTime?.[0] ?? "—"}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {topZipAllTime ? `${formatUsd(topZipAllTime[1], { maximumFractionDigits: 0 })} all time` : "No data yet"}
          </p>
        </div>
      </section>

      <section className={cardShell("mt-8 p-6")}>
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
            <p className="mt-1 text-sm text-slate-600">
              Narrow the revenue table and breakdowns by date, ZIP, and job state.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: "7d", label: "Last 7 days" },
              { key: "30d", label: "Last 30 days" },
              { key: "month", label: "This month" },
              { key: "all", label: "All time" },
            ].map((item) => {
              const active = preset === item.key;

              return (
                <Link
                  key={item.key}
                  href={buildHref({
                    preset: item.key,
                    zip: zipFilter || undefined,
                    status: statusScope,
                  })}
                  className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-[#F97316] text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <form method="GET" className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <input type="hidden" name="preset" value={preset} />

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Start date
              </span>
              <input
                type="date"
                name="start"
                defaultValue={startDate}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#F97316]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                End date
              </span>
              <input
                type="date"
                name="end"
                defaultValue={endDate}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#F97316]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">ZIP</span>
              <select
                name="zip"
                defaultValue={zipFilter}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#F97316]"
              >
                <option value="">All ZIPs</option>
                {zipOptions.map((zip) => (
                  <option key={zip} value={zip}>
                    {zip}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Status scope
              </span>
              <select
                name="status"
                defaultValue={statusScope}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#F97316]"
              >
                <option value="revenue">Revenue only</option>
                <option value="all-active">All active jobs</option>
              </select>
            </label>

            <div className="flex items-end gap-3">
              <button
                type="submit"
                className="inline-flex h-[50px] items-center justify-center rounded-2xl bg-[#F97316] px-5 text-sm font-medium text-white shadow-sm transition hover:bg-orange-600"
              >
                Apply filters
              </button>

              <Link
                href="/admin/financials"
                className="inline-flex h-[50px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Reset
              </Link>
            </div>
          </form>
        </div>
      </section>

      <section className="mt-8 grid gap-4 xl:grid-cols-3">
        <div className={cardShell("p-6")}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Filtered revenue</h2>
              <p className="mt-1 text-sm text-slate-600">
                Revenue represented by the current table selection
              </p>
            </div>
            <div className="rounded-2xl bg-orange-50 px-3 py-2 text-sm font-semibold text-[#F97316]">
              {formatUsd(filteredRevenue, { maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {topZipBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500">No ZIP revenue data for this filter.</p>
            ) : (
              topZipBreakdown.map((item) => (
                <div
                  key={item.zip}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.zip}</p>
                    <p className="text-xs text-slate-500">
                      {item.jobs} {item.jobs === 1 ? "job" : "jobs"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatUsd(item.revenue, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={cardShell("p-6")}>
          <h2 className="text-lg font-semibold text-slate-900">Revenue by month</h2>
          <p className="mt-1 text-sm text-slate-600">
            Last 6 delivery months in the current filter
          </p>

          <div className="mt-5 space-y-3">
            {monthlyBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500">No monthly revenue data yet.</p>
            ) : (
              monthlyBreakdown.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-500">
                      {item.jobs} {item.jobs === 1 ? "job" : "jobs"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatUsd(item.revenue, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={cardShell("p-6")}>
          <h2 className="text-lg font-semibold text-slate-900">Top customers</h2>
          <p className="mt-1 text-sm text-slate-600">
            Highest spend based on current filtered revenue jobs
          </p>

          <div className="mt-5 space-y-3">
            {topCustomers.length === 0 ? (
              <p className="text-sm text-slate-500">No customer revenue data yet.</p>
            ) : (
              topCustomers.map((item) => (
                <div
                  key={item.customer}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.customer}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.jobs} {item.jobs === 1 ? "job" : "jobs"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatUsd(item.revenue, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className={cardShell("mt-8 overflow-hidden")}>
        <div className="border-b border-slate-200/80 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Revenue table</h2>
          <p className="mt-1 text-sm text-slate-600">
            Jobs contributing to financial visibility based on the current filters.
          </p>
        </div>

        {tableRows.length === 0 ? (
          <div className="px-6 py-12 text-sm text-slate-500">
            No bookings matched the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    ZIP
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    City
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Delivery
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Pickup
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Price
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {tableRows.map((row) => {
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {row.customer_name || "Unnamed customer"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {row.customer_zip || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {row.customer_city || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {formatDate(row.delivery_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {formatDate(row.pickup_date)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(
                            row.status
                          )}`}
                        >
                          {prettyStatus(row.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                        {formatUsdFromCents(row.total_price_cents, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/bookings/${row.id}`}
                          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-6 rounded-[24px] border border-orange-100 bg-orange-50/70 px-5 py-4 text-sm text-slate-700">
        V1 financials are based on the booking total stored on each job record and
        use <span className="font-semibold">delivery_date</span> for reporting.
        This is operational revenue visibility, not finalized accounting or payment
        reconciliation.
      </div>
    </div>
  );
}
