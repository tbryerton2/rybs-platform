// src/app/admin/financials/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { BookingResultsSection } from "@/app/admin/financials/booking-results-section";
import { FinancialFiltersCard } from "@/app/admin/financials/financial-filters-card";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { centsToDollars, formatUsd, formatUsdFromCents } from "@/lib/money";

type SearchParams = Record<string, string | string[] | undefined>;
type SortKey = "customer" | "zip" | "city" | "delivery" | "pickup" | "status" | "price";
type SortDirection = "asc" | "desc";
type ResultsView = "table" | "chart";
type Granularity = "daily" | "weekly" | "monthly" | "annual";

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
  sort?: SortKey;
  dir?: SortDirection;
  view?: ResultsView;
  granularity?: Granularity;
}) {
  const qs = new URLSearchParams();

  if (params.preset) qs.set("preset", params.preset);
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  if (params.zip) qs.set("zip", params.zip);
  if (params.status) qs.set("status", params.status);
  if (params.sort) qs.set("sort", params.sort);
  if (params.dir) qs.set("dir", params.dir);
  if (params.view) qs.set("view", params.view);
  if (params.granularity) qs.set("granularity", params.granularity);

  const str = qs.toString();
  return str ? `/admin/financials?${str}` : "/admin/financials";
}

function isPresetRangeActive(
  preset: string,
  todayISO: string,
  startDate: string,
  endDate: string
) {
  const dates = getPresetDates(preset, todayISO);
  return (dates.start ?? "") === startDate && (dates.end ?? "") === endDate;
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

function summaryCardShell(
  tone: "green" | "blue" | "violet" | "amber" | "teal",
  extra = ""
) {
  const toneClasses =
    tone === "green"
      ? "border-emerald-200/70 bg-emerald-50/55"
      : tone === "blue"
        ? "border-sky-200/70 bg-sky-50/55"
        : tone === "violet"
          ? "border-violet-200/70 bg-violet-50/50"
          : tone === "amber"
            ? "border-amber-200/70 bg-amber-50/55"
            : "border-teal-200/70 bg-teal-50/55";

  return `rounded-[28px] border shadow-sm ${toneClasses} ${extra}`;
}

function compareNullableText(a: string | null, b: string | null) {
  return (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" });
}

function compareNullableDate(a: string | null, b: string | null) {
  return (a ?? "").localeCompare(b ?? "");
}

function compareNullableNumber(a: number | null, b: number | null) {
  return (a ?? 0) - (b ?? 0);
}

function daysBetween(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  const diff = end.getTime() - start.getTime();
  return Number.isNaN(diff) ? 0 : Math.max(Math.round(diff / (1000 * 60 * 60 * 24)) + 1, 0);
}

function startOfWeekISO(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

function startOfMonthISO(isoDate: string) {
  return `${isoDate.slice(0, 7)}-01`;
}

function startOfYearISO(isoDate: string) {
  return `${isoDate.slice(0, 4)}-01-01`;
}

export default async function FinancialsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};

  const todayISO = getTodayISOET();
  const monthStart = getMonthStartISO(todayISO);
  const monthEnd = getMonthEndISO(todayISO);
  const last30Start = addDaysISO(todayISO, -29);
  const presetRanges = [
    { key: "7d", ...getPresetDates("7d", todayISO) },
    { key: "30d", ...getPresetDates("30d", todayISO) },
    { key: "month", ...getPresetDates("month", todayISO) },
  ];

  const preset = sp(resolvedSearchParams, "preset") ?? "30d";
  const zipFilter = (sp(resolvedSearchParams, "zip") ?? "").trim();
  const statusScope = (sp(resolvedSearchParams, "status") ?? "revenue").trim();
  const formStartDate = sp(resolvedSearchParams, "start") ?? "";
  const formEndDate = sp(resolvedSearchParams, "end") ?? "";
  const requestedSort = sp(resolvedSearchParams, "sort");
  const requestedDir = sp(resolvedSearchParams, "dir");
  const requestedView = sp(resolvedSearchParams, "view");
  const requestedGranularity = sp(resolvedSearchParams, "granularity");
  const sortKey: SortKey =
    requestedSort === "customer" ||
    requestedSort === "zip" ||
    requestedSort === "city" ||
    requestedSort === "delivery" ||
    requestedSort === "pickup" ||
    requestedSort === "status" ||
    requestedSort === "price"
      ? requestedSort
      : "delivery";
  const sortDirection: SortDirection = requestedDir === "asc" ? "asc" : "desc";
  const currentView: ResultsView = requestedView === "chart" ? "chart" : "table";

  const presetDates = getPresetDates(preset, todayISO);
  const startDate = formStartDate || presetDates.start || "";
  const endDate = formEndDate || presetDates.end || "";
  const advancedFiltersActive =
    formStartDate.length > 0 ||
    formEndDate.length > 0 ||
    zipFilter.length > 0 ||
    statusScope !== "revenue";

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

  const zipOptions = Array.from(
    new Set(
      zipOptionRows
        .map((row) => row.customer_zip?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b));
  const sortedTableRows = [...tableRows].sort((left, right) => {
    const comparison =
      sortKey === "customer"
        ? compareNullableText(left.customer_name, right.customer_name)
        : sortKey === "zip"
          ? compareNullableText(left.customer_zip, right.customer_zip)
          : sortKey === "city"
            ? compareNullableText(left.customer_city, right.customer_city)
            : sortKey === "delivery"
              ? compareNullableDate(left.delivery_date, right.delivery_date)
              : sortKey === "pickup"
                ? compareNullableDate(left.pickup_date, right.pickup_date)
                : sortKey === "status"
                  ? compareNullableText(prettyStatus(left.status), prettyStatus(right.status))
                  : compareNullableNumber(left.total_price_cents, right.total_price_cents);

    if (comparison !== 0) {
      return sortDirection === "asc" ? comparison : -comparison;
    }

    return left.id.localeCompare(right.id);
  });
  const defaultGranularity: Granularity =
    !startDate || !endDate
      ? "monthly"
      : daysBetween(startDate, endDate) <= 31
        ? "daily"
        : daysBetween(startDate, endDate) <= 120
          ? "weekly"
          : "monthly";
  const currentGranularity: Granularity =
    requestedGranularity === "daily" ||
    requestedGranularity === "weekly" ||
    requestedGranularity === "monthly" ||
    requestedGranularity === "annual"
      ? requestedGranularity
      : defaultGranularity;
  const chartBuckets = new Map<
    string,
    { key: string; label: string; fullLabel: string; value: number; bookings: number }
  >();

  for (const row of tableRows) {
    if (!row.delivery_date) continue;

    const bucketKey =
      currentGranularity === "daily"
        ? row.delivery_date
        : currentGranularity === "weekly"
          ? startOfWeekISO(row.delivery_date)
          : currentGranularity === "monthly"
            ? startOfMonthISO(row.delivery_date)
            : startOfYearISO(row.delivery_date);
    const date = new Date(`${bucketKey}T00:00:00`);
    const label =
      currentGranularity === "daily"
        ? new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "America/New_York",
          }).format(date)
        : currentGranularity === "weekly"
          ? new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              timeZone: "America/New_York",
            }).format(date)
          : currentGranularity === "monthly"
            ? new Intl.DateTimeFormat("en-US", {
                month: "short",
                year: "2-digit",
                timeZone: "America/New_York",
              }).format(date)
            : new Intl.DateTimeFormat("en-US", {
                year: "numeric",
                timeZone: "America/New_York",
              }).format(date);
    const fullLabel =
      currentGranularity === "weekly"
        ? `Week of ${new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "America/New_York",
          }).format(date)}`
        : currentGranularity === "monthly"
          ? new Intl.DateTimeFormat("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "America/New_York",
            }).format(date)
          : currentGranularity === "annual"
            ? new Intl.DateTimeFormat("en-US", {
                year: "numeric",
                timeZone: "America/New_York",
              }).format(date)
            : new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "America/New_York",
            }).format(date);
    const existing = chartBuckets.get(bucketKey) ?? {
      key: bucketKey,
      label,
      fullLabel,
      value: 0,
      bookings: 0,
    };

    existing.value += centsToDollars(row.total_price_cents) ?? 0;
    existing.bookings += 1;
    chartBuckets.set(bucketKey, existing);
  }

  const chartPoints = [...chartBuckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  const totalChartValue = tableRows.reduce(
    (sum, row) => sum + (centsToDollars(row.total_price_cents) ?? 0),
    0
  );
  const averageChartValue = tableRows.length > 0 ? totalChartValue / tableRows.length : 0;
  const sortColumns = [
    { key: "customer" as const, label: "Customer", align: "left" as const },
    { key: "zip" as const, label: "ZIP", align: "left" as const },
    { key: "city" as const, label: "City", align: "left" as const },
    { key: "delivery" as const, label: "Delivery", align: "left" as const },
    { key: "pickup" as const, label: "Pickup", align: "left" as const },
    { key: "status" as const, label: "Status", align: "left" as const },
    { key: "price" as const, label: "Price", align: "right" as const },
  ].map((column) => {
    const active = sortKey === column.key;
    const nextDir: SortDirection = active && sortDirection === "asc" ? "desc" : "asc";

    return {
      ...column,
      active,
      direction: active ? sortDirection : nextDir,
      href: `${buildHref({
        preset,
        start: formStartDate || undefined,
        end: formEndDate || undefined,
        zip: zipFilter || undefined,
        status: statusScope,
        sort: column.key,
        dir: nextDir,
        view: currentView,
        granularity: currentGranularity,
      })}#booking-results`,
    };
  });

  return (
    <AdminPage>
      <AdminPageHeader
        title="Revenue"
        description="Track revenue, booking value, and business performance."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className={summaryCardShell("green", "p-5")}>
          <p className="text-sm font-medium text-slate-500">Revenue this month</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {formatUsd(revenueThisMonth, { maximumFractionDigits: 0 })}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Delivered and picked up jobs by delivery date
          </p>
        </div>

        <div className={summaryCardShell("blue", "p-5")}>
          <p className="text-sm font-medium text-slate-500">Revenue last 30 days</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {formatUsd(revenueLast30Days, { maximumFractionDigits: 0 })}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Rolling 30-day operational revenue
          </p>
        </div>

        <div className={summaryCardShell("violet", "p-5")}>
          <p className="text-sm font-medium text-slate-500">Average booking value</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {formatUsd(averageBookingValue, { maximumFractionDigits: 0 })}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            All revenue-producing jobs
          </p>
        </div>

        <div className={summaryCardShell("amber", "p-5")}>
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

        <div className={summaryCardShell("teal", "p-5")}>
          <p className="text-sm font-medium text-slate-500">Highest value ZIP</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {topZipAllTime?.[0] ?? "—"}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {topZipAllTime ? `${formatUsd(topZipAllTime[1], { maximumFractionDigits: 0 })} all time` : "No data yet"}
          </p>
        </div>
      </section>

      <FinancialFiltersCard
        preset={preset}
        startDate={formStartDate}
        endDate={formEndDate}
        zipFilter={zipFilter}
        statusScope={statusScope}
        currentView={currentView}
        currentGranularity={currentGranularity}
        zipOptions={zipOptions}
        presetRanges={presetRanges}
        advancedDefaultOpen={advancedFiltersActive}
        quickRanges={[
          {
            key: "7d",
            label: "Last 7 days",
            href: `${buildHref({
              preset: "7d",
              zip: zipFilter || undefined,
              status: statusScope,
              sort: sortKey,
              dir: sortDirection,
              view: currentView,
              granularity: currentGranularity,
            })}#filters`,
            active: isPresetRangeActive("7d", todayISO, startDate, endDate),
          },
          {
            key: "30d",
            label: "Last 30 days",
            href: `${buildHref({
              preset: "30d",
              zip: zipFilter || undefined,
              status: statusScope,
              sort: sortKey,
              dir: sortDirection,
              view: currentView,
              granularity: currentGranularity,
            })}#filters`,
            active: isPresetRangeActive("30d", todayISO, startDate, endDate),
          },
          {
            key: "month",
            label: "This month",
            href: `${buildHref({
              preset: "month",
              zip: zipFilter || undefined,
              status: statusScope,
              sort: sortKey,
              dir: sortDirection,
              view: currentView,
              granularity: currentGranularity,
            })}#filters`,
            active: isPresetRangeActive("month", todayISO, startDate, endDate),
          },
          {
            key: "all",
            label: "All time",
            href: `${buildHref({
              preset: "all",
              zip: zipFilter || undefined,
              status: statusScope,
              sort: sortKey,
              dir: sortDirection,
              view: currentView,
              granularity: currentGranularity,
            })}#filters`,
            active: startDate === "" && endDate === "",
          },
        ]}
      />

      <BookingResultsSection
        rows={sortedTableRows.map((row) => ({
          id: row.id,
          customerName: row.customer_name || "Unnamed customer",
          customerZip: row.customer_zip || "—",
          customerCity: row.customer_city || "—",
          deliveryDate: formatDate(row.delivery_date),
          pickupDate: formatDate(row.pickup_date),
          statusLabel: prettyStatus(row.status),
          statusTone: statusBadgeClasses(row.status),
          priceLabel: formatUsdFromCents(row.total_price_cents, {
            maximumFractionDigits: 0,
          }),
          detailHref: `/admin/bookings/${row.id}`,
        }))}
        sortColumns={sortColumns}
        chartPoints={chartPoints}
        currentView={currentView}
        tableHref={`${buildHref({
          preset,
          start: formStartDate || undefined,
          end: formEndDate || undefined,
          zip: zipFilter || undefined,
          status: statusScope,
          sort: sortKey,
          dir: sortDirection,
          view: "table",
          granularity: currentGranularity,
        })}#booking-results`}
        chartHref={`${buildHref({
          preset,
          start: formStartDate || undefined,
          end: formEndDate || undefined,
          zip: zipFilter || undefined,
          status: statusScope,
          sort: sortKey,
          dir: sortDirection,
          view: "chart",
          granularity: currentGranularity,
        })}#booking-results`}
        currentGranularity={currentGranularity}
        granularityOptions={
          [
            { key: "daily" as const, label: "Daily" },
            { key: "weekly" as const, label: "Weekly" },
            { key: "monthly" as const, label: "Monthly" },
            { key: "annual" as const, label: "Annual" },
          ].map((option) => ({
            ...option,
            href: `${buildHref({
              preset,
              start: formStartDate || undefined,
              end: formEndDate || undefined,
              zip: zipFilter || undefined,
              status: statusScope,
              sort: sortKey,
              dir: sortDirection,
              view: "chart",
              granularity: option.key,
            })}#booking-results`,
          }))
        }
        totalValueLabel={formatUsd(totalChartValue, { maximumFractionDigits: 0 })}
        bookingsLabel={numberFmt(tableRows.length)}
        averageValueLabel={formatUsd(averageChartValue, { maximumFractionDigits: 0 })}
        bucketLabel={
          currentGranularity === "daily"
            ? "Daily"
            : currentGranularity === "weekly"
              ? "Weekly"
              : currentGranularity === "monthly"
                ? "Monthly"
                : "Annual"
        }
      />

      <div className="mt-6 rounded-[24px] border border-orange-100 bg-orange-50/70 px-5 py-4 text-sm text-slate-700">
        V1 financials are based on the booking total stored on each job record and
        use <span className="font-semibold">delivery_date</span> for reporting.
        This is operational revenue visibility, not finalized accounting or payment
        reconciliation.
      </div>
    </AdminPage>
  );
}
