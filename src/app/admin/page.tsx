import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  LifebuoyIcon,
  InformationCircleIcon,
  MapPinIcon,
  ShieldCheckIcon,
  QueueListIcon,
  TruckIcon,
  UserPlusIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { AdminPage, AdminPageHeader } from "./_components/admin/admin-page";
import { supabaseServer } from "@/lib/supabase/server";
import { centsToDollars, formatUsd, formatUsdFromCents } from "@/lib/money";
import { getPricingSettingsSnapshot } from "@/lib/pricing-settings";
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
  customer_name: string | null;
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

type CustomerRow = {
  id: string;
  created_at: string | null;
  portal_status: "invited" | "active" | "deactivated" | null;
};

type ServiceAreaRow = {
  active: boolean | null;
  price_14_yard_override: number | null;
};

const ACTIVE_BOOKING_STATUSES = new Set<BookingStatus>(["confirmed", "scheduled", "delivered"]);
const OPEN_REQUEST_STATUSES = new Set<RentalActionRequestRow["status"]>(["submitted", "under_review", "approved"]);
const BOOKING_SELECT =
  "id, booking_ref, customer_id, customer_name, customer_city, customer_zip, delivery_date, pickup_date, pickup_mode, status, total_price_cents, created_at";

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
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

function daysBetween(startIso: string, endIso: string) {
  const start = parseISODate(startIso);
  const end = parseISODate(endIso);
  if (!start || !end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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

function formatDateHeadline(value: string) {
  const parsed = parseISODate(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
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

function SnapshotCard({
  label,
  value,
  insight,
  tooltip,
  icon: Icon,
  toneKey = "slate",
  href,
  tone = "default",
}: {
  label: string;
  value: string | number;
  insight: string;
  tooltip: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  toneKey?: "blue" | "amber" | "slate" | "green";
  href?: string;
  tone?: "default" | "alert";
}) {
  const colorClasses =
    tone === "alert"
      ? {
          card: "border-rose-200/80 bg-rose-50/85 shadow-[0_10px_24px_rgba(244,63,94,0.08)]",
          iconChip: "border-rose-200/80 bg-white/80 text-rose-700",
          label: "text-rose-700",
          value: "text-rose-900",
          insight: "text-rose-700",
          info: "text-rose-500 hover:text-rose-700 focus-visible:text-rose-700",
        }
      : toneKey === "blue"
        ? {
            card: "border-sky-200/70 bg-sky-50/55 hover:border-sky-300/80 hover:shadow-[0_12px_28px_rgba(14,165,233,0.08)]",
            iconChip: "border-sky-200/70 bg-white/80 text-sky-700",
            label: "text-slate-700",
            value: "text-slate-900",
            insight: "text-slate-700",
            info: "text-sky-500 hover:text-sky-700 focus-visible:text-sky-700",
          }
        : toneKey === "amber"
          ? {
              card: "border-amber-200/70 bg-amber-50/50 hover:border-amber-300/80 hover:shadow-[0_12px_28px_rgba(245,158,11,0.08)]",
              iconChip: "border-amber-200/70 bg-white/80 text-amber-700",
              label: "text-slate-700",
              value: "text-slate-900",
              insight: "text-slate-700",
              info: "text-amber-500 hover:text-amber-700 focus-visible:text-amber-700",
            }
          : toneKey === "green"
            ? {
                card: "border-emerald-200/70 bg-emerald-50/50 hover:border-emerald-300/80 hover:shadow-[0_12px_28px_rgba(16,185,129,0.08)]",
                iconChip: "border-emerald-200/70 bg-white/80 text-emerald-700",
                label: "text-slate-700",
                value: "text-slate-900",
                insight: "text-slate-700",
                info: "text-emerald-500 hover:text-emerald-700 focus-visible:text-emerald-700",
              }
            : {
                card: "border-indigo-200/60 bg-indigo-50/40 hover:border-indigo-300/70 hover:shadow-[0_12px_28px_rgba(99,102,241,0.08)]",
                iconChip: "border-indigo-200/70 bg-white/80 text-indigo-700",
                label: "text-slate-700",
                value: "text-slate-900",
                insight: "text-slate-700",
                info: "text-indigo-500 hover:text-indigo-700 focus-visible:text-indigo-700",
              };

  const content = (
    <div
      className={joinClasses(
        "relative flex h-full min-h-[164px] flex-col overflow-visible rounded-[28px] border px-5 py-5 shadow-sm transition",
        colorClasses.card,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className={joinClasses("flex items-center gap-2 text-sm font-semibold", colorClasses.label)}>
            <span
              className={joinClasses(
                "flex h-9 w-9 items-center justify-center rounded-2xl border",
                colorClasses.iconChip,
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
            {label}
          </div>
          <div className={joinClasses("mt-3 text-4xl font-semibold tracking-tight", colorClasses.value)}>
            {value}
          </div>
          <div className={joinClasses("mt-auto pt-5 text-sm font-medium", colorClasses.insight)}>
            {insight}
          </div>
        </div>

        <div className="relative z-20 shrink-0 overflow-visible">
          <button
            type="button"
            aria-label={`${label} definition`}
            className={joinClasses(
              "group relative rounded-full p-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2",
              colorClasses.info,
            )}
          >
            <InformationCircleIcon className="h-5 w-5" aria-hidden="true" />
            <span
              role="tooltip"
              className="pointer-events-none absolute right-0 top-8 z-50 w-64 translate-y-1 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-left text-xs font-medium leading-5 text-slate-600 opacity-0 shadow-[0_16px_36px_rgba(15,23,42,0.14)] transition duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
            >
              {tooltip}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function QueueItem({
  label,
  count,
  icon: Icon,
  href,
  severity = "normal",
}: {
  label: string;
  count: number;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  href: string;
  severity?: "normal" | "warning" | "danger";
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-2xl px-2 py-3 transition-colors duration-150 first:pt-0 last:pb-0 hover:bg-orange-50/55 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/25 focus-visible:ring-offset-2"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#F97316]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="text-sm font-semibold text-slate-900">{label}</div>
      </div>
      <div
        className={joinClasses(
          "shrink-0 text-lg font-semibold tracking-tight text-[#F97316]",
          count === 0 && "text-slate-400",
          severity === "danger" && count > 0 && "text-[#F97316]",
          severity === "warning" && count > 0 && "text-[#F97316]",
        )}
      >
        {number(count)}
      </div>
    </Link>
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

function DashboardListRow({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: "neutral" | "good" | "warning" | "danger" | "info";
}) {
  const iconTone =
    tone === "good"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "bg-amber-50 text-amber-800"
        : tone === "danger"
          ? "bg-rose-50 text-rose-800"
          : tone === "info"
            ? "bg-sky-50 text-sky-800"
            : "bg-slate-100 text-slate-700";

  const valueTone =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : tone === "danger"
          ? "bg-rose-50 text-rose-700 ring-rose-200"
          : tone === "info"
            ? "bg-sky-50 text-sky-700 ring-sky-200"
            : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <div className="flex min-h-14 items-center justify-between gap-4 rounded-2xl px-2 py-3 first:pt-0 last:pb-0 transition-colors duration-150 hover:bg-slate-50/60">
      <div className="flex min-w-0 items-center gap-3">
        <span className={joinClasses("flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl", iconTone)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="text-sm font-medium text-slate-700">{label}</div>
      </div>
      <span
        className={joinClasses(
          "inline-flex shrink-0 items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset",
          valueTone,
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const supabase = supabaseServer();
  const todayStr = todayISOET();
  const yesterdayStr = toDateOnlyISO(addDays(parseISODate(todayStr) ?? new Date(), -1).toISOString());
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
    customersResult,
    bookingCustomerIdsResult,
    serviceAreaResult,
    pricingSettings,
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .in("status", Array.from(ACTIVE_BOOKING_STATUSES))
      .order("delivery_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .neq("status", "cancelled")
      .gte("created_at", last30StartIso)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("total_price_cents")
      .in("status", ["delivered", "picked_up"])
      .gte("delivery_date", toDateOnlyISO(last30StartIso))
      .lte("delivery_date", todayStr),
    supabase
      .from("rental_action_requests")
      .select("id, action_type, status, priority, submitted_at")
      .order("submitted_at", { ascending: false }),
    supabase
      .from("customers")
      .select("id, created_at, portal_status"),
    supabase
      .from("bookings")
      .select("customer_id")
      .neq("status", "cancelled")
      .not("customer_id", "is", null),
    supabase
      .from("service_area_zips")
      .select("active, price_14_yard_override"),
    getPricingSettingsSnapshot(),
  ]);

  if (activeBookingsResult.error) throw new Error(activeBookingsResult.error.message);
  if (recentBookingsResult.error) throw new Error(recentBookingsResult.error.message);
  if (last30BookingsResult.error) throw new Error(last30BookingsResult.error.message);
  if (collectedLast30Result.error) throw new Error(collectedLast30Result.error.message);
  if (portalRequestsResult.error) throw new Error(portalRequestsResult.error.message);
  if (customersResult.error) throw new Error(customersResult.error.message);
  if (bookingCustomerIdsResult.error) throw new Error(bookingCustomerIdsResult.error.message);
  if (serviceAreaResult.error) throw new Error(serviceAreaResult.error.message);

  const activeBookings = (activeBookingsResult.data ?? []) as DashboardBookingRow[];
  const recentBookings = (recentBookingsResult.data ?? []) as DashboardBookingRow[];
  const last30Bookings = (last30BookingsResult.data ?? []) as DashboardBookingRow[];
  const collectedLast30Rows = (collectedLast30Result.data ?? []) as Array<{ total_price_cents: number | null }>;
  const portalRequests = (portalRequestsResult.data ?? []) as RentalActionRequestRow[];
  const customers = (customersResult.data ?? []) as CustomerRow[];
  const bookingCustomerIds = (bookingCustomerIdsResult.data ?? []) as Array<{ customer_id: string | null }>;
  const serviceAreaRows = (serviceAreaResult.data ?? []) as ServiceAreaRow[];

  const deliveriesToday = activeBookings.filter(
    (booking) =>
      (booking.status === "confirmed" || booking.status === "scheduled") && booking.delivery_date === todayStr,
  );
  const deliveriesYesterday = activeBookings.filter(
    (booking) =>
      (booking.status === "confirmed" || booking.status === "scheduled") && booking.delivery_date === yesterdayStr,
  );
  const pickupsToday = activeBookings.filter(
    (booking) => booking.status === "delivered" && booking.pickup_date === todayStr,
  );
  const pickupsYesterday = activeBookings.filter(
    (booking) => booking.status === "delivered" && booking.pickup_date === yesterdayStr,
  );
  const overduePickups = activeBookings.filter(
    (booking) => booking.status === "delivered" && Boolean(booking.pickup_date) && (booking.pickup_date as string) < todayStr,
  );
  const openJobs = activeBookings.length;
  const stopsScheduled = deliveriesToday.length + pickupsToday.length;
  const stopsYesterday = deliveriesYesterday.length + pickupsYesterday.length;
  const pickupRequestsAwaitingReview = portalRequests.filter(
    (request) => request.status === "submitted" || request.status === "under_review",
  );
  const requestsSitting24h = portalRequests.filter(
    (request) => OPEN_REQUEST_STATUSES.has(request.status) && now.getTime() - new Date(request.submitted_at).getTime() >= 24 * 60 * 60 * 1000,
  );
  const pickupsNotYetScheduled = activeBookings.filter(
    (booking) => booking.status === "delivered" && booking.pickup_mode === "request" && !booking.pickup_date,
  );
  const bookingsMissingRequiredInfo = activeBookings.filter(
    (booking) => !booking.customer_name?.trim() || !booking.customer_zip?.trim() || !booking.delivery_date,
  );
  const longOnSiteRentals = activeBookings.filter(
    (booking) =>
      booking.status === "delivered" &&
      Boolean(booking.delivery_date) &&
      daysBetween(booking.delivery_date as string, todayStr) >= 8,
  );

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

  const bookingCountsByCustomer = new Map<string, number>();
  for (const row of bookingCustomerIds) {
    const customerId = row.customer_id?.trim();
    if (!customerId) continue;
    bookingCountsByCustomer.set(customerId, (bookingCountsByCustomer.get(customerId) ?? 0) + 1);
  }

  const newCustomers = customers.filter((customer) => {
    if (!customer.created_at) return false;
    return new Date(customer.created_at).getTime() >= new Date(last30StartIso).getTime();
  }).length;
  const recentCustomerIds = new Set(last30Bookings.map((booking) => booking.customer_id).filter(Boolean) as string[]);
  const returningCustomers = Array.from(recentCustomerIds).filter(
    (customerId) => (bookingCountsByCustomer.get(customerId) ?? 0) > 1,
  ).length;
  const repeatRate = recentCustomerIds.size > 0 ? (returningCustomers / recentCustomerIds.size) * 100 : 0;

  const activeServiceZips = serviceAreaRows.filter((row) => row.active).length;

  const snapshotCards = [
    {
      label: "Deliveries Today",
      value: deliveriesToday.length,
      insight:
        deliveriesToday.length === deliveriesYesterday.length
          ? "Same as yesterday"
          : `${deliveriesToday.length > deliveriesYesterday.length ? "Up" : "Down"} ${Math.abs(deliveriesToday.length - deliveriesYesterday.length)} from yesterday`,
      tooltip: "Deliveries Today counts confirmed or scheduled drop-offs with a delivery date of today.",
      icon: TruckIcon,
      toneKey: "blue" as const,
      href: `/admin/bookings?datePreset=today&dateField=delivery_date`,
    },
    {
      label: "Pickups Today",
      value: pickupsToday.length,
      insight: `${activeBookings.filter((booking) => booking.status === "delivered").length} still awaiting pickup`,
      tooltip:
        "Pickups Today counts delivered rentals with a pickup date of today. Awaiting pickup means the dumpster is still on site and not yet marked picked up.",
      icon: CalendarDaysIcon,
      toneKey: "amber" as const,
      href: `/admin/bookings?datePreset=today&dateField=pickup_date`,
    },
    {
      label: "Open Jobs",
      value: openJobs,
      insight: `${activeBookings.filter((booking) => booking.status === "delivered").length} currently on site`,
      tooltip: "Open Jobs includes confirmed deliveries, scheduled jobs, and delivered rentals that are still active.",
      icon: ClockIcon,
      toneKey: "slate" as const,
      href: "/admin/bookings?bucket=active",
    },
    {
      label: "Overdue Pickups",
      value: overduePickups.length,
      insight: overduePickups.length > 0 ? "Action needed" : "No overdue pickups",
      tooltip: "A pickup becomes overdue when a delivered rental has a scheduled pickup date that has already passed.",
      icon: ExclamationTriangleIcon,
      href: "/admin/bookings?quickView=overdue_pickups",
      tone: "alert" as const,
    },
    {
      label: "Stops Scheduled",
      value: stopsScheduled,
      insight:
        stopsScheduled === stopsYesterday
          ? "Same as yesterday"
          : `${stopsScheduled > stopsYesterday ? "Up" : "Down"} ${Math.abs(stopsScheduled - stopsYesterday)} from yesterday`,
      tooltip: "Stops Scheduled is the combined total of today’s delivery stops and pickup stops.",
      icon: MapPinIcon,
      toneKey: "green" as const,
      href: "/admin/schedule",
    },
  ];

  return (
    <AdminPage className="space-y-8">
      <AdminPageHeader
        title="Dashboard"
        description={`${formatDateHeadline(todayStr)} · Here’s your current operations overview`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/schedule"
              className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open Schedule
            </Link>
            <Link
              href="/admin/bookings"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              View Bookings
            </Link>
          </div>
        }
      />

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold uppercase tracking-[0.16em] text-slate-700">Today&apos;s Snapshot</h2>
          </div>
        </div>

        <div className="grid auto-rows-fr gap-4 overflow-visible md:grid-cols-2 xl:grid-cols-5">
          {snapshotCards.map((card) => (
            <SnapshotCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Needs Attention"
          tooltip="This list highlights the active issues the office or dispatcher can act on right now."
        >
          <div className="divide-y divide-slate-200/80">
            <QueueItem
              label="Portal Requests Awaiting Review"
              count={pickupRequestsAwaitingReview.length}
              icon={QueueListIcon}
              href="/admin/portal-requests"
              severity={pickupRequestsAwaitingReview.length > 0 ? "warning" : "normal"}
            />
            <QueueItem
              label="Overdue Pickups"
              count={overduePickups.length}
              icon={ExclamationTriangleIcon}
              href="/admin/bookings?quickView=overdue_pickups"
              severity={overduePickups.length > 0 ? "danger" : "normal"}
            />
            <QueueItem
              label="Pickups Not Yet Scheduled"
              count={pickupsNotYetScheduled.length}
              icon={CalendarDaysIcon}
              href="/admin/bookings?quickView=active"
              severity={pickupsNotYetScheduled.length > 0 ? "warning" : "normal"}
            />
            <QueueItem
              label="Requests Sitting 24h+"
              count={requestsSitting24h.length}
              icon={ClockIcon}
              href="/admin/portal-requests?filter=under_review"
              severity={requestsSitting24h.length > 0 ? "danger" : "normal"}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Upcoming Schedule"
          actionHref="/admin/schedule"
          actionLabel="Open Schedule"
        >
          <div className="overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1.2fr)_88px_88px_72px] gap-3 px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              <div>Day</div>
              <div className="text-right">Deliveries</div>
              <div className="text-right">Pickups</div>
              <div className="text-right">Active</div>
            </div>

            <div className="divide-y divide-slate-200/80">
              {scheduleRows.map((row) => (
                <Link
                  key={row.dayIso}
                  href={row.href}
                  className={joinClasses(
                    "grid grid-cols-[minmax(0,1.2fr)_88px_88px_72px] items-center gap-3 px-2 py-3 transition-colors duration-150 hover:bg-orange-50/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/25 focus-visible:ring-offset-2",
                    row.dayIso === todayStr && "bg-orange-50/35",
                  )}
                >
                  <div className={joinClasses("text-sm font-semibold", row.dayIso === todayStr ? "text-slate-950" : "text-slate-900")}>
                    {row.label}
                  </div>
                  <div className="text-right text-sm font-semibold text-sky-700">{number(row.deliveries)}</div>
                  <div className="text-right text-sm font-semibold text-amber-700">{number(row.pickups)}</div>
                  <div className="text-right text-sm font-semibold text-indigo-700">{number(row.active)}</div>
                </Link>
              ))}
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Recent Bookings"
          tooltip="Recent Bookings shows the latest booking activity so the office can quickly scan new work without opening the full bookings page."
          actionHref="/admin/bookings"
          actionLabel="View All Bookings"
        >
          <div className="divide-y divide-slate-200/80">
            {recentBookings.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-sm text-slate-500">
                No bookings have been created yet.
              </div>
            ) : (
              recentBookings.slice(0, 5).map((booking) => (
                <Link
                  key={booking.id}
                  href={`/admin/bookings/${booking.id}`}
                  className="flex items-start justify-between gap-4 px-2 py-2.5 transition-colors duration-150 first:pt-0 last:pb-0 hover:bg-orange-50/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/25 focus-visible:ring-offset-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-6">
                      <div className="min-w-0 flex-1">
                        <div className="min-w-0 text-base font-semibold tracking-tight text-slate-900">
                          {booking.customer_name ?? "Unnamed customer"}
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
                          {booking.delivery_date ? `Delivery ${formatDateLabel(booking.delivery_date)}` : "Delivery date not set"}
                        </div>
                        <div className="mt-1.5 truncate text-xs text-slate-500">
                          {booking.booking_ref ?? `Booking ${booking.id.slice(0, 8)}`}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-semibold tracking-tight text-slate-900">
                          {formatUsdFromCents(booking.total_price_cents, { maximumFractionDigits: 0 })}
                        </div>
                        <div className="mt-1.5 text-xs text-slate-500">{formatRelativeTime(booking.created_at)}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
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

      <section className="grid gap-6 xl:grid-cols-2">
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

      <section className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="Customer Activity"
          tooltip="Customer Activity shows the mix of new and returning customers in the last 30 days. New Customers are newly created customer records, Returning are recent customers with more than one booking, and Repeat Rate is the returning share of recent booking customers."
          className="h-full"
        >
          <div className="divide-y divide-slate-200/80">
            {[
              { label: "New Customers", value: number(newCustomers), icon: UserPlusIcon, tone: "info" as const },
              { label: "Returning", value: number(returningCustomers), icon: UsersIcon, tone: "neutral" as const },
              { label: "Repeat Rate", value: `${repeatRate.toFixed(0)}%`, icon: ArrowPathIcon, tone: "info" as const },
            ].map((metric) => (
              <DashboardListRow key={metric.label} label={metric.label} value={metric.value} icon={metric.icon} tone={metric.tone} />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Exceptions & Risks"
          tooltip="Exceptions & Risks shows broader business issues that may need follow-up. Past-Due Rentals are overdue pickups, Long On-Site Rentals are rentals still on site for 8 or more days, Open Requests 24h+ are customer requests aging more than a day, and Missing Job Info are active bookings missing core job details."
          className="h-full"
        >
          <div className="divide-y divide-slate-200/80">
            <DashboardListRow
              label="Past-Due Rentals"
              value={number(overduePickups.length)}
              icon={ExclamationTriangleIcon}
              tone={overduePickups.length > 0 ? "danger" : "neutral"}
            />
            <DashboardListRow
              label="Long On-Site Rentals"
              value={number(longOnSiteRentals.length)}
              icon={ClockIcon}
              tone={longOnSiteRentals.length > 0 ? "warning" : "neutral"}
            />
            <DashboardListRow
              label="Open Requests 24h+"
              value={number(requestsSitting24h.length)}
              icon={LifebuoyIcon}
              tone={requestsSitting24h.length > 0 ? "warning" : "neutral"}
            />
            <DashboardListRow
              label="Missing Job Info"
              value={number(bookingsMissingRequiredInfo.length)}
              icon={QueueListIcon}
              tone={bookingsMissingRequiredInfo.length > 0 ? "warning" : "neutral"}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="System Health"
          tooltip="System Health monitors the status of key admin systems. Payment Flow shows whether checkout is simulated or live, Analytics Tracking shows the dashboard analytics mode, Service Area shows how many active ZIPs are configured, and Pricing Defaults shows the current default rental and overage pricing."
          className="h-full"
        >
          <div className="divide-y divide-slate-200/80">
            <DashboardListRow
              label="Payment Flow"
              value="Simulated"
              icon={WrenchScrewdriverIcon}
              tone="warning"
            />
            <DashboardListRow
              label="Analytics Tracking"
              value={ANALYTICS_DATA_MODE === "demo" ? "Preview Mode" : "Live"}
              icon={QueueListIcon}
              tone={ANALYTICS_DATA_MODE === "demo" ? "warning" : "good"}
            />
            <DashboardListRow
              label="Service Area"
              value={`${number(activeServiceZips)} Active ZIPs`}
              icon={MapPinIcon}
              tone="good"
            />
            <DashboardListRow
              label="Pricing Defaults"
              value={formatUsd(pricingSettings.standardRentalPrice, { maximumFractionDigits: 0 })}
              icon={ShieldCheckIcon}
              tone="good"
            />
          </div>
        </SectionCard>
      </section>
    </AdminPage>
  );
}
