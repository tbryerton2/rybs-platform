// src/app/admin/schedule/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
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
  customer_name: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string | null; // YYYY-MM-DD
  pickup_date: string | null;   // YYYY-MM-DD
  pickup_mode: "request" | "scheduled" | null;
  status: "confirmed" | "scheduled" | "delivered" | "picked_up" | "cancelled";
  created_at: string | null;
  job_type: "delivery" | "pickup" | "swap" | null;
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
  const v = obj[key];
  return Array.isArray(v) ? v[0] : v;
}

function todayETDate(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  return new Date(Date.UTC(year, month - 1, day, 12));
}

function dateFromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
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
  const day = base.getUTCDay(); // Sun=0 ... Sat=6
  const diffToMonday = (day + 6) % 7; // Mon=0
  return addDays(base, -diffToMonday);
}

function formatWeekRange(start: Date, end: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  const startText = fmt.format(start);
  const endText = fmt.format(end);

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
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateFromISO(iso));
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
  return !!a && !!b && a === b;
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

    const jobs = (await getScheduleJobs(weekStartISO, weekEndISO)) as BookingRow[];

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const iso = toISODate(date);

    const deliveries = jobs.filter((job) => isDeliveryForDay(job, iso));
    const pickups = jobs.filter((job) => isPickupForDay(job, iso));

    const startOnSite = jobs.filter((job) => isOnSiteStartOfDay(job, iso)).length;
    const endOnSite = jobs.filter((job) => isOnSiteEndOfDay(job, iso)).length;
    const remaining = Math.max(0, FLEET_SIZE - endOnSite);

    return {
      iso,
      date,
      deliveries,
      pickups,
      startOnSite,
      endOnSite,
      remaining,
      hasCapacityIssue: endOnSite > FLEET_SIZE,
    };
  });

  const pickupRequests = jobs
    .filter(isPickupRequest)
    .sort((a, b) => {
        const aDate = a.delivery_date ?? "";
        const bDate = b.delivery_date ?? "";
        return aDate.localeCompare(bDate);
    });

  const activeDumpsters = jobs
    .filter((job) => {
        if (!job.delivery_date) return false;
        if (job.status === "cancelled" || job.status === "picked_up") return false;

        return job.status === "delivered" || job.status === "scheduled";
    })
  .sort((a, b) => {
        const aDate = a.delivery_date ?? "";
        const bDate = b.delivery_date ?? "";
        return aDate.localeCompare(bDate);
    });

    const todayISO = toISODate(todayETDate());

    const dumpstersOnSiteToday = jobs.filter((job) => {
        if (!job.delivery_date) return false;
        if (job.status === "cancelled" || job.status === "picked_up") return false;

        return (
            job.delivery_date <= todayISO &&
            (!job.pickup_date || job.pickup_date > todayISO)
        );
        }).length;

        const overduePickups = jobs.filter((job) => {
        if (job.status !== "delivered") return false;
        if (!job.pickup_date) return false;

        return job.pickup_date < todayISO;
    }).length;

  const futureDeliveryDates = jobs
    .filter((job) => ["confirmed", "scheduled"].includes(job.status) && Boolean(job.delivery_date))
    .map((job) => job.delivery_date as string);

  return (
    <div className="mx-auto max-w-[1700px] px-6 pt-10 pb-16">
      <div className="rounded-[32px] bg-white px-8 pb-8 pt-6 shadow-xl ring-1 ring-slate-200/70">
        {/* Header */}
        <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full bg-[#F97316]/10 px-3 py-1 text-sm font-medium text-[#F97316]">
              Dispatch / Schedule
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              Weekly dispatch board
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Plan deliveries, pickups, and open pickup requests in one place. Capacity is
              projected against a fleet size of {FLEET_SIZE}.
            </p>
          </div>

            <div className="flex items-center gap-3 whitespace-nowrap">
                <Link
                    href={`/admin/schedule?week=${toISODate(prevWeek)}`}
                    className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                    ← Previous week
                </Link>

                <Link
                    href={`/admin/schedule?week=${toISODate(getWeekStartMonday())}`}
                    className="inline-flex h-10 items-center rounded-xl bg-[#F97316] px-4 text-sm font-semibold text-white transition hover:opacity-90"
                >
                    This week
                </Link>

                <div className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-900">
                    <span>{formatWeekRange(weekStart, weekEnd)}</span>
                    {days.some((day) => day.hasCapacityIssue) && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
                        Capacity issue
                        </span>
                    )}
                </div>

                <Link
                    href={`/admin/schedule?week=${toISODate(nextWeek)}`}
                    className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                    Next week →
                </Link>
            </div>
        </div>

        {/* Top summary */}
        <div className="mt-6 flex gap-4 overflow-x-auto pb-1">
          <StatCard
            label="Week deliveries"
            value={days.reduce((sum, day) => sum + day.deliveries.length, 0)}
            tone="orange"
          />
          <StatCard
            label="Week pickups"
            value={days.reduce((sum, day) => sum + day.pickups.length, 0)}
            tone="blue"
          />
          <StatCard
            label="Open pickup requests"
            value={pickupRequests.length}
            tone="emerald"
          />
          <StatCard
            label="Dumpsters on-site today"
            value={dumpstersOnSiteToday}
            tone="slate"
          />
          <StatCard
            label="Overdue pickups"
            value={overduePickups}
            tone="orange"
          />
        </div>

        {/* Board */}
        <div className="mt-8 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px_340px]">
          <ScheduleBoard
            days={days.map((day) => ({
                ...day,
                dateLabel: formatDayLabel(day.date),
                isToday: toISODate(day.date) === toISODate(todayETDate()),
            }))}
        />

          <>
            <PickupRequestPanel requests={pickupRequests} futureDeliveryDates={futureDeliveryDates} />
            <ActiveDumpstersPanel dumpsters={activeDumpsters} futureDeliveryDates={futureDeliveryDates} />
          </>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "orange" | "blue" | "emerald" | "slate";
}) {
  const tones = {
    orange: "bg-[#F97316]/10 text-[#C2410C]",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="flex-1 min-w-[180px] rounded-xl border border-slate-200 bg-white px-4 py-2 flex items-center justify-between">
      <div className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
        {label}
      </div>
      <div className="text-lg font-semibold text-slate-900">{value}</div>
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
    <aside className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4">
        <div className="border-b border-slate-200 pb-4">
            <div className="flex items-center justify-between gap-2">
                <div className="text-base font-semibold text-slate-900">Pickup requests</div>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                {requests.length} {requests.length === 1 ? "request" : "requests"}
                </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
                Dumpsters currently on-site that still need a pickup date assigned.
            </p>
        </div>

      <div className="mt-4 space-y-3">
        {requests.length ? (
          requests.map((job) => {
            const placementView = getPlacementViewModel(job);
            const pickupView = getPickupViewModel(
              job,
              futureDeliveryDates.filter((date) => date !== job.delivery_date),
            );

            return (
              <div key={job.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {job.customer_name || "Unnamed customer"}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {[job.customer_city, job.customer_zip].filter(Boolean).join(" · ") ||
                        "Location missing"}
                    </div>
                  </div>

                  <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                    Needs date
                  </span>
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  Delivered {formatShortDate(job.delivery_date)}
                </div>

                {placementView.summary !== "No placement details collected" ? (
                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Placement
                    </div>
                    <div className="mt-1 text-sm text-slate-700">{placementView.summary}</div>
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

                <div className="mt-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">Pickup status:</span>
                    <span className="text-sm text-slate-700">{pickupView.pickupStatusLabel}</span>
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
                    <div className="mt-1 text-xs text-slate-500">
                      Expected available again {formatShortDate(pickupView.expectedAvailableDate)}.{" "}
                      {pickupView.expectedAvailabilityHelper}
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/bookings/${encodeURIComponent(job.id)}`}
                    className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    View booking
                  </Link>
                  <div className="flex flex-wrap gap-2">

                    <form action="/api/admin/schedule-pickup" method="POST">
                        <input type="hidden" name="id" value={job.id} />
                        <input type="hidden" name="pickup_date" value={toISODate(addDays(todayETDate(),1))} />
                        <input type="hidden" name="redirectTo" value="/admin/schedule" />

                        <button
                            type="submit"
                            className="inline-flex h-9 items-center rounded-xl bg-slate-900 px-3 text-sm font-medium text-white hover:opacity-90"
                        >
                            Tomorrow
                        </button>
                    </form>

                    <form action="/api/admin/schedule-pickup" method="POST">
                        <input type="hidden" name="id" value={job.id} />
                        <input type="hidden" name="pickup_date" value={toISODate(addDays(todayETDate(),2))} />
                        <input type="hidden" name="redirectTo" value="/admin/schedule" />

                        <button
                            type="submit"
                            className="inline-flex h-9 items-center rounded-xl bg-slate-100 px-3 text-sm font-medium text-slate-800 hover:bg-slate-200"
                        >
                            +2 days
                        </button>
                    </form>

                    <form action="/api/admin/schedule-pickup" method="POST">
                        <input type="hidden" name="id" value={job.id} />
                        <input type="hidden" name="pickup_date" value={toISODate(addDays(todayETDate(),3))} />
                        <input type="hidden" name="redirectTo" value="/admin/schedule" />

                        <button
                            type="submit"
                            className="inline-flex h-9 items-center rounded-xl bg-slate-100 px-3 text-sm font-medium text-slate-800 hover:bg-slate-200"
                        >
                            +3 days
                        </button>
                    </form>

                </div>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState label="No open pickup requests" />
        )}
      </div>
    </aside>
  );
}

function daysOnSite(delivery_date?: string | null) {
  if (!delivery_date) return 0;

  const today = todayETDate();
  const delivered = dateFromISO(delivery_date);

  const diff = Math.floor((today.getTime() - delivered.getTime()) / 86400000);
  return Math.max(diff, 0);
}

function ActiveDumpstersPanel({
  dumpsters,
  futureDeliveryDates,
}: {
  dumpsters: BookingRow[];
  futureDeliveryDates: string[];
}) {
  return (
    <aside className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4">
        <div className="border-b border-slate-200 pb-4">
            <div className="flex items-center justify-between gap-2">
                <div className="text-base font-semibold text-slate-900">Dumpsters on-site</div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {dumpsters.length} {dumpsters.length === 1 ? "dumpster" : "dumpsters"}
                </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
                All dumpsters currently out in the field.
            </p>
        </div>

      <div className="mt-4 space-y-3">
        {dumpsters.length ? (
          dumpsters.map((job) => {
            const placementView = getPlacementViewModel(job);
            const pickupView = getPickupViewModel(
              job,
              futureDeliveryDates.filter((date) => date !== job.delivery_date),
            );

            return (
              <div key={job.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="text-sm font-semibold text-slate-900">
                  {job.customer_name || "Unnamed customer"}
                </div>

                <div className="mt-1 text-sm text-slate-600">
                  {[job.customer_city, job.customer_zip].filter(Boolean).join(" · ")}
                </div>

                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                      Delivered {formatShortDate(job.delivery_date)}
                  </span>

                  {(() => {
                      const days = daysOnSite(job.delivery_date);

                      const tone =
                      days >= 8
                          ? "bg-rose-50 text-rose-700"
                          : days >= 6
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700";

                      return (
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${tone}`}>
                          {days} days
                      </span>
                      );
                  })()}
                </div>

                {placementView.summary !== "No placement details collected" ? (
                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Placement
                    </div>
                    <div className="mt-1 text-sm text-slate-700">{placementView.summary}</div>
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

                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">Pickup status:</span>
                    <span className="text-sm text-slate-700">{pickupView.pickupStatusLabel}</span>
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
                    <div className="mt-1 text-xs text-slate-500">
                      Expected available again {formatShortDate(pickupView.expectedAvailableDate)}.{" "}
                      {pickupView.expectedAvailabilityHelper}
                    </div>
                  ) : null}
                  {pickupView.riskMessage ? (
                    <div className="mt-2 text-xs text-slate-600">{pickupView.riskMessage}</div>
                  ) : null}
                </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                          href={`/admin/bookings/${encodeURIComponent(job.id)}`}
                          className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                          View
                      </Link>

                      <Link
                          href={`/admin/bookings/${encodeURIComponent(job.id)}?action=swap`}
                          className="inline-flex h-8 items-center rounded-lg bg-purple-50 px-3 text-xs font-medium text-purple-700 ring-1 ring-purple-200 hover:bg-purple-100"
                      >
                          Create swap
                      </Link>
                  </div>
              </div>
            );
          })
        ) : (
          <EmptyState label="No dumpsters currently on-site" />
        )}
      </div>
    </aside>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}
