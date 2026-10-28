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
import { loadCollectionsReport } from "@/lib/financials/collections-server";
import { COMPLETION_OPTIONS, parseCompletionFilter, type CompletionFilter } from "@/lib/financials/collections";
import { centsToDollars, formatUsd } from "@/lib/money";
import { requireAdminOwner } from "@/lib/admin/auth";

type SearchParams = Record<string, string | string[] | undefined>;
type Granularity = "daily" | "weekly" | "monthly" | "annual";
type RangePreset = "7d" | "30d" | "month" | "all" | "custom";

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

function sp(obj: SearchParams, key: string) {
  const value = obj[key];
  return Array.isArray(value) ? value[0] : value;
}

function numberFmt(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
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
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
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
  completion?: CompletionFilter;
}) {
  const qs = new URLSearchParams();

  if (params.preset) qs.set("preset", params.preset);
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  if (params.granularity) qs.set("granularity", params.granularity);
  if (params.completion) qs.set("completion", params.completion);

  const str = qs.toString();
  return str ? `/admin/financials?${str}` : "/admin/financials";
}

function buildExportHref(params: { start?: string; end?: string; completion: CompletionFilter }) {
  const qs = new URLSearchParams({ completion: params.completion });

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
  const start = new Date(`${startIso}T12:00:00Z`);
  const end = new Date(`${endIso}T12:00:00Z`);
  const diff = end.getTime() - start.getTime();
  return Number.isNaN(diff) ? 0 : Math.max(Math.round(diff / (1000 * 60 * 60 * 24)) + 1, 0);
}

function startOfWeekISO(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00Z`);
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
  const date = new Date(`${isoDate}T12:00:00Z`);
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
  const completion = parseCompletionFilter(sp(resolvedSearchParams, "completion"));
  const completionLabel = COMPLETION_OPTIONS.find(option => option.key === completion)!.label;
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

  const report = await loadCollectionsReport(adminSession.business.id, { completion, start: startDate, end: endDate });
  const revenueRows = report.rows;
  const totalRevenue = report.netCents / 100;
  const totalRevenueJobs = report.jobCount;
  const averageBookingValue = report.averagePerJobCents / 100;
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
    { key: string; label: string; fullLabel: string; value: number; bookings: Set<string> }
  >();

  for (const row of revenueRows) {
    if (!row.payment_date) continue;

    const bucketKey =
      currentGranularity === "daily"
        ? row.payment_date
        : currentGranularity === "weekly"
          ? startOfWeekISO(row.payment_date)
          : currentGranularity === "monthly"
            ? startOfMonthISO(row.payment_date)
            : startOfYearISO(row.payment_date);
    const date = new Date(`${bucketKey}T12:00:00Z`);
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
      bookings: new Set<string>(),
    };

    existing.value += centsToDollars(row.net_cents) ?? 0;
    if (row.booking && row.net_cents > 0) existing.bookings.add(row.booking.id);
    chartBuckets.set(bucketKey, existing);
  }

  const chartPoints = [...chartBuckets.values()].map(point => ({ ...point, bookings: point.bookings.size })).sort((a, b) => a.key.localeCompare(b.key));
  const rangeLabel = formatRangeLabel(startDate, endDate);
  const exportHref = buildExportHref({
    completion,
    start: startDate || undefined,
    end: endDate || undefined,
  });

  return (
    <AdminPage>
      <AdminPageHeader
        title="Revenue"
        description="Track money collected by payment date and filter by job completion."
      />

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            tone: "green" as const,
            label: "Money collected",
            value: formatUsd(totalRevenue, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            icon: BanknotesIcon,
            detail: rangeLabel,
          },
          {
            tone: "violet" as const,
            label: "Average collected per job",
            value: formatUsd(averageBookingValue, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            icon: ScaleIcon,
            detail: "Jobs with collected payments",
          },
          {
            tone: "amber" as const,
            label: "Jobs with money collected",
            value: numberFmt(totalRevenueJobs),
            icon: ChartBarIcon,
            detail: completionLabel,
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

      {report.incompletePayments > 0 && (
        <p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          {report.incompletePayments} payment record(s) need a valid payment date, USD amount,
          or refund amount before they can be included. Report totals are incomplete.
        </p>
      )}

      <FinancialFiltersCard
        completion={completion}
        completionOptions={COMPLETION_OPTIONS.map(option => ({
          ...option,
          active: completion === option.key,
          href: `${buildHref({ preset: activeRangeKey, start: formStartDate || undefined, end: formEndDate || undefined, granularity: currentGranularity, completion: option.key })}#filters`,
        }))}
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
              completion,
            })}#filters`,
            active: activeRangeKey === "7d",
          },
          {
            key: "30d",
            label: "Last 30 days",
            href: `${buildHref({
              preset: "30d",
              granularity: currentGranularity,
              completion,
            })}#filters`,
            active: activeRangeKey === "30d",
          },
          {
            key: "month",
            label: "This month",
            href: `${buildHref({
              preset: "month",
              granularity: currentGranularity,
              completion,
            })}#filters`,
            active: activeRangeKey === "month",
          },
          {
            key: "all",
            label: "All time",
            href: `${buildHref({
              preset: "all",
              granularity: currentGranularity,
              completion,
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
              completion,
            })}#revenue-report`,
          }))
        }
      />

      <div className="mt-6 rounded-[14px] border border-orange-100 bg-orange-50/70 px-5 py-4 text-sm text-slate-700">
        Money collected includes recorded booking payments and additional charges, less recorded refunds,
        grouped by the original payment date in Eastern time. Completed jobs have been picked up;
        uncompleted jobs are confirmed, scheduled, or delivered. All jobs also includes cancelled jobs
        and payments awaiting a job. Refunds adjust the original payment period. This report reflects
        stored payment records, not bank deposits or live payment-provider reconciliation.
      </div>
    </AdminPage>
  );
}
