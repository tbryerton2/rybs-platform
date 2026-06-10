"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import {
  ArrowTopRightOnSquareIcon,
  ArrowUturnLeftIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  TruckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  getPlacementDispatchSummary,
  sanitizePlacementDetails,
} from "@/lib/placement";
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

const sectionTheme = {
  delivery: {
    section: "border-emerald-200/80 bg-slate-50/70",
    empty: "border-emerald-200 bg-emerald-100/70 text-emerald-900",
    icon: "bg-white text-emerald-700 ring-emerald-200/90",
    card: "border-emerald-300/80 bg-emerald-50/80",
    hover: "hover:border-emerald-400/90 hover:bg-emerald-100/90",
    focus: "focus-visible:ring-emerald-200",
    count: "text-emerald-700",
    title: "text-emerald-900",
  },
  pickup: {
    section: "border-blue-100 bg-blue-50/70",
    empty: "border-blue-100 bg-blue-100/70 text-blue-800",
    icon: "bg-white text-blue-700 ring-blue-200",
    card: "border-blue-200 bg-blue-100/70",
    hover: "hover:border-blue-300 hover:bg-blue-100/90",
    focus: "focus-visible:ring-blue-200",
    count: "text-blue-700",
    title: "text-blue-900",
  },
} as const;

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

function getDayHeaderPills(day: DayData) {
  if (!day.isToday) return [];

  return [
    {
      label: "Today",
      classes: "bg-[#F97316]/10 text-[#C2410C] ring-[#F97316]/20",
    },
  ];
}

function stopDescriptor(job: BookingRow) {
  return bookingReference(job);
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

function operationalNotes(job: BookingRow, variant: StopVariant) {
  if (job.notes?.trim()) return job.notes.trim();
  if (variant === "delivery") return placementSummary(job);
  return null;
}

function QuickViewDialog({
  openStop,
  onClose,
}: {
  openStop: { job: BookingRow; variant: StopVariant } | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!openStop) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, openStop]);

  if (!openStop) return null;

  const { job, variant } = openStop;
  const notes = operationalNotes(job, variant);
  const serviceDate = variant === "delivery" ? job.delivery_date : job.pickup_date;
  const theme = sectionTheme[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-stop-quick-view-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />

      <div className="relative w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${theme.icon}`}
              >
                {variant === "delivery" ? (
                  <TruckIcon className="h-5 w-5" />
                ) : (
                  <ArrowUturnLeftIcon className="h-5 w-5" />
                )}
              </span>
            </div>
            <h2 id="schedule-stop-quick-view-title" className="mt-4 text-xl font-semibold text-slate-900">
              {formatCustomerName(job.customer_first_name, job.customer_last_name, "Unnamed customer")}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {variant === "delivery" ? "Delivery" : "Pickup"} quick view
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
            aria-label="Close quick view"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Booking reference
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{bookingReference(job)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Service type
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {variant === "delivery" ? "Delivery" : "Pickup"}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Booking ID
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{stopDescriptor(job)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Status
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{job.status.replace("_", " ")}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Service date
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatShortDate(serviceDate)}</div>
          </div>

        </div>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <MapPinIcon className="h-4 w-4" />
            Service address
          </div>
          <div className="mt-1 text-sm leading-6 text-slate-800">{formatAddress(job)}</div>
        </div>

        {notes ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Operational notes
            </div>
            <div className="mt-1 text-sm leading-6 text-slate-700">{notes}</div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {variant === "delivery" ? (
              <form action="/api/admin/mark-delivered" method="POST">
                <input type="hidden" name="id" value={job.id} />
                <input type="hidden" name="redirectTo" value="/admin/schedule" />
                <FormSubmitButton
                  loadingLabel="Marking..."
                  className="inline-flex h-10 items-center rounded-xl bg-[#F97316] px-4 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#F97316]/20"
                >
                  Mark delivered
                </FormSubmitButton>
              </form>
            ) : (
              <form action="/api/admin/mark-picked-up" method="POST">
                <input type="hidden" name="id" value={job.id} />
                <input type="hidden" name="redirectTo" value="/admin/schedule" />
                <FormSubmitButton
                  loadingLabel="Marking..."
                  className="inline-flex h-10 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
                >
                  Mark picked up
                </FormSubmitButton>
              </form>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
            >
              Close
            </button>

            <Link
              href={`/admin/bookings/${encodeURIComponent(job.id)}`}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
            >
              Open booking details
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  variant,
  showIcon = true,
}: {
  title: string;
  count: number;
  variant: StopVariant;
  showIcon?: boolean;
}) {
  const theme = sectionTheme[variant];
  const Icon = variant === "delivery" ? TruckIcon : ArrowUturnLeftIcon;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {showIcon ? (
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ring-1 ${theme.icon}`}>
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <div className={`text-sm font-semibold ${theme.title}`}>{title}</div>
      </div>
      <div className={`pr-1 text-xs font-semibold ${theme.count}`}>{count}</div>
    </div>
  );
}

function CompactEmptyState({
  label,
  icon: Icon,
  variant,
  multiline = false,
}: {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  variant: StopVariant;
  multiline?: boolean;
}) {
  const theme = sectionTheme[variant];

  return (
    <div className={`rounded-2xl border px-3.5 py-4 text-center ${theme.empty}`}>
      <div
        className={`mx-auto inline-flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ${theme.icon}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className={`mt-2.5 text-sm font-semibold ${multiline ? "leading-5" : ""}`}>
        {multiline ? (
          <>
            <span className="block">No deliveries</span>
            <span className="block">scheduled</span>
          </>
        ) : (
          label
        )}
      </div>
    </div>
  );
}

function CompactEmptyDayState() {
  return (
    <div className="mx-auto w-full max-w-[110px] rounded-2xl border border-slate-200 bg-slate-100/80 px-2 py-2.5 text-center text-slate-700">
      <div className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200">
        <ClipboardDocumentCheckIcon className="h-5 w-5" />
      </div>
      <div className="mt-1 text-sm font-semibold leading-4.5 text-slate-900">
        <span className="block">Nothing</span>
        <span className="block">scheduled</span>
      </div>
    </div>
  );
}

function StopCard({
  job,
  variant,
  onOpen,
}: {
  job: BookingRow;
  variant: StopVariant;
  onOpen: (job: BookingRow, variant: StopVariant) => void;
}) {
  const theme = sectionTheme[variant];
  const overdue = variant === "delivery" ? isOverdueDelivery(job) : isOverduePickup(job);
  const Icon = overdue ? (variant === "delivery" ? OctagonAlert : ExclamationTriangleIcon) : variant === "delivery" ? TruckIcon : ArrowUturnLeftIcon;
  const iconClasses = overdue
    ? "bg-white text-rose-700 ring-rose-200"
    : variant === "delivery"
      ? "bg-white text-emerald-700 ring-emerald-200/90"
      : theme.icon;

  return (
    <button
      type="button"
      onClick={() => onOpen(job, variant)}
      className={`group w-full rounded-2xl border p-3 text-left shadow-sm shadow-slate-950/5 transition duration-150 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-4 ${theme.card} ${theme.hover} ${theme.focus}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ${iconClasses}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">
              {formatCustomerName(job.customer_first_name, job.customer_last_name, "Unnamed customer")}
            </div>
            <div className="mt-1 text-xs font-medium text-slate-700">{stopDescriptor(job)}</div>
          </div>
        </div>
      </div>

      <div className="mt-2 text-sm text-slate-600">{formatAddress(job)}</div>

      <div className="mt-3 flex items-center justify-end gap-3 pr-1 text-xs text-slate-500">
        <span className="font-semibold text-slate-400 transition group-hover:text-slate-600">Quick view</span>
      </div>
    </button>
  );
}

function DayColumn({
  day,
  onOpen,
}: {
  day: DayData;
  onOpen: (job: BookingRow, variant: StopVariant) => void;
}) {
  const bothEmpty = day.deliveries.length === 0 && day.pickups.length === 0;
  const deliveriesEmpty = day.deliveries.length === 0;
  const pickupsEmpty = day.pickups.length === 0;
  const lightColumn = !bothEmpty && ((deliveriesEmpty && !pickupsEmpty) || (!deliveriesEmpty && pickupsEmpty));
  const sharedSectionWidth = lightColumn ? "mx-auto w-full max-w-[206px]" : "w-full";
  const [weekday = day.dateLabel, dayNumber = ""] = day.dateLabel.split(" ");

  return (
    <section
      className={`flex-none rounded-[26px] border border-slate-200 bg-white shadow-sm shadow-slate-950/5 ${
        bothEmpty
          ? "w-[154px] px-3 pt-4 pb-3.5"
          : lightColumn
            ? "w-[236px] px-3.5 pt-4 pb-3.5"
            : "w-[260px] px-4 pt-4 pb-4"
      } ${
        day.isToday ? "ring-2 ring-[#F97316]/15" : ""
      }`}
    >
      <header className="border-b border-slate-100 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-[0.08em] text-slate-900">{weekday}</span>
            <span className="text-lg font-semibold text-slate-600">{dayNumber}</span>
          </div>

          <div className="flex items-center justify-end">
            {getDayHeaderPills(day).map((pill) => (
              <span
                key={`${day.iso}-${pill.label}`}
                className={`inline-flex h-6 items-center justify-center rounded-full px-2.5 text-[10px] font-semibold ring-1 ${pill.classes}`}
              >
                {pill.label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-1.5 text-sm leading-5 text-slate-500">
          {day.totalStops} {day.totalStops === 1 ? "stop" : "stops"}
        </div>
      </header>

      <div className={bothEmpty ? "mt-3" : "mt-3 flex flex-col gap-4"}>
        {bothEmpty ? (
          <CompactEmptyDayState />
        ) : (
          <div className={`${sharedSectionWidth} space-y-4`}>
            {deliveriesEmpty ? (
              <CompactEmptyState
                label="No deliveries scheduled"
                icon={TruckIcon}
                variant="delivery"
                multiline
              />
            ) : (
              <div className={`rounded-[22px] border px-2.5 py-3 ${sectionTheme.delivery.section}`}>
                <SectionHeader title="Deliveries" count={day.deliveries.length} variant="delivery" showIcon={false} />
                <div className="mt-3 space-y-3">
                  {day.deliveries.map((job) => (
                    <StopCard key={job.id} job={job} variant="delivery" onOpen={onOpen} />
                  ))}
                </div>
              </div>
            )}

            {pickupsEmpty ? (
              <CompactEmptyState
                label="No pickups scheduled"
                icon={ArrowUturnLeftIcon}
                variant="pickup"
              />
            ) : (
              <div className={`rounded-[22px] border px-2.5 py-3 ${sectionTheme.pickup.section}`}>
                <SectionHeader title="Pickups" count={day.pickups.length} variant="pickup" showIcon={false} />
                <div className="mt-3 space-y-3">
                  {day.pickups.map((job) => (
                    <StopCard key={job.id} job={job} variant="pickup" onOpen={onOpen} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
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

export default function ScheduleBoard({
  days,
  activeFilter = "stops",
}: {
  days: DayData[];
  activeFilter?: ScheduleBoardFilter;
}) {
  const [openStop, setOpenStop] = useState<{ job: BookingRow; variant: StopVariant } | null>(null);
  const [hideEmptyDays, setHideEmptyDays] = useState(false);
  const filteredDays = days
    .map((day) => {
      let deliveries = day.deliveries;
      let pickups = day.pickups;

      switch (activeFilter) {
        case "deliveries":
          pickups = [];
          break;
        case "pickups":
          deliveries = [];
          break;
        case "overdueDeliveries":
          deliveries = day.deliveries.filter(isOverdueDelivery);
          pickups = [];
          break;
        case "overduePickups":
          deliveries = [];
          pickups = day.pickups.filter(isOverduePickup);
          break;
        default:
          break;
      }

      const totalStops = deliveries.length + pickups.length;

      return {
        ...day,
        deliveries,
        pickups,
        totalStops,
      };
    })
    .filter((day) => {
      if (activeFilter === "stops") {
        return hideEmptyDays ? day.totalStops > 0 : true;
      }

      return day.totalStops > 0;
    });

  return (
    <>
      <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm shadow-slate-950/5">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                <CalendarDaysIcon className="h-5 w-5" />
              </span>
              <div>
                <div className="text-base font-semibold text-slate-900">Weekly dispatch board</div>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm shadow-slate-950/5">
              <input
                type="checkbox"
                checked={hideEmptyDays}
                onChange={(event) => setHideEmptyDays(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]/30"
              />
              <span>Hide empty days</span>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          {filteredDays.length > 0 ? (
            <div className="flex min-w-max items-start gap-4">
              {filteredDays.map((day) => (
                <DayColumn
                  key={day.iso}
                  day={day}
                  onOpen={(job, variant) => setOpenStop({ job, variant })}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-6 py-10 text-center text-slate-600">
              <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 ring-1 ring-slate-200">
                <CalendarDaysIcon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-sm font-semibold text-slate-900">
                {emptyMessageForFilter(activeFilter)}
              </div>
            </div>
          )}
        </div>
      </div>

      <QuickViewDialog openStop={openStop} onClose={() => setOpenStop(null)} />
    </>
  );
}
