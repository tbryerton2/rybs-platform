export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  InboxStackIcon,
  MapPinIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { getScheduleJobs, FLEET_SIZE } from "@/lib/admin/schedule";
import {
  getPlacementCompactSignals,
  getPlacementDispatchSummary,
  sanitizePlacementDetails,
} from "@/lib/placement";
import {
  buildPickupPlanningModel,
  getAvailabilityRiskClasses,
} from "@/lib/pickup-planning";
import ScheduleBoard from "../_components/admin/schedule/schedule-board";

type SearchParams = Record<string, string | string[] | undefined>;

type BookingRow = {
  id: string;
  booking_ref: string | null;
  customer_name: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string | null;
  pickup_date: string | null;
  pickup_mode: "request" | "schedule" | null;
  status: "confirmed" | "scheduled" | "delivered" | "picked_up" | "cancelled";
  created_at: string | null;
  placement_preference: string | null;
  placement_details: string | null;
  access_issues: string[] | null;
  gate_instructions: string | null;
  delivery_presence: string | null;
  alternate_contact_name: string | null;
  alternate_contact_phone: string | null;
  placement_photo_url: string | null;
  special_delivery_instructions: string | null;
};

function sp(obj: SearchParams, key: string) {
  const value = obj[key];
  return Array.isArray(value) ? value[0] : value;
}

function todayETDate(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return new Date(Date.UTC(year, month - 1, day, 12));
}

function dateFromISO(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function getWeekStartMonday(searchWeek?: string) {
  const base = searchWeek ? dateFromISO(searchWeek) : todayETDate();
  const day = base.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  return addDays(base, -diffToMonday);
}

function formatWeekRange(start: Date, end: Date) {
  const startText = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(start);

  const endText = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(end);

  const year = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    timeZone: "UTC",
  }).format(end);

  return `${startText} – ${endText}, ${year}`;
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatShortDate(iso?: string | null) {
  if (!iso) return "No date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateFromISO(iso));
}

function formatAddress(job: BookingRow) {
  const parts = [job.customer_street, job.customer_city, job.customer_zip]
    .map((value) => value?.trim())
    .filter(Boolean);

  return parts.length ? parts.join(", ") : "Address pending";
}

function placementSignalClasses(tone: "amber" | "blue" | "emerald" | "slate") {
  switch (tone) {
    case "amber":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "blue":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "emerald":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function getPlacementViewModel(job: BookingRow) {
  const placement = sanitizePlacementDetails({
    placementPreference: job.placement_preference,
    placementDetails: job.placement_details,
    accessIssues: job.access_issues ?? [],
    gateInstructions: job.gate_instructions,
    deliveryPresence: job.delivery_presence,
    alternateContactName: job.alternate_contact_name,
    alternateContactPhone: job.alternate_contact_phone,
    placementPhotoUrl: job.placement_photo_url,
    specialDeliveryInstructions: job.special_delivery_instructions,
  });

  return {
    summary: getPlacementDispatchSummary(placement),
    signals: getPlacementCompactSignals(placement, 3),
  };
}

function getPickupViewModel(job: BookingRow, futureDeliveryDates: string[]) {
  return buildPickupPlanningModel({
    deliveryDate: job.delivery_date,
    pickupDate: job.pickup_date,
    pickupMode: job.pickup_mode,
    futureDeliveryDates,
  });
}

function sameISO(a?: string | null, b?: string | null) {
  return Boolean(a && b && a === b);
}

function isOnSiteStartOfDay(job: BookingRow, dayISO: string) {
  if (!job.delivery_date) return false;
  if (job.status === "cancelled" || job.status === "picked_up") return false;
  return job.delivery_date < dayISO && (!job.pickup_date || job.pickup_date >= dayISO);
}

function isOnSiteEndOfDay(job: BookingRow, dayISO: string) {
  if (!job.delivery_date) return false;
  if (job.status === "cancelled" || job.status === "picked_up") return false;
  return job.delivery_date <= dayISO && (!job.pickup_date || job.pickup_date > dayISO);
}

function isDeliveryForDay(job: BookingRow, dayISO: string) {
  return sameISO(job.delivery_date, dayISO) && ["confirmed", "scheduled"].includes(job.status);
}

function isPickupForDay(job: BookingRow, dayISO: string) {
  return sameISO(job.pickup_date, dayISO) && job.status === "delivered";
}

function isPickupRequest(job: BookingRow) {
  return job.status === "delivered" && job.pickup_mode === "request" && !job.pickup_date;
}

function daysOnSite(deliveryDate?: string | null) {
  if (!deliveryDate) return 0;

  const diff = Math.floor((todayETDate().getTime() - dateFromISO(deliveryDate).getTime()) / 86400000);
  return Math.max(diff, 0);
}

function bookingReference(job: BookingRow) {
  return job.booking_ref ?? `Job ${job.id.slice(0, 8).toUpperCase()}`;
}

function getAttentionLabel(job: BookingRow) {
  const todayISO = toISODate(todayETDate());

  if (job.status === "delivered" && job.pickup_date && job.pickup_date < todayISO) {
    return {
      label: "Overdue pickup",
      classes: "bg-rose-50 text-rose-700 ring-rose-200",
    };
  }

  if (job.status === "delivered" && job.pickup_mode === "request" && !job.pickup_date) {
    return {
      label: "Pickup requested",
      classes: "bg-amber-50 text-amber-700 ring-amber-200",
    };
  }

  if (daysOnSite(job.delivery_date) >= 8) {
    return {
      label: "Long on-site",
      classes: "bg-slate-100 text-slate-700 ring-slate-200",
    };
  }

  return null;
}

function attentionPriority(job: BookingRow) {
  const tag = getAttentionLabel(job)?.label;
  if (tag === "Overdue pickup") return 0;
  if (tag === "Pickup requested") return 1;
  if (tag === "Long on-site") return 2;
  return 3;
}

type StatTone = "orange" | "blue" | "emerald" | "slate" | "rose";

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: number;
  detail: string;
  tone: StatTone;
}) {
  const toneClasses: Record<StatTone, string> = {
    orange: "bg-[#F97316]/10 text-[#C2410C] ring-[#F97316]/15",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-950/5">
      <div className="flex items-start justify-between gap-4">
        <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 text-right">
          <div className="text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
          <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
        </div>
      </div>

      <div className="mt-3 text-sm leading-5 text-slate-600">{detail}</div>
    </div>
  );
}

function QueuePanel({
  title,
  subtitle,
  countLabel,
  tone,
  children,
}: {
  title: string;
  subtitle: string;
  countLabel: string;
  tone: "amber" | "slate" | "rose";
  children: React.ReactNode;
}) {
  const toneClasses = {
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
  };

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/5">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-900">{title}</div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p>
        </div>
        <span
          className={`inline-flex min-w-[84px] items-center justify-center rounded-full px-2.5 py-1 text-center text-xs font-semibold leading-none ring-1 ${toneClasses[tone]}`}
        >
          {countLabel}
        </span>
      </div>

      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function EmptyQueueState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      <div className="mt-1 text-sm leading-6 text-slate-500">{detail}</div>
    </div>
  );
}

function PickupRequestPanel({
  requests,
  futureDeliveryDates,
}: {
  requests: BookingRow[];
  futureDeliveryDates: string[];
}) {
  return (
    <QueuePanel
      title="Unscheduled pickup requests"
      subtitle="Requests that still need a pickup date placed on the board."
      countLabel={`${requests.length} open`}
      tone="amber"
    >
      {requests.length ? (
        requests.map((job) => {
          const placementView = getPlacementViewModel(job);
          const pickupView = getPickupViewModel(
            job,
            futureDeliveryDates.filter((date) => date !== job.delivery_date),
          );

          return (
            <div key={job.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {bookingReference(job)}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {job.customer_name || "Unnamed customer"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{formatAddress(job)}</div>
                </div>

                <div className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                  {daysOnSite(job.delivery_date)} day{daysOnSite(job.delivery_date) === 1 ? "" : "s"} on-site
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Delivery completed
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {formatShortDate(job.delivery_date)}
                  </div>
                </div>

                <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {pickupView.pickupStatusLabel}
                    </span>
                    {pickupView.risk !== "none" ? (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getAvailabilityRiskClasses(
                          pickupView.risk,
                        )}`}
                      >
                        {pickupView.riskLabel}
                      </span>
                    ) : null}
                  </div>
                  {pickupView.expectedAvailableDate ? (
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      Expected available again {formatShortDate(pickupView.expectedAvailableDate)}.
                    </div>
                  ) : null}
                </div>
              </div>

              {placementView.summary !== "No placement details collected" ? (
                <div className="mt-3 rounded-xl bg-white px-3 py-3 ring-1 ring-slate-200">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Placement notes
                  </div>
                  <div className="mt-1 text-sm leading-6 text-slate-700">{placementView.summary}</div>
                  {placementView.signals.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {placementView.signals.map((signal) => (
                        <span
                          key={signal.key}
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${placementSignalClasses(signal.tone)}`}
                        >
                          {signal.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/admin/bookings/${encodeURIComponent(job.id)}`}
                  className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  View booking
                </Link>

                <form action="/api/admin/schedule-pickup" method="POST">
                  <input type="hidden" name="id" value={job.id} />
                  <input type="hidden" name="pickup_date" value={toISODate(addDays(todayETDate(), 1))} />
                  <input type="hidden" name="redirectTo" value="/admin/schedule" />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center rounded-xl bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Schedule tomorrow
                  </button>
                </form>

                <form action="/api/admin/schedule-pickup" method="POST">
                  <input type="hidden" name="id" value={job.id} />
                  <input type="hidden" name="pickup_date" value={toISODate(addDays(todayETDate(), 2))} />
                  <input type="hidden" name="redirectTo" value="/admin/schedule" />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center rounded-xl bg-white px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  >
                    In 2 days
                  </button>
                </form>

                <form action="/api/admin/schedule-pickup" method="POST">
                  <input type="hidden" name="id" value={job.id} />
                  <input type="hidden" name="pickup_date" value={toISODate(addDays(todayETDate(), 3))} />
                  <input type="hidden" name="redirectTo" value="/admin/schedule" />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center rounded-xl bg-white px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  >
                    In 3 days
                  </button>
                </form>
              </div>
            </div>
          );
        })
      ) : (
        <EmptyQueueState
          title="No open pickup requests"
          detail="Everything requested for pickup already has a date or has been cleared."
        />
      )}
    </QueuePanel>
  );
}

function AttentionDumpstersPanel({
  dumpsters,
  futureDeliveryDates,
}: {
  dumpsters: BookingRow[];
  futureDeliveryDates: string[];
}) {
  return (
    <QueuePanel
      title="Dumpsters needing attention"
      subtitle="Prioritized deployed units that are overdue, aging, or waiting for pickup scheduling."
      countLabel={`${dumpsters.length} active`}
      tone="slate"
    >
      {dumpsters.length ? (
        dumpsters.map((job) => {
          const pickupView = getPickupViewModel(
            job,
            futureDeliveryDates.filter((date) => date !== job.delivery_date),
          );
          const attention = getAttentionLabel(job);

          return (
            <div key={job.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {bookingReference(job)}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {job.customer_name || "Unnamed customer"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{formatAddress(job)}</div>
                </div>

                {attention ? (
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${attention.classes}`}
                  >
                    {attention.label}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Delivered
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {formatShortDate(job.delivery_date)}
                  </div>
                </div>

                <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Pickup status
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {pickupView.pickupStatusLabel}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
                <div className="text-sm text-slate-600">Days on-site</div>
                <div className="text-sm font-semibold text-slate-900">
                  {daysOnSite(job.delivery_date)}
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <EmptyQueueState
          title="No active exceptions"
          detail="There are no deployed dumpsters that currently stand out as aging or unresolved."
        />
      )}
    </QueuePanel>
  );
}

function OverduePickupsPanel({
  jobs,
}: {
  jobs: BookingRow[];
}) {
  return (
    <QueuePanel
      title="Overdue pickups"
      subtitle="Pickups that already have a date assigned but are still on-site past that date."
      countLabel={`${jobs.length} overdue`}
      tone="rose"
    >
      {jobs.length ? (
        jobs.map((job) => (
          <div key={job.id} className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-700">
                  {bookingReference(job)}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {job.customer_name || "Unnamed customer"}
                </div>
                <div className="mt-1 text-sm text-slate-600">{formatAddress(job)}</div>
              </div>

              <div className="text-right">
                <div className="text-xs font-medium text-rose-700">Pickup date</div>
                <div className="mt-1 text-sm font-semibold text-rose-800">
                  {formatShortDate(job.pickup_date)}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-rose-200">
              <div className="text-sm text-slate-600">Days on-site</div>
              <div className="text-sm font-semibold text-slate-900">
                {daysOnSite(job.delivery_date)}
              </div>
            </div>
          </div>
        ))
      ) : (
        <EmptyQueueState
          title="No overdue pickups"
          detail="All dated pickups are still on schedule."
        />
      )}
    </QueuePanel>
  );
}

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const requestedWeek = sp(params, "week");

  const weekStart = getWeekStartMonday(requestedWeek);
  const weekEnd = addDays(weekStart, 6);
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  const weekStartISO = toISODate(weekStart);
  const weekEndISO = toISODate(weekEnd);
  const todayISO = toISODate(todayETDate());

  const jobs = (await getScheduleJobs(weekStartISO, weekEndISO)) as BookingRow[];

  const baseDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const iso = toISODate(date);
    const deliveries = jobs.filter((job) => isDeliveryForDay(job, iso));
    const pickups = jobs.filter((job) => isPickupForDay(job, iso));
    const startOnSite = jobs.filter((job) => isOnSiteStartOfDay(job, iso)).length;
    const endOnSite = jobs.filter((job) => isOnSiteEndOfDay(job, iso)).length;
    const remaining = Math.max(0, FLEET_SIZE - endOnSite);
    const totalStops = deliveries.length + pickups.length;

    return {
      iso,
      date,
      deliveries,
      pickups,
      startOnSite,
      endOnSite,
      remaining,
      hasCapacityIssue: endOnSite > FLEET_SIZE,
      totalStops,
    };
  });

  const busiestStops = Math.max(...baseDays.map((day) => day.totalStops), 0);
  const lightestNonZeroStops = Math.min(
    ...baseDays.filter((day) => day.totalStops > 0).map((day) => day.totalStops),
    Number.POSITIVE_INFINITY,
  );

  const days = baseDays.map((day) => ({
    ...day,
    dateLabel: formatDayLabel(day.date),
    isToday: day.iso === todayISO,
    workloadLabel:
      day.totalStops === 0
        ? "Open capacity"
        : day.totalStops === busiestStops && busiestStops > 0
          ? "Heaviest"
          : day.totalStops === lightestNonZeroStops && lightestNonZeroStops < busiestStops
            ? "Lightest"
            : null,
  }));

  const pickupRequests = jobs
    .filter(isPickupRequest)
    .sort((a, b) => (a.delivery_date ?? "").localeCompare(b.delivery_date ?? ""));

  const activeDumpsters = jobs
    .filter((job) => {
      if (!job.delivery_date) return false;
      if (job.status === "cancelled" || job.status === "picked_up") return false;
      return job.status === "delivered" || job.status === "scheduled";
    })
    .sort((a, b) => (a.delivery_date ?? "").localeCompare(b.delivery_date ?? ""));

  const overduePickupJobs = jobs
    .filter((job) => job.status === "delivered" && Boolean(job.pickup_date) && (job.pickup_date as string) < todayISO)
    .sort((a, b) => (a.pickup_date ?? "").localeCompare(b.pickup_date ?? ""));

  const attentionDumpsters = activeDumpsters
    .filter((job) => getAttentionLabel(job))
    .sort((a, b) => {
      const priority = attentionPriority(a) - attentionPriority(b);
      if (priority !== 0) return priority;
      return (a.delivery_date ?? "").localeCompare(b.delivery_date ?? "");
    });

  const dumpstersOnSiteToday = jobs.filter((job) => {
    if (!job.delivery_date) return false;
    if (job.status === "cancelled" || job.status === "picked_up") return false;
    return job.delivery_date <= todayISO && (!job.pickup_date || job.pickup_date > todayISO);
  }).length;

  const futureDeliveryDates = jobs
    .filter((job) => ["confirmed", "scheduled"].includes(job.status) && Boolean(job.delivery_date))
    .map((job) => job.delivery_date as string);

  const totalDeliveries = days.reduce((sum, day) => sum + day.deliveries.length, 0);
  const totalPickups = days.reduce((sum, day) => sum + day.pickups.length, 0);

  return (
    <AdminPage width="wide" className="max-w-[1500px]">
      <AdminPageHeader
        title="Schedule"
        description={`Fleet planning is projected against ${FLEET_SIZE} dumpster${FLEET_SIZE === 1 ? "" : "s"}.`}
        className="mb-6"
        actions={
          <div className="flex flex-col items-start gap-4 sm:items-end">
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Link
                href={`/admin/schedule?week=${toISODate(prevWeek)}`}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Previous week
              </Link>

              <Link
                href={`/admin/schedule?week=${toISODate(getWeekStartMonday())}`}
                className="inline-flex h-10 items-center rounded-xl bg-[#F97316] px-4 text-sm font-semibold text-white transition hover:opacity-90"
              >
                This week
              </Link>

              <Link
                href={`/admin/schedule?week=${toISODate(nextWeek)}`}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Next week
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>

            <div className="pt-1 text-sm font-semibold text-slate-700 sm:text-right">
              {formatWeekRange(weekStart, weekEnd)}
            </div>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          icon={TruckIcon}
          label="Week deliveries"
          value={totalDeliveries}
          detail="Outbound drops already placed on the weekly board."
          tone="orange"
        />
        <SummaryCard
          icon={CalendarDaysIcon}
          label="Week pickups"
          value={totalPickups}
          detail="Return trips that already have a confirmed day."
          tone="blue"
        />
        <SummaryCard
          icon={InboxStackIcon}
          label="Open pickup requests"
          value={pickupRequests.length}
          detail="Still waiting for dispatch to assign a pickup date."
          tone="emerald"
        />
        <SummaryCard
          icon={MapPinIcon}
          label="Dumpsters on-site"
          value={dumpstersOnSiteToday}
          detail="Units currently deployed in the field today."
          tone="slate"
        />
        <SummaryCard
          icon={ExclamationTriangleIcon}
          label="Overdue pickups"
          value={overduePickupJobs.length}
          detail="Past-due returns that need immediate cleanup."
          tone="rose"
        />
      </div>

      <div className="mt-6">
        <ScheduleBoard days={days} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <PickupRequestPanel requests={pickupRequests} futureDeliveryDates={futureDeliveryDates} />
        <AttentionDumpstersPanel
          dumpsters={attentionDumpsters}
          futureDeliveryDates={futureDeliveryDates}
        />
        <OverduePickupsPanel jobs={overduePickupJobs} />
      </div>
    </AdminPage>
  );
}
