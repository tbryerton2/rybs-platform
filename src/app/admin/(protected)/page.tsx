import Link from "next/link";
import type { SVGProps } from "react";
import {
  ArrowUturnLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  MapPinIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { AdminPage, AdminPageHeader } from "../_components/admin/admin-page";
import { NeedsAttentionList, type NeedsAttentionRow } from "../_components/NeedsAttentionList";
import { SnapshotCard } from "../_components/SnapshotCard";
import { getDumpsters } from "./equipment/dumpsters/data";
import {
  getFleetEquipmentInspectionStatusMap,
  getFleetEquipmentMaintenanceAttentionIds,
} from "./trucks-trailers/data";
import { listFleetEquipment } from "@/lib/admin/fleet-equipment";
import { shouldCountFleetEquipmentForMaintenanceAttention } from "@/lib/admin/fleet-equipment-attention";
import { listEmployeesForCurrentBusiness } from "@/lib/admin/employees.server";
import { listExpensesForCurrentBusiness } from "@/lib/admin/expenses.server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdminOwner } from "@/lib/admin/auth";
import { centsToDollars, formatUsd, formatUsdFromCents } from "@/lib/money";
import { formatCustomerName } from "@/lib/customer-name";
import {
  ANALYTICS_DATA_MODE,
  buildConversionAnalytics,
} from "./analytics/conversion/mock-data";

export const dynamic = "force-dynamic";

type BookingStatus = "confirmed" | "scheduled" | "delivered" | "picked_up" | "cancelled" | "paid";

type DashboardBookingRow = {
  id: string;
  booking_ref: string | null;
  customer_id: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string | null;
  pickup_date: string | null;
  pickup_mode: "request" | "schedule" | null;
  status: BookingStatus | null;
  total_price_cents: number | null;
  created_at: string | null;
};

type RentalActionRequestRow = {
  id: string;
  action_type: "pickup_request" | "extension_request" | "issue_report";
  status: "submitted" | "under_review" | "approved" | "denied" | "completed";
  priority: "low" | "normal" | "high" | "urgent";
  submitted_at: string;
};

const ACTIVE_BOOKING_STATUSES = new Set<BookingStatus>(["confirmed", "scheduled", "delivered"]);
const OPEN_REQUEST_STATUSES = new Set<RentalActionRequestRow["status"]>(["submitted", "under_review", "approved"]);
const BOOKING_SELECT =
  "id, booking_ref, customer_id, customer_first_name, customer_last_name, customer_city, customer_zip, delivery_date, pickup_date, pickup_mode, status, total_price_cents, created_at";

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function OctagonAlert(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.172 2.75h5.656a2 2 0 0 1 1.414.586l5.172 5.172a2 2 0 0 1 .586 1.414v4.156a2 2 0 0 1-.586 1.414l-5.172 5.172a2 2 0 0 1-1.414.586H9.172a2 2 0 0 1-1.414-.586l-5.172-5.172A2 2 0 0 1 2 14.078V9.922a2 2 0 0 1 .586-1.414L7.758 3.336a2 2 0 0 1 1.414-.586Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.75v5.5" />
      <circle cx="12" cy="16.25" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function todayISOET() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toDateOnlyISO(value: string) {
  return value.slice(0, 10);
}

function parseISODate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfWeekMonday(value: string) {
  const parsed = parseISODate(value);
  if (!parsed) return value;
  const day = parsed.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return toDateOnlyISO(addDays(parsed, diff).toISOString());
}

function formatDateLabel(value: string) {
  const parsed = parseISODate(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(parsed);
}

function formatDashboardDate(value: string) {
  const parsed = parseISODate(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(parsed);
}

function formatDayLabel(value: string, todayIso: string) {
  if (value === todayIso) return "Today";

  const tomorrowIso = toDateOnlyISO(addDays(parseISODate(todayIso) ?? new Date(), 1).toISOString());
  if (value === tomorrowIso) return "Tomorrow";

  const parsed = parseISODate(value);
  if (!parsed) return value;

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/New_York",
  }).format(parsed);
}

function formatRelativeTime(value: string | null) {
  const parsed = parseTimestamp(value);
  if (!parsed) return "—";

  const diffMs = parsed.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");

  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, "day");
}

function timestampToDateOnlyISOET(value: string | null | undefined) {
  if (!value) return null;
  const parsed = parseTimestamp(value);
  if (!parsed) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function isDateWithinNextDays(value: string, days: number) {
  const parsed = parseISODate(value);
  if (!parsed) return false;

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = (parsed.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}

function startOfDayIso(daysAgo = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function statusLabel(status: BookingStatus | null) {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "scheduled":
      return "Scheduled";
    case "delivered":
      return "Delivered";
    case "picked_up":
      return "Picked Up";
    case "cancelled":
      return "Cancelled";
    case "paid":
      return "Paid";
    default:
      return "Unknown";
  }
}

function statusTone(status: BookingStatus | null) {
  switch (status) {
    case "confirmed":
    case "paid":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "scheduled":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "delivered":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "picked_up":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "cancelled":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function sectionShell(extra?: string) {
  return joinClasses(
    "rounded-[30px] border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.05)]",
    extra,
  );
}

function SectionCard({
  title,
  subtitle,
  tooltip,
  actionHref,
  actionLabel,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  tooltip?: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={sectionShell(joinClasses("flex h-full flex-col", className))}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-6 py-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
            {tooltip ? (
              <button
                type="button"
                aria-label={`${title} definition`}
                className="group relative rounded-full p-0.5 text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2"
              >
                <InformationCircleIcon className="h-4.5 w-4.5" aria-hidden="true" />
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-0 top-7 z-50 w-64 translate-y-1 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-left text-xs font-medium leading-5 text-slate-600 opacity-0 shadow-[0_16px_36px_rgba(15,23,42,0.14)] transition duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
                >
                  {tooltip}
                </span>
              </button>
            ) : null}
          </div>
          {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p> : null}
        </div>

        {actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[#F97316] transition hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/25 focus-visible:ring-offset-2"
          >
            {actionLabel ?? "View"}
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      <div className="flex-1 p-6">{children}</div>
    </section>
  );
}

function MiniRevenueChart({
  values,
}: {
  values: Array<{ label: string; value: number }>;
}) {
  const maxValue = Math.max(...values.map((entry) => entry.value), 1);
  const hasChartData = values.some((entry) => entry.value > 0);
  const meaningfulPoints = values.filter((entry) => entry.value > 0).length;

  if (!hasChartData || meaningfulPoints < 2) {
    return (
      <div className="rounded-[22px] bg-slate-50/60 px-4 py-6 text-center">
        <div className="text-sm font-semibold text-slate-900">Not enough recent revenue to chart yet</div>
        <div className="mt-1 text-xs leading-5 text-slate-500">
          This view will show a trend once multiple recent periods have booked revenue.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[22px] bg-slate-50/60 px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Last 30 Days</div>
        <div className="text-xs font-medium text-slate-500">Booked revenue by period</div>
      </div>
      <div className="flex h-36 items-end gap-3">
        {values.map((entry) => (
          <div key={entry.label} className="flex min-w-0 flex-1 flex-col items-center gap-3">
            <div className="text-[11px] font-semibold text-slate-500">
              {formatUsd(entry.value, { maximumFractionDigits: 0 })}
            </div>
            <div
              className="w-full rounded-t-2xl bg-gradient-to-t from-[#F97316] via-orange-500 to-orange-300 shadow-[0_8px_18px_rgba(249,115,22,0.18)]"
              style={{ height: `${Math.max((entry.value / maxValue) * 100, 14)}%` }}
            />
            <div className="text-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{entry.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FunnelBarRow({
  label,
  value,
  displayValue,
  barWidth,
  tone,
}: {
  label: string;
  value: string | number;
  displayValue?: string;
  barWidth: number;
  tone: "strong" | "medium" | "soft" | "light";
}) {
  const toneClasses =
    tone === "strong"
      ? {
          fill: "bg-amber-300",
          track: "bg-slate-100/65",
          text: "text-slate-900",
        }
      : tone === "medium"
        ? {
            fill: "bg-orange-300",
            track: "bg-slate-100/65",
            text: "text-slate-900",
          }
        : tone === "soft"
          ? {
              fill: "bg-rose-300",
              track: "bg-slate-100/65",
              text: "text-slate-900",
            }
          : {
              fill: "bg-violet-200",
              track: "bg-slate-100/65",
              text: "text-slate-900",
            };

  return (
    <div className="py-[5px] first:pt-0 last:pb-0">
      <div className={joinClasses("rounded-2xl p-px", toneClasses.track)}>
        <div
          className={joinClasses(
            "flex min-h-9 items-center justify-between rounded-[15px] px-4 py-2 shadow-[inset_0_-1px_0_rgba(15,23,42,0.06),0_1px_1px_rgba(15,23,42,0.04)]",
            toneClasses.fill,
            toneClasses.text,
            tone === "strong" && "font-semibold shadow-[inset_0_-1px_0_rgba(15,23,42,0.08),0_1px_1px_rgba(15,23,42,0.05)]",
          )}
          style={{ width: `${Math.max(barWidth, 8)}%`, minWidth: "11rem", maxWidth: "100%" }}
        >
          <div className={joinClasses("truncate text-sm", tone === "strong" ? "font-semibold" : "font-medium")}>{label}</div>
          <div className={joinClasses("ml-3 shrink-0 text-sm", tone === "strong" ? "font-semibold" : "font-medium")}>{displayValue ?? value}</div>
        </div>
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const adminSession = await requireAdminOwner();
  const supabase = supabaseServer();
  const todayStr = todayISOET();
  const nextFiveDays = Array.from({ length: 5 }, (_, index) =>
    toDateOnlyISO(addDays(parseISODate(todayStr) ?? new Date(), index).toISOString()),
  );
  const last30StartIso = startOfDayIso(29);
  const now = new Date();

  const [
    activeBookingsResult,
    recentBookingsResult,
    last30BookingsResult,
    collectedLast30Result,
    portalRequestsResult,
    employeesResult,
    expensesResult,
    dumpstersResult,
    fleetEquipmentResult,
    fleetEquipmentMaintenanceAttentionIdsResult,
    fleetEquipmentInspectionStatusByIdResult,
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("business_id", adminSession.business.id)
      .in("status", Array.from(ACTIVE_BOOKING_STATUSES))
      .order("delivery_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("business_id", adminSession.business.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("business_id", adminSession.business.id)
      .neq("status", "cancelled")
      .gte("created_at", last30StartIso)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("total_price_cents")
      .eq("business_id", adminSession.business.id)
      .in("status", ["delivered", "picked_up"])
      .gte("delivery_date", toDateOnlyISO(last30StartIso))
      .lte("delivery_date", todayStr),
    supabase
      .from("rental_action_requests")
      .select("id, action_type, status, priority, submitted_at")
      .eq("business_id", adminSession.business.id)
      .order("submitted_at", { ascending: false }),
    listEmployeesForCurrentBusiness({ includeInactive: true }),
    listExpensesForCurrentBusiness(),
    getDumpsters(adminSession.business.id),
    listFleetEquipment(adminSession.business.id),
    getFleetEquipmentMaintenanceAttentionIds(adminSession.business.id),
    getFleetEquipmentInspectionStatusMap(adminSession.business.id),
  ]);

  if (activeBookingsResult.error) throw new Error(activeBookingsResult.error.message);
  if (recentBookingsResult.error) throw new Error(recentBookingsResult.error.message);
  if (last30BookingsResult.error) throw new Error(last30BookingsResult.error.message);
  if (collectedLast30Result.error) throw new Error(collectedLast30Result.error.message);
  if (portalRequestsResult.error) throw new Error(portalRequestsResult.error.message);

  const activeBookings = (activeBookingsResult.data ?? []) as DashboardBookingRow[];
  const recentBookings = (recentBookingsResult.data ?? []) as DashboardBookingRow[];
  const last30Bookings = (last30BookingsResult.data ?? []) as DashboardBookingRow[];
  const collectedLast30Rows = (collectedLast30Result.data ?? []) as Array<{ total_price_cents: number | null }>;
  const portalRequests = (portalRequestsResult.data ?? []) as RentalActionRequestRow[];
  const employees = employeesResult;
  const expenses = expensesResult;
  const dumpsters = dumpstersResult;
  const fleetEquipment = fleetEquipmentResult;
  const fleetEquipmentMaintenanceAttentionIdSet = new Set(fleetEquipmentMaintenanceAttentionIdsResult);
  const fleetEquipmentInspectionStatusById = fleetEquipmentInspectionStatusByIdResult;

  const deliveriesToday = activeBookings.filter(
    (booking) =>
      (booking.status === "confirmed" || booking.status === "scheduled") && booking.delivery_date === todayStr,
  );
  const pickupsToday = activeBookings.filter(
    (booking) => booking.status === "delivered" && booking.pickup_date === todayStr,
  );
  const overdueDeliveries = activeBookings.filter(
    (booking) =>
      (booking.status === "confirmed" || booking.status === "scheduled") &&
      Boolean(booking.delivery_date) &&
      (booking.delivery_date as string) < todayStr,
  );
  const overduePickups = activeBookings.filter(
    (booking) => booking.status === "delivered" && Boolean(booking.pickup_date) && (booking.pickup_date as string) < todayStr,
  );
  const stopsScheduled = deliveriesToday.length + pickupsToday.length;
  const pickupRequestsAwaitingReview = portalRequests.filter(
    (request) => request.status === "submitted" || request.status === "under_review",
  );
  const requestsSitting24h = portalRequests.filter(
    (request) => OPEN_REQUEST_STATUSES.has(request.status) && now.getTime() - new Date(request.submitted_at).getTime() >= 24 * 60 * 60 * 1000,
  );
  const portalRequestIdsNeedingAttention = new Set([
    ...pickupRequestsAwaitingReview.map((request) => request.id),
    ...requestsSitting24h.map((request) => request.id),
  ]);
  const portalRequestsNeedingAttentionCount = portalRequestIdsNeedingAttention.size;
  const employeesWithLicensesExpiringCount = employees.filter(
    (employee) => employee.licenseExpiration && isDateWithinNextDays(employee.licenseExpiration, 90),
  ).length;
  const outstandingExpensesCount = expenses.filter((expense) => expense.paymentStatus === "Outstanding").length;
  const dumpstersNeedingMaintenanceCount = dumpsters.filter((dumpster) => Boolean(dumpster.serviceWarning)).length;
  const fleetEquipmentNeedingMaintenanceCount = fleetEquipment.filter((item) =>
    shouldCountFleetEquipmentForMaintenanceAttention(item, {
      serviceDateAttentionIds: fleetEquipmentMaintenanceAttentionIdSet,
      inspectionStatusById: fleetEquipmentInspectionStatusById,
    }),
  ).length;

  const scheduleRows = nextFiveDays.map((dayIso) => {
    const deliveries = activeBookings.filter(
      (booking) =>
        (booking.status === "confirmed" || booking.status === "scheduled") && booking.delivery_date === dayIso,
    ).length;
    const pickups = activeBookings.filter(
      (booking) => booking.status === "delivered" && booking.pickup_date === dayIso,
    ).length;
    const active = activeBookings.filter((booking) => {
      if (!booking.delivery_date) return false;
      if (booking.delivery_date > dayIso) return false;
      if (booking.status === "delivered" && booking.pickup_date && booking.pickup_date <= dayIso) return false;
      return booking.status !== "picked_up" && booking.status !== "cancelled";
    }).length;

    return {
      dayIso,
      label: formatDayLabel(dayIso, todayStr),
      href: `/admin/schedule?week=${startOfWeekMonday(dayIso)}`,
      deliveries,
      pickups,
      active,
    };
  });

  const bookedRevenue30Dollars = last30Bookings.reduce(
    (sum, booking) => sum + (centsToDollars(booking.total_price_cents) ?? 0),
    0,
  );
  const collectedRevenue30Dollars = collectedLast30Rows.reduce(
    (sum, row) => sum + (centsToDollars(row.total_price_cents) ?? 0),
    0,
  );
  const outstandingRevenueDollars = activeBookings.reduce(
    (sum, booking) => sum + (centsToDollars(booking.total_price_cents) ?? 0),
    0,
  );
  const avgBookingDollars = last30Bookings.length > 0 ? bookedRevenue30Dollars / last30Bookings.length : null;

  const weekLabels = ["Wk 1", "Wk 2", "Wk 3", "Wk 4"];
  const revenueByWeek = [0, 0, 0, 0];
  const last30StartDate = new Date(last30StartIso);

  for (const booking of last30Bookings) {
    const createdAt = parseTimestamp(booking.created_at);
    if (!createdAt) continue;
    const diffDays = Math.max(0, Math.floor((createdAt.getTime() - last30StartDate.getTime()) / (1000 * 60 * 60 * 24)));
    const bucketIndex = Math.min(3, Math.floor(diffDays / 7.5));
    revenueByWeek[bucketIndex] += centsToDollars(booking.total_price_cents) ?? 0;
  }

  const revenueTrend = weekLabels.map((label, index) => ({
    label,
    value: revenueByWeek[index],
  }));

  const analytics = buildConversionAnalytics({
    range: "30d",
    device: "all",
    area: "all",
    product: "all",
    visitorType: "all",
  });
  const funnelStarted = analytics.funnel[0]?.sessions ?? 0;
  const funnelReview = analytics.funnel.find((step) => step.key === "review")?.sessions ?? 0;
  const funnelCompleted = analytics.funnel.find((step) => step.key === "complete")?.sessions ?? 0;
  const funnelConversion = funnelStarted > 0 ? (funnelCompleted / funnelStarted) * 100 : 0;

  const topAreasMap = new Map<string, { bookings: number; revenue: number }>();
  for (const booking of last30Bookings) {
    const zip = booking.customer_zip?.trim();
    if (!zip) continue;
    const current = topAreasMap.get(zip) ?? { bookings: 0, revenue: 0 };
    current.bookings += 1;
    current.revenue += centsToDollars(booking.total_price_cents) ?? 0;
    topAreasMap.set(zip, current);
  }

  const topAreas = Array.from(topAreasMap.entries())
    .map(([zip, value]) => ({
      zip,
      bookings: value.bookings,
      revenue: value.revenue,
      share: bookedRevenue30Dollars > 0 ? (value.revenue / bookedRevenue30Dollars) * 100 : 0,
    }))
    .sort((left, right) => right.bookings - left.bookings || right.revenue - left.revenue)
    .slice(0, 5);
  const topAreaMaxShare = Math.max(...topAreas.map((area) => area.share), 0);

  const snapshotCards = [
    {
      label: "Stops Scheduled",
      value: stopsScheduled,
      tooltip: "Stops Scheduled is the combined total of today’s delivery stops and pickup stops.",
      icon: MapPinIcon,
      toneKey: "amber" as const,
      href: "/admin/schedule",
    },
    {
      label: "Deliveries Today",
      value: deliveriesToday.length,
      tooltip: "Deliveries Today counts confirmed or scheduled drop-offs with a delivery date of today.",
      icon: TruckIcon,
      toneKey: "green" as const,
      href: `/admin/bookings?datePreset=today&dateField=delivery_date`,
    },
    {
      label: "Pickups Today",
      value: pickupsToday.length,
      tooltip: "Pickups Today counts delivered rentals with a pickup date of today.",
      icon: ArrowUturnLeftIcon,
      toneKey: "blue" as const,
      href: `/admin/bookings?datePreset=today&dateField=pickup_date`,
    },
    {
      label: "Overdue Deliveries",
      value: overdueDeliveries.length,
      tooltip: "A delivery becomes overdue when a confirmed or scheduled drop-off date has already passed.",
      icon: OctagonAlert,
      toneKey: "violet" as const,
      href: "/admin/bookings?quickView=overdue_confirmed",
    },
    {
      label: "Overdue Pickups",
      value: overduePickups.length,
      tooltip: "A pickup becomes overdue when a delivered rental has a scheduled pickup date that has already passed.",
      icon: ExclamationTriangleIcon,
      href: "/admin/bookings?quickView=overdue_pickups",
      tone: "alert" as const,
    },
  ];

  const latestBookingActivity = recentBookings.slice(0, 5);
  const sevenDaysAgoStr = toDateOnlyISO(addDays(parseISODate(todayStr) ?? new Date(), -7).toISOString());
  const latestBookingGroups = {
    today: latestBookingActivity.filter((booking) => timestampToDateOnlyISOET(booking.created_at) === todayStr),
    thisWeek: latestBookingActivity.filter((booking) => {
      const createdDate = timestampToDateOnlyISOET(booking.created_at);
      return Boolean(createdDate && createdDate !== todayStr && createdDate >= sevenDaysAgoStr);
    }),
    earlier: latestBookingActivity.filter((booking) => {
      const createdDate = timestampToDateOnlyISOET(booking.created_at);
      return Boolean(createdDate && createdDate < sevenDaysAgoStr);
    }),
  };
  const hasNewBookingsLast7Days = latestBookingGroups.today.length > 0 || latestBookingGroups.thisWeek.length > 0;

  const needsAttentionRows = ([
    {
      label: "Portal Requests",
      count: portalRequestsNeedingAttentionCount,
      href: "/admin/portal-requests?filter=attention",
      icon: "portal-requests",
      tone: "portal",
    },
    {
      label: "Overdue Pickups",
      count: overduePickups.length,
      href: "/admin/bookings?status=pickup_overdue&filtersPanel=closed",
      icon: "overdue-pickups",
      tone: "danger",
    },
    {
      label: "Overdue Deliveries",
      count: overdueDeliveries.length,
      href: "/admin/bookings?status=delivery_overdue&filtersPanel=closed",
      icon: "overdue-deliveries",
      tone: "violet",
    },
    {
      label: "Employees with Licenses Expiring",
      count: employeesWithLicensesExpiringCount,
      href: "/admin/employees",
      icon: "licenses",
      tone: "amber",
    },
    {
      label: "Outstanding Expenses",
      count: outstandingExpensesCount,
      href: "/admin/expenses?status=Outstanding",
      icon: "expenses",
      tone: "amber",
    },
    {
      label: "Dumpsters Needing Maintenance",
      count: dumpstersNeedingMaintenanceCount,
      href: "/admin/equipment/dumpsters?filter=maintenance",
      icon: "dumpsters",
      tone: "amber",
    },
    {
      label: "Trucks / Trailers Needing Maintenance",
      count: fleetEquipmentNeedingMaintenanceCount,
      href: "/admin/trucks-trailers?filter=maintenance",
      icon: "fleet",
      tone: "amber",
    },
  ] satisfies NeedsAttentionRow[]).filter((row) => row.count > 0);

  return (
    <AdminPage width="wide" className="space-y-8">
      <AdminPageHeader
        title={
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span>Dashboard</span>
            <span aria-hidden="true" className="h-6 w-px self-center bg-slate-200" />
            <span className="text-lg font-medium text-slate-500 sm:text-xl">{formatDashboardDate(todayStr)}</span>
          </span>
        }
      />

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-lg font-semibold uppercase tracking-[0.16em] text-slate-700">Today&apos;s Snapshot</h2>
          <Link
            href="/admin/schedule"
            className="inline-flex shrink-0 items-center text-sm font-semibold text-[#F97316] transition hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/25 focus-visible:ring-offset-2"
          >
            View full schedule →
          </Link>
        </div>

        <div className="grid auto-rows-fr gap-4 overflow-visible sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {snapshotCards.map((card) => (
            <SnapshotCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-2">
        <SectionCard
          title="Needs Attention"
          tooltip="This list highlights the active issues the office or dispatcher can act on right now."
        >
          <NeedsAttentionList rows={needsAttentionRows} />
        </SectionCard>

        <SectionCard
          title="Upcoming Schedule"
          actionHref="/admin/schedule"
          actionLabel="Open Schedule"
        >
          <div className="overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_88px_88px] gap-3 px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:grid-cols-[minmax(0,1.1fr)_96px_96px] xl:grid-cols-[minmax(0,1.2fr)_104px_104px]">
              <div>Day</div>
              <div className="text-right">Deliveries</div>
              <div className="text-right">Pickups</div>
            </div>

            <div className="divide-y divide-slate-200/80">
              {scheduleRows.map((row) => (
                <Link
                  key={row.dayIso}
                  href={row.href}
                  className={joinClasses(
                    "grid grid-cols-[minmax(0,1fr)_88px_88px] items-center gap-3 px-2 py-3 transition-colors duration-150 hover:bg-orange-50/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/25 focus-visible:ring-offset-2 sm:grid-cols-[minmax(0,1.1fr)_96px_96px] xl:grid-cols-[minmax(0,1.2fr)_104px_104px]",
                    row.dayIso === todayStr && "bg-orange-50/35",
                  )}
                >
                  <div
                    className={joinClasses(
                      "truncate text-sm font-semibold",
                      row.dayIso === todayStr ? "text-slate-950" : "text-slate-900",
                    )}
                  >
                    {row.label}
                  </div>
                  <div className="text-right text-sm font-semibold text-sky-700">{number(row.deliveries)}</div>
                  <div className="text-right text-sm font-semibold text-amber-700">{number(row.pickups)}</div>
                </Link>
              ))}
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 2xl:grid-cols-2">
        <SectionCard
          title="Latest Booking Activity"
          tooltip="Latest Booking Activity shows the newest booking creation activity so the office can quickly gauge how recent incoming work has been."
          actionHref="/admin/bookings"
          actionLabel="View All Bookings"
        >
          <div>
            {latestBookingActivity.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-sm text-slate-500">
                <div className="font-medium text-slate-700">No bookings yet</div>
                <div className="mt-1">New customer bookings will appear here.</div>
              </div>
            ) : (
              <div className="space-y-5">
                {!hasNewBookingsLast7Days ? (
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm text-slate-500">
                    No new bookings in the last 7 days
                  </div>
                ) : null}

                {[
                  { label: "Today", bookings: latestBookingGroups.today },
                  { label: "This week", bookings: latestBookingGroups.thisWeek },
                  { label: "Earlier", bookings: latestBookingGroups.earlier },
                ].map((group) =>
                  group.bookings.length > 0 ? (
                    <div key={group.label}>
                      <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        {group.label}
                      </div>
                      <div className="divide-y divide-slate-200/80">
                        {group.bookings.map((booking) => (
                          <Link
                            key={booking.id}
                            href={`/admin/bookings/${booking.id}`}
                            className="flex items-start justify-between gap-4 px-2 py-3 transition-colors duration-150 first:pt-0 last:pb-0 hover:bg-orange-50/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/25 focus-visible:ring-offset-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-6">
                                <div className="min-w-0 flex-1">
                                  <div className="min-w-0 text-base font-semibold tracking-tight text-slate-900">
                                    <span>
                                      {formatCustomerName(
                                        booking.customer_first_name,
                                        booking.customer_last_name,
                                        "Unnamed customer",
                                      )}
                                    </span>
                                    <span className="ml-1.5 text-xs font-normal text-slate-500">
                                      &middot; {booking.booking_ref ?? `Booking ${booking.id.slice(0, 8)}`}
                                    </span>
                                  </div>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                                    <span
                                      className={joinClasses(
                                        "rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                                        statusTone(booking.status),
                                      )}
                                    >
                                      {statusLabel(booking.status)}
                                    </span>
                                    <span>
                                      {booking.delivery_date ? `Delivery ${formatDateLabel(booking.delivery_date)}` : "Delivery date not set"}
                                    </span>
                                  </div>
                                  <div className="mt-2 text-xs text-slate-500">
                                    Created {formatRelativeTime(booking.created_at)}
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <div className="text-lg font-semibold tracking-tight text-slate-900">
                                    {formatUsdFromCents(booking.total_price_cents, { maximumFractionDigits: 0 })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Revenue Snapshot"
          tooltip="Revenue Snapshot gives a quick read on recent booked value, collected revenue, outstanding work, and average booking size."
          actionHref="/admin/financials"
          actionLabel="Open Financials"
        >
          <MiniRevenueChart values={revenueTrend} />

          <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {[
              {
                label: "Booked Revenue",
                value: formatUsd(bookedRevenue30Dollars, { maximumFractionDigits: 0 }),
                helper: "Booked in last 30 days",
                tones: "border-sky-200/70 bg-sky-50/55",
              },
              {
                label: "Collected",
                value: formatUsd(collectedRevenue30Dollars, { maximumFractionDigits: 0 }),
                helper: "Collected in last 30 days",
                tones: "border-emerald-200/70 bg-emerald-50/55",
              },
              {
                label: "Outstanding",
                value: formatUsd(outstandingRevenueDollars, { maximumFractionDigits: 0 }),
                helper: "Still tied to open jobs",
                tones: "border-amber-300/70 bg-amber-50/70",
              },
              {
                label: "Avg Booking",
                value: formatUsd(avgBookingDollars, { maximumFractionDigits: 0 }),
                helper: "Average recent booking",
                tones: "border-indigo-200/70 bg-indigo-50/45",
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className={joinClasses(
                  "flex min-h-[132px] flex-col rounded-[22px] border px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
                  metric.tones,
                )}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{metric.label}</div>
                <div className="mt-2 text-[1.5rem] font-semibold tracking-tight text-slate-900">{metric.value}</div>
                <div className="mt-auto pt-3 text-xs leading-5 text-slate-500">{metric.helper}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 2xl:grid-cols-2">
        <SectionCard
          title="Booking Funnel"
          tooltip="Booking Funnel shows the top-line path from booking started, to review reached, to completed, plus the overall conversion rate from started to completed."
          actionHref="/admin/analytics/conversion"
          actionLabel="View Full Analytics"
        >
          <div className="divide-y divide-slate-200/80">
            <FunnelBarRow
              label="Booking Started"
              value={number(funnelStarted)}
              barWidth={funnelStarted > 0 ? 100 : 8}
              tone="strong"
            />
            <FunnelBarRow
              label="Reached Review"
              value={number(funnelReview)}
              barWidth={funnelStarted > 0 ? (funnelReview / funnelStarted) * 100 : 8}
              tone="medium"
            />
            <FunnelBarRow
              label="Completed"
              value={number(funnelCompleted)}
              barWidth={funnelStarted > 0 ? (funnelCompleted / funnelStarted) * 100 : 8}
              tone="soft"
            />
            <FunnelBarRow
              label="Conversion"
              value={funnelConversion.toFixed(1)}
              displayValue={`${funnelConversion.toFixed(1)}%`}
              barWidth={funnelConversion}
              tone="light"
            />
          </div>

          {ANALYTICS_DATA_MODE === "demo" ? (
            <div className="mt-2.5 inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400/90">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
              Preview data. Live tracking is not fully enabled yet.
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Top Zip Codes"
          actionHref="/admin/analytics/zip-heatmap"
          actionLabel="View ZIP Heatmap"
        >
          <div className="divide-y divide-slate-200/80">
            {topAreas.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-sm text-slate-500">
                No recent ZIP activity yet.
              </div>
            ) : (
              topAreas.map((area, index) => {
                const rankClasses =
                  index === 0
                    ? {
                        badge: "bg-emerald-100 text-emerald-700",
                        fill: "bg-emerald-300",
                        track: "bg-slate-100/65",
                        text: "text-slate-900",
                      }
                    : index === 1
                      ? {
                          badge: "bg-sky-100 text-sky-700",
                          fill: "bg-sky-300",
                          track: "bg-slate-100/65",
                          text: "text-slate-900",
                        }
                      : index === 2
                        ? {
                            badge: "bg-violet-100 text-violet-700",
                            fill: "bg-violet-200",
                            track: "bg-slate-100/65",
                            text: "text-slate-900",
                          }
                        : index === 3
                          ? {
                              badge: "bg-orange-100 text-orange-700",
                              fill: "bg-orange-200",
                              track: "bg-slate-100/65",
                              text: "text-slate-900",
                            }
                          : {
                            badge: "bg-amber-100 text-amber-700",
                            fill: "bg-amber-200",
                            track: "bg-slate-100/65",
                            text: "text-slate-900",
                          };

                return (
                  <div key={area.zip} className="py-[5px] first:pt-0 last:pb-0">
                    <div className={joinClasses("rounded-2xl p-px", rankClasses.track)}>
                      <div
                        className={joinClasses(
                          "flex min-h-9 items-center justify-between rounded-[15px] px-4 py-2 shadow-[inset_0_-1px_0_rgba(15,23,42,0.06),0_1px_1px_rgba(15,23,42,0.04)]",
                          rankClasses.fill,
                          rankClasses.text,
                        )}
                        style={{
                          width: `${topAreaMaxShare > 0 ? Math.max((area.share / topAreaMaxShare) * 100, 8) : 8}%`,
                          minWidth: "13rem",
                          maxWidth: "100%",
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={joinClasses(
                              "inline-flex min-w-[1.75rem] shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              rankClasses.badge,
                            )}
                          >
                            #{index + 1}
                          </span>
                          <div className="truncate text-sm font-medium">
                            ZIP {area.zip} • {number(area.bookings)} bookings • {formatUsd(area.revenue, { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                        <div className="ml-3 shrink-0 text-sm font-semibold">{area.share.toFixed(0)}%</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SectionCard>
      </section>

    </AdminPage>
  );
}
