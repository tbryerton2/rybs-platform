import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  ArrowUturnLeftIcon,
  Squares2X2Icon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import {
  getPlacementDispatchSummary,
  sanitizePlacementDetails,
} from "@/lib/placement";

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

function badgeClasses(status: BookingRow["status"]) {
  switch (status) {
    case "confirmed":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "scheduled":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "delivered":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "picked_up":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "cancelled":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function statusLabel(status: BookingRow["status"]) {
  switch (status) {
    case "picked_up":
      return "Picked up";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dateFromISO(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function formatShortDate(iso?: string | null) {
  if (!iso) return "No date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateFromISO(iso));
}

function daysOnSite(deliveryDate?: string | null) {
  if (!deliveryDate) return 0;

  const today = dateFromISO(todayISO());
  const delivered = dateFromISO(deliveryDate);
  const diff = Math.floor((today.getTime() - delivered.getTime()) / 86400000);
  return Math.max(diff, 0);
}

function formatAddress(job: BookingRow) {
  const parts = [job.customer_street, job.customer_city, job.customer_zip]
    .map((value) => value?.trim())
    .filter(Boolean);

  return parts.length ? parts.join(", ") : "Address pending";
}

function bookingReference(job: BookingRow) {
  return job.booking_ref ?? `Job ${job.id.slice(0, 8).toUpperCase()}`;
}

function placementSummary(job: BookingRow) {
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

  const summary = getPlacementDispatchSummary(placement);
  return summary === "No placement details collected" ? null : summary;
}

function getCapacityState(day: DayData) {
  if (day.hasCapacityIssue || day.remaining === 0) {
    return {
      label: "Near full",
      classes: "bg-rose-50 text-rose-700 ring-rose-200",
    };
  }

  if (day.remaining === 1) {
    return {
      label: "Balanced",
      classes: "bg-amber-50 text-amber-700 ring-amber-200",
    };
  }

  return {
    label: "Open capacity",
    classes: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
}

function getDayHeaderPills(day: DayData) {
  const capacity = getCapacityState(day);
  const pills: Array<{ label: string; classes: string }> = [capacity];

  if (day.workloadLabel && day.workloadLabel !== capacity.label && day.workloadLabel !== "Open capacity") {
    pills.push({
      label: day.workloadLabel,
      classes: "bg-slate-100 text-slate-700 ring-slate-200",
    });
  } else if (day.isToday) {
    pills.push({
      label: "Today",
      classes: "bg-[#F97316]/10 text-[#C2410C] ring-[#F97316]/20",
    });
  }

  return pills.slice(0, 2);
}

function EmptyState({
  label,
  hint,
}: {
  label: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{hint}</div>
    </div>
  );
}

function BoardJobCard({
  job,
  variant,
}: {
  job: BookingRow;
  variant: "delivery" | "pickup";
}) {
  const placement = placementSummary(job);
  const onsiteDays = daysOnSite(job.delivery_date);
  const pickupDescriptor =
    job.pickup_mode === "request" && !job.pickup_date
      ? "Pickup requested, not yet scheduled"
      : job.pickup_date
        ? `Pickup ${formatShortDate(job.pickup_date)}`
        : `${onsiteDays} day${onsiteDays === 1 ? "" : "s"} on-site`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-950/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {bookingReference(job)}
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-900">
            {job.customer_name || "Unnamed customer"}
          </div>
        </div>

        <span
          className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ${badgeClasses(job.status)}`}
        >
          {statusLabel(job.status)}
        </span>
      </div>

      <div className="mt-2 text-sm leading-5 text-slate-600">{formatAddress(job)}</div>

      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 ring-1 ring-slate-200">
        {variant === "delivery"
          ? placement ?? "Placement details not captured yet."
          : pickupDescriptor}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Link
          href={`/admin/bookings/${encodeURIComponent(job.id)}`}
          className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          View booking
        </Link>

        {variant === "delivery" ? (
          <form action="/api/admin/mark-delivered" method="POST">
            <input type="hidden" name="id" value={job.id} />
            <input type="hidden" name="redirectTo" value="/admin/schedule" />
            <button
              type="submit"
              className="inline-flex h-8 items-center rounded-lg bg-[#F97316] px-3 text-xs font-semibold text-white transition hover:opacity-90"
            >
              Mark delivered
            </button>
          </form>
        ) : (
          <form action="/api/admin/mark-picked-up" method="POST">
            <input type="hidden" name="id" value={job.id} />
            <input type="hidden" name="redirectTo" value="/admin/schedule" />
            <button
              type="submit"
              className="inline-flex h-8 items-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              Mark picked up
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function RowHeading({
  icon: Icon,
  title,
  description,
  className,
  iconClasses,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  className?: string;
  iconClasses?: string;
}) {
  return (
    <div
      className={`sticky left-0 z-10 flex h-full border-r border-slate-200 px-4 py-5 ${className ?? "bg-white"}`}
    >
      <div className="mx-auto flex h-full w-full max-w-[152px] flex-col justify-center">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${iconClasses ?? "bg-slate-100 text-slate-700 ring-slate-200"}`}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
        </div>
        <div className="mt-2.5 pl-12 text-[13px] leading-5 text-slate-600">{description}</div>
      </div>
    </div>
  );
}

function InventoryCell({ day }: { day: DayData }) {
  const capacity = getCapacityState(day);

  return (
    <div className="h-full px-3 py-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Capacity
          </div>
          <span
            className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-center text-[10px] font-semibold leading-none ring-1 ${capacity.classes}`}
          >
            {capacity.label}
          </span>
        </div>

        <div className="mt-4 grid gap-2">
          <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
            <span className="text-xs font-medium text-slate-500">Start on-site</span>
            <span className="text-sm font-semibold text-slate-900">{day.startOnSite}</span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
            <span className="text-xs font-medium text-slate-500">Scheduled out</span>
            <span className="text-sm font-semibold text-slate-900">{day.deliveries.length}</span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
            <span className="text-xs font-medium text-slate-500">End available</span>
            <span className="text-sm font-semibold text-slate-900">{day.remaining}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StopsCell({
  day,
  jobs,
  variant,
}: {
  day: DayData;
  jobs: BookingRow[];
  variant: "delivery" | "pickup";
}) {
  const singular = variant === "delivery" ? "delivery" : "pickup";
  const plural = variant === "delivery" ? "deliveries" : "pickups";

  return (
    <div className="h-full px-3 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">
          {jobs.length} {jobs.length === 1 ? singular : plural}
        </div>
        {jobs.length > 0 ? (
          <div className="text-xs font-medium text-slate-500">{day.dateLabel}</div>
        ) : null}
      </div>

      <div className="mt-3 space-y-3">
        {jobs.length > 0 ? (
          jobs.map((job) => (
            <BoardJobCard key={job.id} job={job} variant={variant} />
          ))
        ) : (
          <EmptyState
            label={variant === "delivery" ? "No deliveries scheduled" : "No pickups scheduled"}
            hint={
              variant === "delivery"
                ? "This day still has room for another outbound stop."
                : "No confirmed pickups are set for this day."
            }
          />
        )}
      </div>
    </div>
  );
}

export default function ScheduleBoard({ days }: { days: DayData[] }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm shadow-slate-950/5">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="text-base font-semibold text-slate-900">Weekly dispatch board</div>
        <div className="mt-1 text-sm text-slate-600">
          Compare each day across inventory, deliveries, and pickups without losing the weekly view.
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1548px] grid-cols-[180px_repeat(7,minmax(184px,1fr))] pr-2">
          <div className="sticky left-0 z-20 border-r border-slate-200 bg-white px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Weekly view
            </div>
            <div className="mt-1 text-sm font-medium text-slate-700">
              Scan each day side by side
            </div>
          </div>

          {days.map((day) => (
            <div
              key={day.iso}
              className={`border-l border-slate-200 px-4 py-4 ${
                day.isToday ? "bg-[#F97316]/[0.04]" : "bg-white"
              }`}
            >
              <div className="flex min-h-[100px] flex-col gap-3">
                <div className="flex h-7 items-center overflow-hidden">
                  <div className="flex w-full flex-nowrap items-center justify-end gap-1.5 overflow-hidden">
                    {getDayHeaderPills(day).map((pill) => (
                      <span
                        key={`${day.iso}-${pill.label}`}
                        className={`inline-flex h-6 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-2.5 text-center text-[10px] font-semibold leading-none ring-1 ${pill.classes}`}
                      >
                        {pill.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="min-w-0 space-y-1.5">
                  <div className="text-lg font-semibold text-slate-900">{day.dateLabel}</div>
                  <div className="text-sm text-slate-600">
                    {day.totalStops} {day.totalStops === 1 ? "scheduled stop" : "scheduled stops"}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <RowHeading
            icon={Squares2X2Icon}
            title="Inventory summary"
            description="Start on-site, scheduled outbound work, and end-of-day availability."
            className="border-t border-slate-200 bg-slate-50/80"
            iconClasses="bg-slate-100 text-slate-700 ring-slate-200"
          />
          {days.map((day) => (
            <div
              key={`${day.iso}-inventory`}
              className={`border-l border-t border-slate-200 ${
                day.isToday ? "bg-[#F97316]/[0.04]" : "bg-slate-50/80"
              }`}
            >
              <InventoryCell day={day} />
            </div>
          ))}

          <RowHeading
            icon={TruckIcon}
            title="Deliveries"
            description="Confirmed outbound jobs scheduled for each day of the week."
            className="border-t border-slate-200 bg-white"
            iconClasses="bg-[#F97316]/10 text-[#C2410C] ring-[#F97316]/15"
          />
          {days.map((day) => (
            <div
              key={`${day.iso}-deliveries`}
              className={`border-l border-t border-slate-200 ${
                day.isToday ? "bg-[#F97316]/[0.02]" : "bg-white"
              }`}
            >
              <StopsCell day={day} jobs={day.deliveries} variant="delivery" />
            </div>
          ))}

          <RowHeading
            icon={ArrowUturnLeftIcon}
            title="Pickups"
            description="Scheduled returns and overdue work already assigned to a day."
            className="border-t border-slate-200 bg-slate-50/60"
            iconClasses="bg-blue-50 text-blue-700 ring-blue-200"
          />
          {days.map((day) => (
            <div
              key={`${day.iso}-pickups`}
              className={`border-l border-t border-slate-200 ${
                day.isToday ? "bg-[#F97316]/[0.03]" : "bg-slate-50/60"
              }`}
            >
              <StopsCell day={day} jobs={day.pickups} variant="pickup" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
