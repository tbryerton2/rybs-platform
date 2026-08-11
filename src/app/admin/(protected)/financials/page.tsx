// src/app/admin/financials/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import {
  BanknotesIcon,
  ChartBarIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { FinancialFiltersCard } from "@/app/admin/(protected)/financials/financial-filters-card";
import { RevenueReportSection } from "@/app/admin/(protected)/financials/revenue-report-section";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { centsToDollars, formatUsd } from "@/lib/money";
import { requireAdminOwner } from "@/lib/admin/auth";

type SearchParams = Record<string, string | string[] | undefined>;
type Granularity = "daily" | "weekly" | "monthly" | "annual";
type RangePreset = "7d" | "30d" | "month" | "all" | "custom";

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
  delivery_date: string | null;
  status: BookingStatus;
  total_price_cents: number | null;
};

const REVENUE_STATUSES: BookingStatus[] = ["delivered", "picked_up"];

function sp(obj: SearchParams, key: string) {
  const value = obj[key];
  return Array.isArray(value) ? value[0] : value;
}

function numberFmt(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
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

function isRangePreset(value: string | undefined): value is RangePreset {
  return (
    value === "7d" ||
    value === "30d" ||
    value === "month" ||
    value === "all" ||
    value === "custom"
  );
}

function isISODate(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function getPresetDates(
  preset: RangePreset,
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
    case "custom":
    default:
      return {};
  }
}

function buildHref(params: {
  preset?: RangePreset;
  start?: string;
  end?: string;
  granularity?: Granularity;
}) {
  const qs = new URLSearchParams();

  if (params.preset) qs.set("preset", params.preset);
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  if (params.granularity) qs.set("granularity", params.granularity);

  const str = qs.toString();
  return str ? `/admin/financials?${str}` : "/admin/financials";
}

function buildExportHref(params: { start?: string; end?: string }) {
  const qs = new URLSearchParams();

  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);

  const str = qs.toString();
  return str
    ? `/api/admin/financials/revenue-export?${str}`
    : "/api/admin/financials/revenue-export";
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

  return `rounded-[14px] border shadow-sm ${toneClasses} ${extra}`;
}

function summaryCardIconClasses(tone: "green" | "blue" | "violet" | "amber" | "teal") {
  return tone === "green"
    ? "bg-emerald-100/95 text-emerald-700 ring-emerald-200/90"
    : tone === "blue"
      ? "bg-sky-100/95 text-sky-700 ring-sky-200/90"
      : tone === "violet"
        ? "bg-violet-100/95 text-violet-700 ring-violet-200/90"
        : tone === "amber"
          ? "bg-amber-100/95 text-amber-700 ring-amber-200/90"
          : "bg-teal-100/95 text-teal-700 ring-teal-200/90";
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

function formatRangeLabel(startDate: string, endDate: string) {
  if (!startDate && !endDate) return "All time";
  if (startDate && !endDate) return `${formatRangeDate(startDate)} onward`;
  if (!startDate && endDate) return `Through ${formatRangeDate(endDate)}`;

  return `${formatRangeDate(startDate)} - ${formatRangeDate(endDate)}`;
}

function formatRangeDate(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

export default async function FinancialsPage({ searchParams }: PageProps) {
  const adminSession = await requireAdminOwner();
  const resolvedSearchParams = (await searchParams) ?? {};

  const todayISO = getTodayISOET();
  const presetRanges = [
    { key: "7d" as const, ...getPresetDates("7d", todayISO) },
    { key: "30d" as const, ...getPresetDates("30d", todayISO) },
    { key: "month" as const, ...getPresetDates("month", todayISO) },
  ];

  const requestedPreset = sp(resolvedSearchParams, "preset");
  const preset: RangePreset = isRangePreset(requestedPreset) ? requestedPreset : "30d";
  const formStartDate = isISODate(sp(resolvedSearchParams, "start"))
    ? sp(resolvedSearchParams, "start")!
    : "";
  const formEndDate = isISODate(sp(resolvedSearchParams, "end"))
    ? sp(resolvedSearchParams, "end")!
    : "";
  const requestedGranularity = sp(resolvedSearchParams, "granularity");

  const presetDates = formStartDate || formEndDate ? {} : getPresetDates(preset, todayISO);
  const startDate = formStartDate || presetDates.start || "";
  const endDate = formEndDate || presetDates.end || "";
  const matchingPreset = presetRanges.find(
    (range) => (range.start ?? "") === startDate && (range.end ?? "") === endDate
  );
  const activeRangeKey: RangePreset =
    startDate === "" && endDate === ""
      ? "all"
      : matchingPreset?.key ?? "custom";

  let revenueQuery = supabaseAdmin
    .from("bookings")
    .select(`
      id,
      delivery_date,
      status,
      total_price_cents
    `)
    .eq("business_id", adminSession.business.id)
    .in("status", REVENUE_STATUSES)
    .order("delivery_date", { ascending: true, nullsFirst: false });

  if (startDate) revenueQuery = revenueQuery.gte("delivery_date", startDate);
  if (endDate) revenueQuery = revenueQuery.lte("delivery_date", endDate);

  const revenueResult = await revenueQuery;

  if (revenueResult.error) throw new Error(revenueResult.error.message);

  const revenueRows = (revenueResult.data ?? []) as BookingRow[];
  const totalRevenue = sumRevenue(revenueRows);
  const totalRevenueJobs = revenueRows.length;
  const averageBookingValue =
    totalRevenueJobs > 0 ? totalRevenue / totalRevenueJobs : 0;
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

  for (const row of revenueRows) {
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
  const rangeLabel = formatRangeLabel(startDate, endDate);
  const exportHref = buildExportHref({
    start: startDate || undefined,
    end: endDate || undefined,
  });

  return (
    <AdminPage>
      <AdminPageHeader
        title="Revenue"
        description="See what you earned in a given period, and export it for your records or taxes."
      />

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            tone: "green" as const,
            label: "Revenue in range",
            value: formatUsd(totalRevenue, { maximumFractionDigits: 0 }),
            icon: BanknotesIcon,
            detail: rangeLabel,
          },
          {
            tone: "violet" as const,
            label: "Average booking value",
            value: formatUsd(averageBookingValue, { maximumFractionDigits: 0 }),
            icon: ScaleIcon,
            detail: "Completed revenue jobs",
          },
          {
            tone: "amber" as const,
            label: "Revenue-producing jobs",
            value: numberFmt(totalRevenueJobs),
            icon: ChartBarIcon,
            detail: "Delivered or picked up",
          },
        ].map((card) => (
          <div key={card.label} className={summaryCardShell(card.tone, "h-full p-5")}>
            <div className="flex gap-4">
              <span
                className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-white/65 ring-1 ring-inset ${summaryCardIconClasses(card.tone)}`}
              >
                <card.icon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="flex h-12 items-center text-sm font-medium leading-5 text-slate-600">
                  {card.label}
                </div>
                <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                  {card.value}
                </div>
                <div className="mt-1 truncate text-xs font-medium text-slate-500">
                  {card.detail}
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <FinancialFiltersCard
        preset={preset}
        startDate={formStartDate}
        endDate={formEndDate}
        currentGranularity={currentGranularity}
        customActive={activeRangeKey === "custom"}
        exportHref={exportHref}
        presetRanges={presetRanges}
        advancedDefaultOpen={activeRangeKey === "custom"}
        quickRanges={[
          {
            key: "7d",
            label: "Last 7 days",
            href: `${buildHref({
              preset: "7d",
              granularity: currentGranularity,
            })}#filters`,
            active: activeRangeKey === "7d",
          },
          {
            key: "30d",
            label: "Last 30 days",
            href: `${buildHref({
              preset: "30d",
              granularity: currentGranularity,
            })}#filters`,
            active: activeRangeKey === "30d",
          },
          {
            key: "month",
            label: "This month",
            href: `${buildHref({
              preset: "month",
              granularity: currentGranularity,
            })}#filters`,
            active: activeRangeKey === "month",
          },
          {
            key: "all",
            label: "All time",
            href: `${buildHref({
              preset: "all",
              granularity: currentGranularity,
            })}#filters`,
            active: activeRangeKey === "all",
          },
        ]}
      />

      <RevenueReportSection
        chartPoints={chartPoints}
        currentGranularity={currentGranularity}
        granularityOptions={
          [
            { key: "daily" as const, label: "Day" },
            { key: "weekly" as const, label: "Week" },
            { key: "monthly" as const, label: "Month" },
            { key: "annual" as const, label: "Year" },
          ].map((option) => ({
            ...option,
            href: `${buildHref({
              preset: activeRangeKey,
              start: formStartDate || undefined,
              end: formEndDate || undefined,
              granularity: option.key,
            })}#revenue-report`,
          }))
        }
      />

      <div className="mt-6 rounded-[14px] border border-orange-100 bg-orange-50/70 px-5 py-4 text-sm text-slate-700">
        V1 financials are based on the booking total stored on each job record and
        use <span className="font-semibold">delivery_date</span> for reporting.
        This is operational revenue visibility, not finalized accounting or payment
        reconciliation.
      </div>
    </AdminPage>
  );
}
