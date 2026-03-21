import Link from "next/link";
import { canReorderBooking } from "@/lib/reorder";
import type { PortalBookingSummary } from "@/lib/portal/data";
import { getPortalRentalLabel } from "@/lib/portal/rental-number";
import { PortalStatusBadge } from "./portal-status-badge";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00`));
}

export function PortalBookingCard({
  booking,
  compact = false,
}: {
  booking: PortalBookingSummary;
  compact?: boolean;
}) {
  const reorderEligible = canReorderBooking(booking.status);

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">{getPortalRentalLabel(booking.booking_ref)}</div>
          <div className="mt-1 text-sm leading-6 text-slate-500">
            {booking.customer_street || "Address pending"}
            {booking.customer_city || booking.customer_zip
              ? `, ${[booking.customer_city, booking.customer_zip].filter(Boolean).join(" ")}`
              : ""}
          </div>
        </div>
        <PortalStatusBadge stage={booking.portalStage} />
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Delivery</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{formatDate(booking.delivery_date)}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pickup</div>
          <div className="mt-1 text-sm leading-6 text-slate-600">
            {booking.pickup_mode === "schedule" && booking.pickup_date
              ? formatDate(booking.pickup_date)
              : booking.pickup_mode === "request"
              ? "Requested"
              : "Not scheduled"}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next step</div>
          <div className="mt-1 text-sm leading-6 text-slate-600">{booking.nextAction}</div>
        </div>
        {!compact ? (
          <div className="rounded-2xl bg-slate-50 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Requests</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{booking.requestCount} submitted</div>
          </div>
        ) : null}
      </div>

      {booking.latestRequestSummary ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-6 text-slate-600">
          Latest request: {booking.latestRequestSummary}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/portal/rentals/${booking.id}`}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          View rental
        </Link>
        {reorderEligible ? (
          <Link
            href={`/book/address?reorderFrom=${encodeURIComponent(booking.id)}`}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Book again
          </Link>
        ) : null}
      </div>
    </div>
  );
}
