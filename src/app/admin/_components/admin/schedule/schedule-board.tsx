// src/app/admin/_components/admin/schedule/schedule-board.tsx
"use client";

import Link from "next/link";
import {
  getPlacementCompactSignals,
  getPlacementDispatchSummary,
  sanitizePlacementDetails,
} from "@/lib/placement";

type BookingRow = {
  id: string;
  customer_name: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string | null;
  pickup_date: string | null;
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

function formatShortDate(iso?: string | null) {
  if (!iso) return "—";

  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
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
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function daysOnSite(deliveryDate?: string | null) {
  if (!deliveryDate) return 0;

  const today = dateFromISO(todayISO());
  const delivered = dateFromISO(deliveryDate);

  const diff = Math.floor((today.getTime() - delivered.getTime()) / 86400000);
  return Math.max(diff, 0);
}

function needsAttention(job: BookingRow) {
  const today = todayISO();

  if (job.status === "delivered" && job.pickup_date && job.pickup_date < today) {
    return "Overdue pickup";
  }

  if (job.status === "delivered" && job.delivery_date) {
    const days = daysOnSite(job.delivery_date);
    if (days >= 8) return "Aging on-site";
  }

  return null;
}

function groupByZip(jobs: BookingRow[]) {
  const groups: Record<string, BookingRow[]> = {};

  for (const job of jobs) {
    const zip = job.customer_zip ?? "Unknown";
    if (!groups[zip]) groups[zip] = [];
    groups[zip].push(job);
  }

  return groups;
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

function SectionEmpty({ label }: { label: string }) {
  return <div className="text-sm text-slate-400">{label}</div>;
}

function JobCard({
  job,
  type,
}: {
  job: BookingRow;
  type: "delivery" | "pickup";
}) {
  const attention = needsAttention(job);
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
  const placementSignals = getPlacementCompactSignals(placement, 3);
  const placementSummary = getPlacementDispatchSummary(placement);

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 pr-3">
          <div className="max-w-[120px] text-sm font-semibold leading-6 text-slate-900">
            {job.customer_name || "Unnamed customer"}
          </div>
        </div>

        <div className="shrink-0">
          {job.job_type === "swap" ? (
            <div className="flex flex-col items-end gap-1.5">
              <span className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 ring-1 ring-purple-200">
                Swap
              </span>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${badgeClasses(job.status)}`}
              >
                {statusLabel(job.status)}
              </span>
            </div>
          ) : (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${badgeClasses(job.status)}`}
            >
              {statusLabel(job.status)}
            </span>
          )}
        </div>
      </div>

      {attention && (
        <div className="mt-2">
          <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
            {attention}
          </span>
        </div>
      )}

      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Location
        </div>
        <div className="mt-1 text-sm font-medium leading-5 text-slate-900">
          {job.customer_city ? `${job.customer_city}, NY` : "Location missing"}
        </div>
        <div className="text-sm text-slate-700">
          ZIP: <span className="font-semibold text-slate-900">{job.customer_zip || "—"}</span>
        </div>
      </div>

      {placementSummary !== "No placement details collected" ? (
        <div className="mt-3 rounded-xl bg-white px-3 py-2.5 text-xs ring-1 ring-slate-200">
          <div className="font-semibold uppercase tracking-wide text-slate-500">Placement</div>
          <div className="mt-1 text-sm text-slate-700">{placementSummary}</div>
          {placementSignals.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {placementSignals.map((signal) => (
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

      {job.job_type === "swap" ? (
        <div className="mt-3 rounded-xl bg-purple-50 px-3 py-3 text-xs ring-1 ring-purple-200">
          <div className="font-semibold uppercase tracking-wide text-purple-700">Swap stop</div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Remove full</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {formatShortDate(job.pickup_date)}
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Drop empty</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {formatShortDate(job.delivery_date)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
            <div className="text-center text-[11px] uppercase tracking-wide text-slate-500">
              Delivery
            </div>
            <div className="mt-1 text-center whitespace-nowrap text-[15px] font-semibold leading-6 text-slate-900">
              {formatShortDate(job.delivery_date)}
            </div>
          </div>

          <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
            <div className="text-center text-[11px] uppercase tracking-wide text-slate-500">
              Pickup
            </div>
            <div className="mt-1 text-center whitespace-nowrap text-[15px] font-semibold leading-6 text-slate-900">
              {job.pickup_mode === "request" && !job.pickup_date
                ? "Requested"
                : formatShortDate(job.pickup_date)}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <Link
          href={`/admin/bookings/${encodeURIComponent(job.id)}`}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          View
        </Link>

        <div className="flex items-center gap-2">
          {type === "delivery" && (
            <form action="/api/admin/mark-delivered" method="POST">
              <input type="hidden" name="id" value={job.id} />
              <input type="hidden" name="redirectTo" value="/admin/schedule" />
              <button
                type="submit"
                className="inline-flex h-7 items-center rounded-lg bg-[#F97316] px-2.5 text-[11px] font-semibold text-white hover:opacity-90"
              >
                Delivered
              </button>
            </form>
          )}

          {type === "pickup" && (
            <form action="/api/admin/mark-picked-up" method="POST">
              <input type="hidden" name="id" value={job.id} />
              <input type="hidden" name="redirectTo" value="/admin/schedule" />
              <button
                type="submit"
                className="inline-flex h-7 items-center rounded-lg bg-slate-900 px-2.5 text-[11px] font-semibold text-white hover:opacity-90"
              >
                Picked up
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ZipGroup({
  zip,
  jobs,
  type,
}: {
  zip: string;
  jobs: BookingRow[];
  type: "delivery" | "pickup";
}) {
  return (
    <div className="space-y-2 border-t border-slate-200 pt-2 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
        <span>📍 {zip}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
          {jobs.length} {jobs.length === 1 ? "stop" : "stops"}
        </span>
      </div>

      {jobs.map((job) => (
        <JobCard key={job.id} job={job} type={type} />
      ))}
    </div>
  );
}

function CollapsibleSection({
  title,
  jobs,
  type,
}: {
  title: string;
  jobs: BookingRow[];
  type: "delivery" | "pickup";
}) {
  return (
    <details className="group" open={false}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </h2>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
            {jobs.length}
          </span>
        </div>

        <span className="text-slate-400 transition group-open:rotate-180">⌄</span>
      </summary>

      <div className="mt-2 space-y-2">
        {jobs.length ? (
          Object.entries(groupByZip(jobs)).map(([zip, zipJobs]) => (
            <ZipGroup key={zip} zip={zip} jobs={zipJobs} type={type} />
          ))
        ) : (
          <SectionEmpty label={type === "delivery" ? "No deliveries" : "No pickups"} />
        )}
      </div>
    </details>
  );
}

export default function ScheduleBoard({ days }: { days: DayData[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[1680px] grid-cols-7 gap-5">
        {days.map((day) => (
          <section
            key={day.iso}
            className={`rounded-[24px] border px-5 py-5 ${
              day.isToday
                ? "border-[#F97316]/35 bg-[#F97316]/[0.04]"
                : "border-slate-200 bg-slate-50/60"
            }`}
          >
            <div className="border-b border-slate-200 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-900">
                    {day.dateLabel}
                  </div>

                  <div className="mt-2 text-sm font-medium text-slate-600">
                    {day.deliveries.length + day.pickups.length}{" "}
                    {day.deliveries.length + day.pickups.length === 1 ? "stop" : "stops"} today
                  </div>
                </div>

                {day.isToday && (
                  <span className="shrink-0 rounded-full bg-[#F97316]/10 px-2.5 py-1 text-[10px] font-semibold text-[#F97316]">
                    TODAY
                  </span>
                )}
              </div>

              <div className="mt-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Inventory
                </div>

                <div className="mt-2 flex items-stretch gap-2">
  <div className="min-w-0 flex-1 rounded-lg bg-white px-2 py-2 text-center ring-1 ring-slate-200">
    <div className="text-[10px] uppercase tracking-wide text-slate-500">Remain</div>
    <div className="mt-0.5 text-sm font-semibold text-slate-900">{day.remaining}</div>
  </div>

                   <div className="min-w-0 flex-1 rounded-lg bg-white px-2 py-2 text-center ring-1 ring-slate-200">
    <div className="text-[10px] uppercase tracking-wide text-slate-500">Start</div>
    <div className="mt-0.5 text-sm font-semibold text-slate-900">{day.startOnSite}</div>
  </div>

                   <div className="min-w-0 flex-1 rounded-lg bg-white px-2 py-2 text-center ring-1 ring-slate-200">
    <div className="text-[10px] uppercase tracking-wide text-slate-500">End</div>
    <div className="mt-0.5 text-sm font-semibold text-slate-900">{day.endOnSite}</div>
  </div>
                </div>
              </div>

              {day.hasCapacityIssue && (
                <div className="mt-2 inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-rose-200">
                  Capacity issue
                </div>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <CollapsibleSection title="Deliveries" jobs={day.deliveries} type="delivery" />
              <CollapsibleSection title="Pickups" jobs={day.pickups} type="pickup" />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
