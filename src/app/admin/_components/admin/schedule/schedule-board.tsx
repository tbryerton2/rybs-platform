"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUturnLeftIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import { formatCustomerName } from "@/lib/customer-name";

type BookingRow = {
  id: string;
  booking_ref: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string | null;
  pickup_date: string | null;
  pickup_mode: "request" | "schedule" | null;
  dumpster_id: string | null;
  dumpster_size: string | null;
  assigned_dumpster:
    | {
        display_name: string | null;
        equipment_id: string | null;
      }
    | null;
  status: "confirmed" | "scheduled" | "delivered" | "picked_up" | "cancelled";
  created_at: string | null;
  notes?: string | null;
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

type DayData = {
  iso: string;
  dateLabel: string;
  isToday: boolean;
  deliveries: BookingRow[];
  pickups: BookingRow[];
  startOnSite: number;
  endOnSite: number;
  remaining: number;
  hasCapacityIssue: boolean;
  totalStops: number;
  workloadLabel: string | null;
};

type StopVariant = "delivery" | "pickup";
type ScheduleBoardFilter =
  | "stops"
  | "deliveries"
  | "pickups"
  | "overdueDeliveries"
  | "overduePickups";

type ScheduleStop = {
  key: string;
  job: BookingRow;
  variant: StopVariant;
  date: string;
  overdue: boolean;
};

type DatedStopGroup = {
  date: string;
  stops: ScheduleStop[];
};

type BookingCompletionAction = (formData: FormData) => Promise<void>;

const CALENDAR_BOX_HEIGHT_CLASS = "h-[92px]";

function dateFromISO(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatCustomer(job: BookingRow) {
  return formatCustomerName(job.customer_first_name, job.customer_last_name, "Unnamed customer");
}

function formatAddress(job: BookingRow) {
  const parts = [job.customer_street, job.customer_city, job.customer_zip]
    .map((value) => value?.trim())
    .filter(Boolean);

  return parts.length ? parts.join(", ") : "Address pending";
}

function formatHeadingDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
    .format(dateFromISO(iso))
    .toUpperCase();
}

function formatDueDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateFromISO(iso));
}

function formatWeekday(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  })
    .format(dateFromISO(iso))
    .toUpperCase();
}

function formatDayNumber(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    timeZone: "UTC",
  }).format(dateFromISO(iso));
}

function daysOverdue(iso: string) {
  const diff = Math.floor((dateFromISO(todayISO()).getTime() - dateFromISO(iso).getTime()) / 86400000);
  return Math.max(diff, 1);
}

function assignedDumpsterLabel(job: BookingRow) {
  const displayName = job.assigned_dumpster?.display_name?.trim();
  const equipmentId = job.assigned_dumpster?.equipment_id?.trim();
  const label = [displayName, equipmentId].filter(Boolean).join(" • ");

  if (label) return label;
  if (job.dumpster_size) return `${job.dumpster_size} dumpster`;
  return null;
}

function overdueDumpsterLabel(job: BookingRow) {
  const size = job.dumpster_size?.trim();
  return size || assignedDumpsterLabel(job);
}

function isOverdueDelivery(job: BookingRow) {
  return Boolean(
    job.delivery_date &&
      job.delivery_date < todayISO() &&
      (job.status === "confirmed" || job.status === "scheduled"),
  );
}

function isOverduePickup(job: BookingRow) {
  return Boolean(job.pickup_date && job.pickup_date < todayISO() && job.status === "delivered");
}

function stopMatchesFilter(stop: ScheduleStop, activeFilter: ScheduleBoardFilter) {
  switch (activeFilter) {
    case "deliveries":
      return stop.variant === "delivery";
    case "pickups":
      return stop.variant === "pickup";
    case "overdueDeliveries":
      return stop.variant === "delivery" && stop.overdue;
    case "overduePickups":
      return stop.variant === "pickup" && stop.overdue;
    default:
      return true;
  }
}

function stopSortValue(stop: ScheduleStop) {
  return `${stop.date}-${stop.variant === "delivery" ? "0" : "1"}-${formatCustomer(stop.job)}`;
}

function getStopsForDay(day: DayData, activeFilter: ScheduleBoardFilter) {
  const stops: ScheduleStop[] = [
    ...day.deliveries.map((job) => ({
      key: `${day.iso}-${job.id}-delivery`,
      job,
      variant: "delivery" as const,
      date: day.iso,
      overdue: isOverdueDelivery(job),
    })),
    ...day.pickups.map((job) => ({
      key: `${day.iso}-${job.id}-pickup`,
      job,
      variant: "pickup" as const,
      date: day.iso,
      overdue: isOverduePickup(job),
    })),
  ];

  return stops.filter((stop) => stopMatchesFilter(stop, activeFilter)).sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return stopSortValue(a).localeCompare(stopSortValue(b));
  });
}

function getGlobalOverdueStops(jobs: BookingRow[]) {
  const stops: ScheduleStop[] = [];

  for (const job of jobs) {
    if (isOverdueDelivery(job) && job.delivery_date) {
      stops.push({
        key: `${job.delivery_date}-${job.id}-delivery`,
        job,
        variant: "delivery",
        date: job.delivery_date,
        overdue: true,
      });
    }

    if (isOverduePickup(job) && job.pickup_date) {
      stops.push({
        key: `${job.pickup_date}-${job.id}-pickup`,
        job,
        variant: "pickup",
        date: job.pickup_date,
        overdue: true,
      });
    }
  }

  return stops.sort((a, b) => stopSortValue(a).localeCompare(stopSortValue(b)));
}

function eventClasses(stop: ScheduleStop) {
  if (stop.overdue) {
    return stop.variant === "delivery"
      ? "border-[#534AB7] bg-[#EEEDFE] text-[#342B8C] shadow-slate-950/5 hover:border-[#44399C] hover:bg-[#E5E3FD]"
      : "border-[#F09595] bg-[#FCEBEB] text-[#A32D2D] shadow-rose-950/5 hover:border-[#E97979] hover:bg-[#FADDDD]";
  }

  if (stop.variant === "delivery") {
    return "border-slate-200 bg-white text-slate-900 shadow-slate-950/5 hover:border-slate-300 hover:bg-slate-50";
  }

  return "border-blue-200 bg-blue-50 text-blue-950 shadow-blue-950/5 hover:border-blue-300 hover:bg-blue-100";
}

function badgeClasses(stop: ScheduleStop) {
  if (stop.overdue) {
    return stop.variant === "delivery"
      ? "bg-[#EEEDFE] text-[#534AB7] ring-[#534AB7]"
      : "bg-[#FCEBEB] text-[#A32D2D] ring-[#F09595]";
  }
  if (stop.variant === "delivery") return "bg-emerald-100 text-emerald-700 ring-emerald-200";
  return "bg-blue-100 text-blue-700 ring-blue-200";
}

function calendarBadgeClasses(stop: ScheduleStop) {
  if (stop.overdue) {
    return stop.variant === "delivery"
      ? "border-[#534AB7] bg-white text-[#534AB7]"
      : "border-[#F09595] bg-white text-[#A32D2D]";
  }
  if (stop.variant === "delivery") return "border-emerald-200 bg-white text-emerald-700";
  return "border-blue-200 bg-white text-blue-700";
}

function overdueListTone(stop: ScheduleStop) {
  return stop.variant === "delivery"
    ? {
        row: "border-[#534AB7] bg-[#EEEDFE] text-[#342B8C] shadow-slate-950/5",
        title: "text-[#342B8C]",
        detail: "text-[#342B8C]/85",
        icon: "text-[#534AB7]",
        due: "text-[#534AB7]",
      }
    : {
        row: "border-[#F09595] bg-[#FCEBEB] text-[#A32D2D] shadow-rose-950/5",
        title: "text-[#A32D2D]",
        detail: "text-[#A32D2D]/85",
        icon: "text-[#A32D2D]",
        due: "text-[#A32D2D]",
      };
}

function formatCalendarDumpsterSize(job: BookingRow) {
  const size = job.dumpster_size?.trim();
  if (!size) return null;
  return size.replace(/\byards?\b/i, "yds");
}

function calendarEventMeta(job: BookingRow) {
  const city = job.customer_city?.trim();
  const dumpsterSize = formatCalendarDumpsterSize(job);
  return [city, dumpsterSize].filter(Boolean).join(" · ");
}

function stopLabel(stop: ScheduleStop) {
  if (stop.overdue) return "Overdue";
  return stop.variant === "delivery" ? "Delivery" : "Pickup";
}

function emptyMessageForFilter(filter: ScheduleBoardFilter) {
  switch (filter) {
    case "deliveries":
      return "No deliveries scheduled this week";
    case "pickups":
      return "No pickups scheduled this week";
    case "overdueDeliveries":
      return "No overdue deliveries this week";
    case "overduePickups":
      return "No overdue pickups this week";
    default:
      return "No scheduled deliveries or pickups this week";
  }
}

function CalendarEventBox({
  stop,
  onSelect,
}: {
  stop: ScheduleStop;
  onSelect: (stop: ScheduleStop) => void;
}) {
  const Icon = stop.variant === "delivery" ? TruckIcon : ArrowUturnLeftIcon;
  const meta = calendarEventMeta(stop.job);

  return (
    <button
      type="button"
      onClick={() => onSelect(stop)}
      className={`flex ${CALENDAR_BOX_HEIGHT_CLASS} w-full min-w-0 flex-col rounded-lg border px-2.5 py-2 text-left shadow-sm transition focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 ${eventClasses(
        stop,
      )}`}
    >
      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-normal ${calendarBadgeClasses(
          stop,
        )}`}
      >
        <Icon className="h-3 w-3" />
        {stopLabel(stop)}
      </span>
      <span className="mt-3 line-clamp-1 min-w-0 break-words text-xs font-semibold leading-4">
        {formatCustomer(stop.job)}
      </span>
      {meta ? (
        <span className="mt-0.5 truncate text-[11px] font-normal leading-4 text-slate-500">
          {meta}
        </span>
      ) : null}
    </button>
  );
}

function EmptyCalendarBox() {
  return (
    <div
      className={`flex ${CALENDAR_BOX_HEIGHT_CLASS} items-center justify-center rounded-lg border border-slate-200 bg-slate-100/80 px-2 text-center text-xs font-normal text-slate-500`}
    >
      No Stops
    </div>
  );
}

function StopTypeBadge({ stop }: { stop: ScheduleStop }) {
  const Icon = stop.variant === "delivery" ? TruckIcon : ArrowUturnLeftIcon;
  const label = stop.overdue
    ? `${stop.variant === "delivery" ? "Delivery" : "Pickup"} overdue ${daysOverdue(stop.date)} ${
        daysOverdue(stop.date) === 1 ? "day" : "days"
      }`
    : stop.variant === "delivery"
      ? "Delivery"
      : "Pickup";
  const classes = stop.overdue
    ? stop.variant === "delivery"
      ? "border border-[#534AB7] bg-white text-[#534AB7] font-normal"
      : "border border-[#F09595] bg-white text-[#A32D2D] font-normal"
    : `${badgeClasses(stop)} font-normal ring-1`;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${classes}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function BookingRowLink({
  stop,
  highlighted,
  onMarkDelivered,
  onMarkPickedUp,
}: {
  stop: ScheduleStop;
  highlighted: boolean;
  onMarkDelivered: BookingCompletionAction;
  onMarkPickedUp: BookingCompletionAction;
}) {
  const unitLabel = assignedDumpsterLabel(stop.job);

  if (stop.overdue) {
    const address = formatAddress(stop.job);
    const dumpsterLabel = overdueDumpsterLabel(stop.job);
    const action = stop.variant === "pickup" ? onMarkPickedUp : onMarkDelivered;
    const actionLabel = stop.variant === "pickup" ? "Mark picked up" : "Mark delivered";
    const tone = overdueListTone(stop);

    return (
      <div
        id={`schedule-row-${stop.key}`}
        className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border px-4 py-3 shadow-sm max-sm:grid-cols-1 ${tone.row} ${
          highlighted ? "ring-4 ring-orange-100" : ""
        }`}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`min-w-0 max-w-full break-words text-sm font-semibold leading-5 ${tone.title}`}>
              {formatCustomer(stop.job)}
            </span>
            <StopTypeBadge stop={stop} />
          </div>

          <div className={`mt-2 flex min-w-0 items-start gap-2 text-sm ${tone.detail}`}>
            <MapPinIcon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.icon}`} />
            <span className="min-w-0 break-words leading-5">
              {address}
              {dumpsterLabel ? <span className="font-medium"> · {dumpsterLabel}</span> : null}
            </span>
          </div>

          <div className={`mt-1.5 flex min-w-0 items-center gap-2 text-xs font-semibold ${tone.due}`}>
            <ClockIcon className={`h-4 w-4 shrink-0 ${tone.icon}`} />
            <span className="min-w-0 break-words">Was due {formatDueDate(stop.date)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 max-sm:w-full max-sm:flex-wrap max-sm:justify-start">
          <form action={action} className="shrink-0">
            <input type="hidden" name="id" value={stop.job.id} />
            <FormSubmitButton
              loadingLabel="Marking..."
              className="admin-btn admin-btn-primary h-9 px-3 text-xs"
            >
              {actionLabel}
            </FormSubmitButton>
          </form>

          <Link
            href={`/admin/bookings/${encodeURIComponent(stop.job.id)}`}
            className="admin-btn admin-btn-secondary h-9 shrink-0 px-3 text-xs font-normal"
          >
            View booking
          </Link>
        </div>
      </div>
    );
  }

  const action = stop.variant === "pickup" ? onMarkPickedUp : onMarkDelivered;
  const actionLabel = stop.variant === "pickup" ? "Mark picked up" : "Mark delivered";
  const rowClasses =
    stop.variant === "delivery"
      ? "border-emerald-200 focus-within:ring-emerald-100"
      : "border-blue-200 focus-within:ring-blue-100";
  return (
    <div
      id={`schedule-row-${stop.key}`}
      className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border bg-white px-4 py-3 shadow-sm shadow-slate-950/5 max-sm:grid-cols-1 ${
        highlighted ? `${rowClasses} ring-4 ring-orange-100` : rowClasses
      }`}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 max-w-full break-words text-sm font-semibold leading-5 text-slate-950">
            {formatCustomer(stop.job)}
          </span>
          <StopTypeBadge stop={stop} />
        </div>

        <div className="mt-2 flex min-w-0 items-start gap-2 text-sm text-slate-600">
          <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span className="min-w-0 break-words leading-5">
            {formatAddress(stop.job)}
            {unitLabel ? <span className="font-medium"> · {unitLabel}</span> : null}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 max-sm:w-full max-sm:flex-wrap max-sm:justify-start">
        <form action={action} className="shrink-0">
          <input type="hidden" name="id" value={stop.job.id} />
          <FormSubmitButton
            loadingLabel="Marking..."
            className="admin-btn admin-btn-primary h-9 px-3 text-xs"
          >
            {actionLabel}
          </FormSubmitButton>
        </form>

        <Link
          href={`/admin/bookings/${encodeURIComponent(stop.job.id)}`}
          className="admin-btn admin-btn-secondary h-9 shrink-0 px-3 text-xs font-normal"
        >
          View booking
        </Link>
      </div>
    </div>
  );
}

function BookingList({
  overdueStops,
  datedGroups,
  highlightedKey,
  onMarkDelivered,
  onMarkPickedUp,
}: {
  overdueStops: ScheduleStop[];
  datedGroups: DatedStopGroup[];
  highlightedKey: string | null;
  onMarkDelivered: BookingCompletionAction;
  onMarkPickedUp: BookingCompletionAction;
}) {
  if (overdueStops.length === 0 && datedGroups.length === 0) {
    return (
      <div className="rounded-[14px] border border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm font-semibold text-slate-700">
        No bookings match this schedule filter.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {overdueStops.length ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-rose-700">
            <ExclamationTriangleIcon className="h-4 w-4" />
            Overdue
          </div>
          <div className="space-y-2">
            {overdueStops.map((stop) => (
              <BookingRowLink
                key={stop.key}
                stop={stop}
                highlighted={highlightedKey === stop.key}
                onMarkDelivered={onMarkDelivered}
                onMarkPickedUp={onMarkPickedUp}
              />
            ))}
          </div>
        </section>
      ) : null}

      {datedGroups.map((group) => (
        <section key={group.date} className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            {formatHeadingDate(group.date)}
          </div>
          <div className="space-y-2">
            {group.stops.map((stop) => (
              <BookingRowLink
                key={stop.key}
                stop={stop}
                highlighted={highlightedKey === stop.key}
                onMarkDelivered={onMarkDelivered}
                onMarkPickedUp={onMarkPickedUp}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function ScheduleBoard({
  days,
  activeFilter = "stops",
  overdueJobs,
  onMarkDelivered,
  onMarkPickedUp,
}: {
  days: DayData[];
  activeFilter?: ScheduleBoardFilter;
  overdueJobs: BookingRow[];
  onMarkDelivered: BookingCompletionAction;
  onMarkPickedUp: BookingCompletionAction;
}) {
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const stopsByDay = useMemo(
    () => days.map((day) => ({ day, stops: getStopsForDay(day, activeFilter) })),
    [activeFilter, days],
  );
  const maxRows = Math.max(...stopsByDay.map(({ stops }) => stops.length), 0);
  const allStops = stopsByDay.flatMap(({ stops }) => stops);
  const overdueStops = useMemo(() => getGlobalOverdueStops(overdueJobs), [overdueJobs]);
  const normalStops = allStops.filter((stop) => !stop.overdue);
  const datedGroups = days
    .map((day) => ({
      date: day.iso,
      stops: normalStops.filter((stop) => stop.date === day.iso),
    }))
    .filter((group) => group.stops.length > 0);

  function selectCalendarStop(stop: ScheduleStop) {
    setHighlightedKey(stop.key);
    document.getElementById(`schedule-row-${stop.key}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    window.setTimeout(() => setHighlightedKey((current) => (current === stop.key ? null : current)), 1800);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm shadow-slate-950/5">
        <div className="overflow-x-auto p-4">
          <div className="min-w-[900px] lg:min-w-0">
            <div className="grid grid-cols-7 gap-2">
              {stopsByDay.map(({ day }) => (
                <div
                  key={day.iso}
                  className={`min-w-0 rounded-[14px] px-3 py-2.5 text-center ${
                    day.isToday ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200" : "bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-[0.16em]">{formatWeekday(day.iso)}</div>
                  <div className={`mt-1 text-xl font-semibold ${day.isToday ? "text-blue-900" : "text-slate-950"}`}>
                    {formatDayNumber(day.iso)}
                  </div>
                </div>
              ))}

              {maxRows > 0 ? (
                Array.from({ length: maxRows }, (_, rowIndex) =>
                  stopsByDay.map(({ day, stops }) => {
                    const stop = stops[rowIndex];

                    return (
                      <div key={`${day.iso}-${rowIndex}`} className="min-w-0">
                        {stop ? (
                          <CalendarEventBox stop={stop} onSelect={selectCalendarStop} />
                        ) : (
                          <EmptyCalendarBox />
                        )}
                      </div>
                    );
                  }),
                )
              ) : (
                <div className="col-span-7 rounded-[14px] border border-slate-200 bg-slate-50 px-6 py-10 text-center text-slate-600">
                  <div className="text-sm font-semibold text-slate-900">
                    {emptyMessageForFilter(activeFilter)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BookingList
        overdueStops={overdueStops}
        datedGroups={datedGroups}
        highlightedKey={highlightedKey}
        onMarkDelivered={onMarkDelivered}
        onMarkPickedUp={onMarkPickedUp}
      />
    </div>
  );
}
