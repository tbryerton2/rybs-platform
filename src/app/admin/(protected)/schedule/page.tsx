export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { requireAdminOwner } from "@/lib/admin/auth";
import { getDumpsterInventorySummary } from "@/lib/admin/dumpster-inventory";
import { getOverdueScheduleJobs, getScheduleJobs } from "@/lib/admin/schedule";
import {
  quickMarkDeliveredAction,
  quickMarkPickedUpAction,
} from "../bookings/[id]/actions";
import ScheduleBoardView from "../../_components/admin/schedule/schedule-board-view";

type SearchParams = Record<string, string | string[] | undefined>;

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
  notes: string | null;
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
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  })
    .format(date)
    .replace(".", "")
    .toUpperCase();

  const day = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    timeZone: "UTC",
  }).format(date);

  return `${weekday} ${day}`;
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
  return sameISO(job.pickup_date, dayISO);
}

function buildScheduleHref(weekIso: string) {
  const params = new URLSearchParams();
  params.set("week", weekIso);
  return `/admin/schedule?${params.toString()}`;
}

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const adminSession = await requireAdminOwner();
  const params = await searchParams;
  const requestedWeek = sp(params, "week");

  const weekStart = getWeekStartMonday(requestedWeek);
  const weekEnd = addDays(weekStart, 6);
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  const weekStartISO = toISODate(weekStart);
  const weekEndISO = toISODate(weekEnd);
  const todayISO = toISODate(todayETDate());

  const [allJobs, allOverdueJobs, inventorySummary] = await Promise.all([
    getScheduleJobs(weekStartISO, weekEndISO),
    getOverdueScheduleJobs(todayISO),
    getDumpsterInventorySummary(adminSession.business.id),
  ]);
  const jobs = allJobs as BookingRow[];
  const globalOverdueJobs = allOverdueJobs as BookingRow[];
  const bookableFleetSize = inventorySummary.bookableCount;

  const baseDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const iso = toISODate(date);
    const deliveries = jobs.filter((job) => isDeliveryForDay(job, iso));
    const pickups = jobs.filter((job) => isPickupForDay(job, iso));
    const startOnSite = jobs.filter((job) => isOnSiteStartOfDay(job, iso)).length;
    const endOnSite = jobs.filter((job) => isOnSiteEndOfDay(job, iso)).length;
    const remaining = Math.max(0, bookableFleetSize - endOnSite);
    const totalStops = deliveries.length + pickups.length;

    return {
      iso,
      date,
      deliveries,
      pickups,
      startOnSite,
      endOnSite,
      remaining,
      hasCapacityIssue: endOnSite > bookableFleetSize,
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

  const overduePickupsCount = globalOverdueJobs.filter(
    (job) => job.status === "delivered" && Boolean(job.pickup_date) && (job.pickup_date as string) < todayISO,
  ).length;

  const overdueDeliveryJobs = globalOverdueJobs.filter((job) => {
    if (!job.delivery_date) return false;
    return job.delivery_date < todayISO && ["confirmed", "scheduled"].includes(job.status);
  });

  const totalDeliveries = days.reduce((sum, day) => sum + day.deliveries.length, 0);
  const totalPickups = days.reduce((sum, day) => sum + day.pickups.length, 0);
  const totalStops = totalDeliveries + totalPickups;

  return (
    <AdminPage width="wide" className="max-w-[1500px]">
      <AdminPageHeader
        title="Schedule"
        description={formatWeekRange(weekStart, weekEnd)}
        className="mb-6 !flex-row !items-start !justify-between"
        actions={
          <>
            <Link
              href={buildScheduleHref(toISODate(prevWeek))}
              className="admin-btn admin-btn-secondary h-10 gap-2 px-3.5"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Previous week
            </Link>

            <Link
              href={buildScheduleHref(toISODate(getWeekStartMonday()))}
              className="admin-btn admin-btn-primary h-10 px-4"
            >
              This week
            </Link>

            <Link
              href={buildScheduleHref(toISODate(nextWeek))}
              className="admin-btn admin-btn-secondary h-10 gap-2 px-3.5"
            >
              Next week
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <ScheduleBoardView
        days={days}
        totalStops={totalStops}
        totalDeliveries={totalDeliveries}
        totalPickups={totalPickups}
        overdueDeliveriesCount={overdueDeliveryJobs.length}
        overduePickupsCount={overduePickupsCount}
        overdueJobs={globalOverdueJobs}
        onMarkDelivered={quickMarkDeliveredAction}
        onMarkPickedUp={quickMarkPickedUpAction}
      />
    </AdminPage>
  );
}
