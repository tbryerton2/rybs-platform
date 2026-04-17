"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import {
  ArrowTopRightOnSquareIcon,
  ArrowUturnLeftIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  MapPinIcon,
  TruckIcon,
  XMarkIcon,
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

const sectionTheme = {
  delivery: {
    section: "border-[#F97316]/12 bg-[#F97316]/[0.08]",
    empty: "border-[#F97316]/12 bg-[#F97316]/10 text-[#9A3412]",
    icon: "bg-[#F97316]/12 text-[#C2410C] ring-[#F97316]/15",
    card: "border-[#F97316]/25 bg-[#F97316]/10",
    hover: "hover:border-[#EA580C]/35 hover:bg-[#F97316]/[0.14]",
    focus: "focus-visible:ring-[#F97316]/20",
    count: "text-[#C2410C]",
    title: "text-[#9A3412]",
  },
  pickup: {
    section: "border-blue-100 bg-blue-50/70",
    empty: "border-blue-100 bg-blue-100/70 text-blue-800",
    icon: "bg-blue-100 text-blue-700 ring-blue-200",
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
              {job.customer_name || "Unnamed customer"}
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
                <button
                  type="submit"
                  className="inline-flex h-10 items-center rounded-xl bg-[#F97316] px-4 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#F97316]/20"
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
                  className="inline-flex h-10 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
                >
                  Mark picked up
                </button>
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
}: {
  title: string;
  count: number;
  variant: StopVariant;
}) {
  const theme = sectionTheme[variant];
  const Icon = variant === "delivery" ? TruckIcon : ArrowUturnLeftIcon;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ring-1 ${theme.icon}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className={`text-sm font-semibold ${theme.title}`}>{title}</div>
      </div>
      <div className={`text-xs font-semibold ${theme.count}`}>{count}</div>
    </div>
  );
}

function CompactEmptyState({
  label,
  icon: Icon,
  variant,
}: {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  variant: StopVariant;
}) {
  const theme = sectionTheme[variant];

  return (
    <div className={`rounded-2xl border px-4 py-5 text-center ${theme.empty}`}>
      <div
        className={`mx-auto inline-flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ${theme.icon}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold">{label}</div>
    </div>
  );
}

function CombinedEmptyState() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-8 text-center text-slate-700">
      <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-600 ring-1 ring-slate-200">
        <ClipboardDocumentCheckIcon className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-900">
        No deliveries or pickups scheduled
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

  return (
    <button
      type="button"
      onClick={() => onOpen(job, variant)}
      className={`group w-full rounded-2xl border p-3 text-left shadow-sm shadow-slate-950/5 transition duration-150 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-4 ${theme.card} ${theme.hover} ${theme.focus}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{job.customer_name || "Unnamed customer"}</div>
          <div className="mt-1 text-xs font-medium text-slate-700">{stopDescriptor(job)}</div>
        </div>
      </div>

      <div className="mt-2 text-sm text-slate-600">{formatAddress(job)}</div>

      <div className="mt-3 flex items-center justify-end gap-3 text-xs text-slate-500">
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
  const [weekday = day.dateLabel, dayNumber = ""] = day.dateLabel.split(" ");

  return (
    <section
      className={`flex h-full min-w-[250px] flex-col rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/5 ${
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

        <div className="mt-1.5 text-sm text-slate-500">
          {day.totalStops} {day.totalStops === 1 ? "scheduled stop" : "scheduled stops"}
        </div>
      </header>

      <div className="mt-3 flex flex-1 flex-col gap-4">
        {bothEmpty ? (
          <CombinedEmptyState />
        ) : (
          <>
            <div className={`rounded-[22px] border p-3 ${sectionTheme.delivery.section}`}>
              <SectionHeader title="Deliveries" count={day.deliveries.length} variant="delivery" />
              <div className="mt-3 space-y-3">
                {day.deliveries.length ? (
                  day.deliveries.map((job) => (
                    <StopCard key={job.id} job={job} variant="delivery" onOpen={onOpen} />
                  ))
                ) : (
                  <CompactEmptyState
                    label="No deliveries scheduled"
                    icon={TruckIcon}
                    variant="delivery"
                  />
                )}
              </div>
            </div>

            <div className={`rounded-[22px] border p-3 ${sectionTheme.pickup.section}`}>
              <SectionHeader title="Pickups" count={day.pickups.length} variant="pickup" />
              <div className="mt-3 space-y-3">
                {day.pickups.length ? (
                  day.pickups.map((job) => (
                    <StopCard key={job.id} job={job} variant="pickup" onOpen={onOpen} />
                  ))
                ) : (
                  <CompactEmptyState
                    label="No pickups scheduled"
                    icon={ArrowUturnLeftIcon}
                    variant="pickup"
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default function ScheduleBoard({ days }: { days: DayData[] }) {
  const [openStop, setOpenStop] = useState<{ job: BookingRow; variant: StopVariant } | null>(null);

  return (
    <>
      <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm shadow-slate-950/5">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
              <CalendarDaysIcon className="h-5 w-5" />
            </span>
            <div>
              <div className="text-base font-semibold text-slate-900">Weekly dispatch board</div>
              <div className="mt-1 text-sm text-slate-600">
                Scan the week day by day, identify open days quickly, and open any stop for more detail.
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          <div className="grid min-w-[1820px] grid-cols-7 gap-4">
            {days.map((day) => (
              <DayColumn
                key={day.iso}
                day={day}
                onOpen={(job, variant) => setOpenStop({ job, variant })}
              />
            ))}
          </div>
        </div>
      </div>

      <QuickViewDialog openStop={openStop} onClose={() => setOpenStop(null)} />
    </>
  );
}
