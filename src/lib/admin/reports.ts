import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBusinessTimeZone } from "@/lib/time";

export type DateRangeKey = "7d" | "30d" | "90d" | "6m" | "12m" | "all";
export type DeviceFilterKey = "all" | "desktop" | "mobile" | "tablet";
export type VisitorFilterKey = "all" | "new" | "returning";

export type ReportsFilters = {
  range: DateRangeKey;
  product: string;
  device: DeviceFilterKey;
  visitorType: VisitorFilterKey;
};

type BucketGranularity = "daily" | "weekly" | "monthly";

export type FilterOption = {
  value: string;
  label: string;
};

export type KpiMetric = {
  label: string;
  value: string;
  change: string | null;
  tone?: "default" | "success" | "warning";
  helper?: string;
  details?: Array<{
    label: string;
    value: string;
  }>;
};

export type BusinessTrendPoint = {
  label: string;
  bucketStart: string | null;
  revenue: number;
  bookings: number;
  repeatCustomerRate: number;
};

export type ProductMixRow = {
  label: string;
  revenue: number;
  bookings: number;
  revenueShare: number;
  bookingShare: number;
  avgOrderValue: number;
};

export type AdminReportsData = {
  filters: ReportsFilters;
  productOptions: FilterOption[];
  deviceOptions: FilterOption[];
  visitorTypeOptions: FilterOption[];
  businessKpis: KpiMetric[];
  businessTrends: BusinessTrendPoint[];
  productMix: ProductMixRow[];
  websiteFunnelKpis: KpiMetric[];
  websiteFunnelHasData: boolean;
  portalKpis: KpiMetric[];
  dateRangeLabel: string;
};

type PlainDate = {
  year: number;
  month: number;
  day: number;
};

type ReportsRpcSummary = {
  booked_revenue_cents?: number | string | null;
  booking_volume?: number | string | null;
  repeat_booking_count?: number | string | null;
};

type ReportsRpcPortalSummary = {
  bookedCustomerCount?: number | string | null;
  linkedCustomerCount?: number | string | null;
  portalUserCount?: number | string | null;
  newPortalUserCount?: number | string | null;
  requestCount?: number | string | null;
  requestBreakdown?: {
    pickupRequestCount?: number | string | null;
    extensionRequestCount?: number | string | null;
    issueReportCount?: number | string | null;
  } | null;
};

type ReportsRpcTrendRow = {
  bucket_start?: string | null;
  revenue_cents?: number | string | null;
  bookings?: number | string | null;
};

type ReportsRpcProductMixRow = {
  label?: string | null;
  revenue_cents?: number | string | null;
  bookings?: number | string | null;
};

type ReportsRpcProductOption = {
  value?: string | null;
  label?: string | null;
};

type ReportsRpcPayload = {
  summary?: ReportsRpcSummary | null;
  previousSummary?: ReportsRpcSummary | null;
  portalSummary?: ReportsRpcPortalSummary | null;
  previousPortalSummary?: ReportsRpcPortalSummary | null;
  trends?: ReportsRpcTrendRow[] | null;
  productMix?: ReportsRpcProductMixRow[] | null;
  productOptions?: ReportsRpcProductOption[] | null;
};

type WebsiteFunnelRpcSummary = {
  sessions_started?: number | string | null;
  completed_sessions?: number | string | null;
  resumed_sessions?: number | string | null;
  avg_completion_seconds?: number | string | null;
};

type WebsiteFunnelRpcDropoff = {
  source_step_label?: string | null;
  next_step_label?: string | null;
  lost?: number | string | null;
  reached_source?: number | string | null;
};

type WebsiteFunnelRpcPayload = {
  trackingStartedAt?: string | null;
  effectivePreviousStartAt?: string | null;
  summary?: WebsiteFunnelRpcSummary | null;
  previousSummary?: WebsiteFunnelRpcSummary | null;
  biggestDropoff?: WebsiteFunnelRpcDropoff | null;
};

export const DATE_RANGE_OPTIONS: FilterOption[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "6m", label: "6M" },
  { value: "12m", label: "12M" },
  { value: "all", label: "All time" },
];

export const DEVICE_TYPE_OPTIONS: FilterOption[] = [
  { value: "all", label: "All devices" },
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
  { value: "tablet", label: "Tablet" },
];

export const VISITOR_TYPE_OPTIONS: FilterOption[] = [
  { value: "all", label: "All visitors" },
  { value: "new", label: "New visitors" },
  { value: "returning", label: "Returning visitors" },
];

const ACCEPTED_PRODUCT_FILTER_PREFIXES = ["product:", "size:"];

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeProductFilter(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (trimmed === "all" || trimmed === "unknown") return trimmed;

  if (ACCEPTED_PRODUCT_FILTER_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return trimmed;
  }

  return "all";
}

function normalizeDeviceFilter(value: string | null | undefined): DeviceFilterKey {
  if (value === "desktop" || value === "mobile" || value === "tablet") return value;
  return "all";
}

function normalizeVisitorFilter(value: string | null | undefined): VisitorFilterKey {
  if (value === "new" || value === "returning") return value;
  return "all";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function formatPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

function formatRate(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function formatValueChange(current: number, previous: number, isComparable: boolean) {
  if (!isComparable || previous <= 0) return null;

  const change = ((current - previous) / previous) * 100;
  const prefix = change > 0 ? "+" : "";
  return `${prefix}${change.toFixed(1)}%`;
}

function formatDurationChange(currentSeconds: number, previousSeconds: number, isComparable: boolean) {
  return formatValueChange(currentSeconds, previousSeconds, isComparable);
}

function formatPointChange(currentRate: number, previousRate: number, isComparable: boolean, previousDenominator: number) {
  if (!isComparable || previousDenominator <= 0) return null;

  const change = currentRate - previousRate;
  const prefix = change > 0 ? "+" : "";
  return `${prefix}${change.toFixed(1)} pts`;
}

function toneForChange(change: string | null): KpiMetric["tone"] {
  if (!change) return "default";
  if (change.startsWith("+")) return "success";
  if (change.startsWith("-")) return "warning";
  return "default";
}

function toneForDurationChange(change: string | null): KpiMetric["tone"] {
  if (!change) return "default";
  if (change.startsWith("-")) return "success";
  if (change.startsWith("+")) return "warning";
  return "default";
}

function getZonedParts(date: Date, timeZone: string): PlainDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(lookup.get("year")),
    month: Number(lookup.get("month")),
    day: Number(lookup.get("day")),
  };
}

function addDays(date: PlainDate, days: number): PlainDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonths(date: PlainDate, months: number): PlainDate {
  const monthIndex = date.month - 1 + months;
  const targetYear = date.year + Math.floor(monthIndex / 12);
  const targetMonthIndex = ((monthIndex % 12) + 12) % 12;
  const targetMonth = targetMonthIndex + 1;

  return {
    year: targetYear,
    month: targetMonth,
    day: Math.min(date.day, daysInMonth(targetYear, targetMonth)),
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  const hour = Number(lookup.get("hour"));
  const asUtc = Date.UTC(
    Number(lookup.get("year")),
    Number(lookup.get("month")) - 1,
    Number(lookup.get("day")),
    hour === 24 ? 0 : hour,
    Number(lookup.get("minute")),
    Number(lookup.get("second")),
  );

  return asUtc - date.getTime();
}

function zonedStartOfDayToUtc(date: PlainDate, timeZone: string) {
  const utcGuess = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return new Date(utcGuess.getTime() - timeZoneOffsetMs(utcGuess, timeZone));
}

function trendGranularity(range: DateRangeKey): BucketGranularity {
  if (range === "90d" || range === "6m") return "weekly";
  if (range === "12m" || range === "all") return "monthly";
  return "daily";
}

function resolveDateWindow(range: DateRangeKey, timeZone: string, now = new Date()) {
  const today = getZonedParts(now, timeZone);
  const tomorrow = addDays(today, 1);
  const currentEnd = zonedStartOfDayToUtc(tomorrow, timeZone);

  if (range === "all") {
    return {
      currentStart: null as Date | null,
      currentEnd,
      previousStart: null as Date | null,
      previousEnd: null as Date | null,
      isComparable: false,
    };
  }

  const currentStart =
    range === "7d"
      ? zonedStartOfDayToUtc(addDays(today, -6), timeZone)
      : range === "30d"
        ? zonedStartOfDayToUtc(addDays(today, -29), timeZone)
        : range === "90d"
          ? zonedStartOfDayToUtc(addDays(today, -89), timeZone)
          : range === "6m"
            ? zonedStartOfDayToUtc(addMonths(today, -6), timeZone)
            : zonedStartOfDayToUtc(addMonths(today, -12), timeZone);

  const previousStart =
    range === "7d"
      ? zonedStartOfDayToUtc(addDays(today, -13), timeZone)
      : range === "30d"
        ? zonedStartOfDayToUtc(addDays(today, -59), timeZone)
        : range === "90d"
          ? zonedStartOfDayToUtc(addDays(today, -179), timeZone)
          : range === "6m"
            ? zonedStartOfDayToUtc(addMonths(addMonths(today, -6), -6), timeZone)
            : zonedStartOfDayToUtc(addMonths(addMonths(today, -12), -12), timeZone);

  return {
    currentStart,
    currentEnd,
    previousStart,
    previousEnd: currentStart,
    isComparable: true,
  };
}

function formatBucketLabel(bucketStart: string | null | undefined, granularity: string) {
  if (!bucketStart) return "";

  const datePart = bucketStart.slice(0, 10);
  const date = new Date(`${datePart}T12:00:00Z`);

  if (granularity === "monthly") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      year: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(date);
}

function parseOptionalDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDurationFromSeconds(value: number) {
  if (value <= 0) return "0 sec";

  const seconds = Math.round(value);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes <= 0) return `${seconds} sec`;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function dateRangeLabel(range: DateRangeKey) {
  return DATE_RANGE_OPTIONS.find((option) => option.value === range)?.label ?? "30D";
}

export function parseReportsFilters(input: Record<string, string | string[] | undefined>): ReportsFilters {
  const rawRange = input.range;
  const range = Array.isArray(rawRange) ? rawRange[0] : rawRange;
  const rawProduct = input.product;
  const product = Array.isArray(rawProduct) ? rawProduct[0] : rawProduct;
  const rawDevice = input.device;
  const device = Array.isArray(rawDevice) ? rawDevice[0] : rawDevice;
  const rawVisitorType = input.visitorType ?? input.visitor;
  const visitorType = Array.isArray(rawVisitorType) ? rawVisitorType[0] : rawVisitorType;

  return {
    range:
      range === "7d" || range === "30d" || range === "90d" || range === "6m" || range === "12m" || range === "all"
        ? range
        : "30d",
    product: normalizeProductFilter(product),
    device: normalizeDeviceFilter(device),
    visitorType: normalizeVisitorFilter(visitorType),
  };
}

export function buildReportsFilterHref(filters: ReportsFilters, patch: Partial<ReportsFilters>) {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();

  params.set("range", next.range);
  if (next.product !== "all") params.set("product", next.product);
  if (next.device !== "all") params.set("device", next.device);
  if (next.visitorType !== "all") params.set("visitorType", next.visitorType);

  return `/admin/analytics/conversion?${params.toString()}`;
}

export async function getAdminReportsData(input: {
  businessId: string;
  filters: ReportsFilters;
}): Promise<AdminReportsData> {
  const timeZone = getBusinessTimeZone();
  const window = resolveDateWindow(input.filters.range, timeZone);
  const granularity = trendGranularity(input.filters.range);

  const [businessMetricsResult, websiteFunnelResult] = await Promise.all([
    supabaseAdmin.rpc("get_admin_reports_business_metrics", {
      p_business_id: input.businessId,
      p_current_start_at: window.currentStart?.toISOString() ?? null,
      p_current_end_at: window.currentEnd.toISOString(),
      p_previous_start_at: window.previousStart?.toISOString() ?? null,
      p_previous_end_at: window.previousEnd?.toISOString() ?? null,
      p_product_filter: input.filters.product,
      p_bucket_granularity: granularity,
      p_time_zone: timeZone,
    }),
    supabaseAdmin.rpc("get_admin_reports_website_funnel_metrics", {
      p_business_id: input.businessId,
      p_current_start_at: window.currentStart?.toISOString() ?? null,
      p_current_end_at: window.currentEnd.toISOString(),
      p_previous_start_at: window.previousStart?.toISOString() ?? null,
      p_previous_end_at: window.previousEnd?.toISOString() ?? null,
      p_product_filter: input.filters.product,
      p_device_filter: input.filters.device,
      p_visitor_filter: input.filters.visitorType,
    }),
  ]);

  if (businessMetricsResult.error) {
    throw new Error(`Failed to load admin reports: ${businessMetricsResult.error.message}`);
  }

  if (websiteFunnelResult.error) {
    throw new Error(`Failed to load admin reports: ${websiteFunnelResult.error.message}`);
  }

  const payload = (businessMetricsResult.data ?? {}) as ReportsRpcPayload;
  const funnelPayload = (websiteFunnelResult.data ?? {}) as WebsiteFunnelRpcPayload;
  const summary = payload.summary ?? {};
  const previousSummary = payload.previousSummary ?? {};
  const portalSummary = payload.portalSummary ?? {};
  const previousPortalSummary = payload.previousPortalSummary ?? {};
  const funnelSummary = funnelPayload.summary ?? {};
  const previousFunnelSummary = funnelPayload.previousSummary ?? {};

  const revenueCents = numberValue(summary.booked_revenue_cents);
  const bookingVolume = numberValue(summary.booking_volume);
  const repeatBookings = numberValue(summary.repeat_booking_count);
  const repeatRate = formatRate(repeatBookings, bookingVolume);
  const previousRevenueCents = numberValue(previousSummary.booked_revenue_cents);
  const previousBookingVolume = numberValue(previousSummary.booking_volume);
  const previousRepeatBookings = numberValue(previousSummary.repeat_booking_count);
  const previousRepeatRate = formatRate(previousRepeatBookings, previousBookingVolume);

  const revenueChange = formatValueChange(revenueCents, previousRevenueCents, window.isComparable);
  const bookingChange = formatValueChange(bookingVolume, previousBookingVolume, window.isComparable);
  const repeatChange = formatPointChange(repeatRate, previousRepeatRate, window.isComparable, previousBookingVolume);

  const portalRequestCount = numberValue(portalSummary.requestCount);
  const portalUserCount = numberValue(portalSummary.portalUserCount);
  const newPortalUserCount = numberValue(portalSummary.newPortalUserCount);
  const previousPortalRequestCount = numberValue(previousPortalSummary.requestCount);
  const previousPortalUserCount = numberValue(previousPortalSummary.portalUserCount);
  const previousNewPortalUserCount = numberValue(previousPortalSummary.newPortalUserCount);
  const portalRequestChange = formatValueChange(portalRequestCount, previousPortalRequestCount, window.isComparable);
  const portalUserChange = formatValueChange(portalUserCount, previousPortalUserCount, window.isComparable);
  const newPortalUserChange = formatValueChange(
    newPortalUserCount,
    previousNewPortalUserCount,
    window.isComparable,
  );
  const portalRequestBreakdown = portalSummary.requestBreakdown ?? {};
  const portalPickupRequestCount = numberValue(portalRequestBreakdown.pickupRequestCount);
  const portalExtensionRequestCount = numberValue(portalRequestBreakdown.extensionRequestCount);
  const portalIssueRequestCount = numberValue(portalRequestBreakdown.issueReportCount);

  const funnelTrackingStartedAt = parseOptionalDate(funnelPayload.trackingStartedAt);
  const funnelIsComparable =
    window.isComparable &&
    (!funnelTrackingStartedAt || (window.previousStart !== null && window.previousStart >= funnelTrackingStartedAt));

  const sessionsStarted = numberValue(funnelSummary.sessions_started);
  const completedSessions = numberValue(funnelSummary.completed_sessions);
  const resumedSessions = numberValue(funnelSummary.resumed_sessions);
  const avgCompletionSeconds = numberValue(funnelSummary.avg_completion_seconds);
  const conversionRate = formatRate(completedSessions, sessionsStarted);
  const resumeRate = formatRate(resumedSessions, sessionsStarted);

  const previousSessionsStarted = numberValue(previousFunnelSummary.sessions_started);
  const previousCompletedSessions = numberValue(previousFunnelSummary.completed_sessions);
  const previousResumedSessions = numberValue(previousFunnelSummary.resumed_sessions);
  const previousAvgCompletionSeconds = numberValue(previousFunnelSummary.avg_completion_seconds);
  const previousConversionRate = formatRate(previousCompletedSessions, previousSessionsStarted);
  const previousResumeRate = formatRate(previousResumedSessions, previousSessionsStarted);

  const sessionsStartedChange = formatValueChange(sessionsStarted, previousSessionsStarted, funnelIsComparable);
  const completedSessionsChange = formatValueChange(
    completedSessions,
    previousCompletedSessions,
    funnelIsComparable,
  );
  const conversionRateChange = formatPointChange(
    conversionRate,
    previousConversionRate,
    funnelIsComparable,
    previousSessionsStarted,
  );
  const resumeRateChange = formatPointChange(resumeRate, previousResumeRate, funnelIsComparable, previousSessionsStarted);
  const avgCompletionChange = formatDurationChange(
    avgCompletionSeconds,
    previousAvgCompletionSeconds,
    funnelIsComparable,
  );

  const biggestDropoff = funnelPayload.biggestDropoff ?? {};
  const dropoffLost = numberValue(biggestDropoff.lost);
  const dropoffReached = numberValue(biggestDropoff.reached_source);
  const dropoffSourceLabel = biggestDropoff.source_step_label?.trim();
  const dropoffNextLabel = biggestDropoff.next_step_label?.trim();
  const biggestDropoffValue =
    dropoffLost > 0 && dropoffSourceLabel && dropoffNextLabel
      ? `${dropoffSourceLabel} to ${dropoffNextLabel}`
      : "No drop-off";
  const biggestDropoffHelper =
    dropoffLost > 0
      ? `${formatNumber(dropoffLost)} of ${formatNumber(dropoffReached)} sessions stopped before the next step.`
      : "No tracked step currently has measurable abandonment in this period.";

  const businessTrends = (payload.trends ?? []).map((row) => ({
    label: formatBucketLabel(row.bucket_start, granularity),
    bucketStart: row.bucket_start ?? null,
    revenue: numberValue(row.revenue_cents) / 100,
    bookings: numberValue(row.bookings),
    repeatCustomerRate: 0,
  }));

  const productMixRevenueCents = (payload.productMix ?? []).reduce(
    (sum, row) => sum + numberValue(row.revenue_cents),
    0,
  );
  const productMixBookings = (payload.productMix ?? []).reduce((sum, row) => sum + numberValue(row.bookings), 0);

  const productMix = (payload.productMix ?? []).map((row) => {
    const rowRevenueCents = numberValue(row.revenue_cents);
    const rowBookings = numberValue(row.bookings);

    return {
      label: row.label?.trim() || "Unknown dumpster type",
      revenue: rowRevenueCents / 100,
      bookings: rowBookings,
      revenueShare: productMixRevenueCents > 0 ? (rowRevenueCents / productMixRevenueCents) * 100 : 0,
      bookingShare: productMixBookings > 0 ? (rowBookings / productMixBookings) * 100 : 0,
      avgOrderValue: rowBookings > 0 ? rowRevenueCents / 100 / rowBookings : 0,
    };
  });

  const productOptions = [
    { value: "all", label: "All dumpster types" },
    ...(payload.productOptions ?? [])
      .filter((option): option is { value: string; label: string } => Boolean(option.value && option.label))
      .map((option) => ({ value: option.value, label: option.label })),
  ];

  return {
    filters: input.filters,
    dateRangeLabel: dateRangeLabel(input.filters.range),
    productOptions,
    deviceOptions: DEVICE_TYPE_OPTIONS,
    visitorTypeOptions: VISITOR_TYPE_OPTIONS,
    businessKpis: [
      {
        label: "Booked revenue",
        value: formatCurrencyFromCents(revenueCents),
        change: revenueChange,
        tone: toneForChange(revenueChange),
        helper: "Total booked rental value in the selected period.",
      },
      {
        label: "Booking volume",
        value: formatNumber(bookingVolume),
        change: bookingChange,
        tone: toneForChange(bookingChange),
        helper: "Bookings accepted in the selected period.",
      },
      {
        label: "Repeat customer rate",
        value: bookingVolume > 0 ? formatPercent(repeatRate) : "0%",
        change: repeatChange,
        tone: toneForChange(repeatChange),
        helper: "Accepted bookings from customers with an earlier booking for this business.",
      },
    ],
    businessTrends,
    productMix,
    websiteFunnelKpis: [
      {
        label: "Booking sessions started",
        value: formatNumber(sessionsStarted),
        change: sessionsStartedChange,
        tone: toneForChange(sessionsStartedChange),
        helper: "Visitors who started the online booking process",
      },
      {
        label: "Completed bookings",
        value: formatNumber(completedSessions),
        change: completedSessionsChange,
        tone: toneForChange(completedSessionsChange),
        helper: "Online booking sessions that resulted in a completed booking.",
      },
      {
        label: "Overall conversion rate",
        value: sessionsStarted > 0 ? formatPercent(conversionRate) : "0%",
        change: conversionRateChange,
        tone: toneForChange(conversionRateChange),
        helper: "Completed booking sessions divided by booking sessions started.",
      },
      {
        label: "Biggest drop-off step",
        value: biggestDropoffValue,
        change: null,
        tone: dropoffLost > 0 ? "warning" : "default",
        helper: biggestDropoffHelper,
      },
      {
        label: "Average time to complete",
        value: formatDurationFromSeconds(avgCompletionSeconds),
        change: avgCompletionChange,
        tone: toneForDurationChange(avgCompletionChange),
        helper: "Average time to complete a booking",
      },
      {
        label: "Return / resume rate",
        value: sessionsStarted > 0 ? formatPercent(resumeRate) : "0%",
        change: resumeRateChange,
        tone: toneForChange(resumeRateChange),
        helper: "Sessions that resumed after the configured inactivity threshold.",
      },
    ],
    websiteFunnelHasData: sessionsStarted > 0,
    portalKpis: [
      {
        label: "Portal users",
        value: formatNumber(portalUserCount),
        change: portalUserChange,
        tone: toneForChange(portalUserChange),
        helper: "Customers who accessed the portal during the selected period.",
      },
      {
        label: "New portal users",
        value: formatNumber(newPortalUserCount),
        change: newPortalUserChange,
        tone: toneForChange(newPortalUserChange),
        helper: "Customers who received portal access during the selected period.",
      },
      {
        label: "Portal requests submitted",
        value: formatNumber(portalRequestCount),
        change: portalRequestChange,
        tone: toneForChange(portalRequestChange),
        details: [
          { label: "Pickup requests", value: formatNumber(portalPickupRequestCount) },
          { label: "Extension requests", value: formatNumber(portalExtensionRequestCount) },
          { label: "Issue requests", value: formatNumber(portalIssueRequestCount) },
        ],
      },
    ],
  };
}
