import { ChevronRightIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { getCustomerFacingBookingLabel } from "@/lib/identity";
import { formatCustomerName } from "@/lib/customer-name";

type BookingListRowProps = {
  booking: {
    id: string;
    booking_ref: string | null;
    created_at: string | null;
    customer_first_name: string | null;
    customer_last_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    customer_street: string | null;
    customer_city: string | null;
    customer_zip: string | null;
    delivery_date: string | null;
    pickup_date: string | null;
    status: string | null;
  };
};

function formatDateLabel(value: string | null) {
  if (!value) return "—";

  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(y, m - 1, d));
}

function formatDateTimeLabel(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function formatPhoneNumber(value: string | null) {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");
  const normalized =
    digits.length === 10 ? digits : digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : null;

  if (!normalized) return value;

  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

function statusPillClass(status: string | null) {
  const value = (status ?? "").toLowerCase();

  if (value === "confirmed") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (value === "scheduled") return "bg-indigo-50 text-indigo-700 ring-indigo-200";
  if (value === "delivered") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (value === "picked_up") return "bg-slate-100 text-slate-700 ring-slate-200";
  if (value === "cancelled") return "bg-rose-50 text-rose-700 ring-rose-200";

  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function pillBase(classes: string) {
  return `inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${classes}`;
}

export function BookingListRow({ booking }: BookingListRowProps) {
  return (
    <Link
      href={`/admin/bookings/${encodeURIComponent(booking.id)}`}
      aria-label={`Open booking ${getCustomerFacingBookingLabel(booking.booking_ref)}`}
      className="group block rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50/70 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2"
    >
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)_minmax(260px,0.86fr)_minmax(240px,0.95fr)_56px]">
        <div className="space-y-3">
          <div className="text-base font-semibold tracking-tight text-slate-900 transition group-hover:text-slate-950 group-focus-visible:text-slate-950">
            {getCustomerFacingBookingLabel(booking.booking_ref)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={pillBase(statusPillClass(booking.status))}>
              {(booking.status ?? "unknown").replace(/_/g, " ")}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-sm font-semibold text-slate-900">
            {formatCustomerName(booking.customer_first_name, booking.customer_last_name, "No customer name")}
          </div>
          <div className="text-sm text-slate-600">{booking.customer_email || "No email on file"}</div>
          <div className="text-sm text-slate-600">{formatPhoneNumber(booking.customer_phone) || "No phone on file"}</div>
        </div>

        <div className="min-w-0">
          <div className="min-w-0 text-sm font-semibold leading-6 text-slate-900">
            {booking.customer_street || "No street on file"}
          </div>
          <div className="text-sm text-slate-600">
            {[booking.customer_city, booking.customer_zip].filter(Boolean).join(", ") || "No city or ZIP on file"}
          </div>
        </div>

        <dl className="space-y-2 text-sm text-slate-600">
          <div className="flex items-baseline gap-2">
            <dt className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-slate-400">Created:</dt>
            <dd className="min-w-0 font-medium text-slate-900">{formatDateTimeLabel(booking.created_at)}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-slate-400">Delivery:</dt>
            <dd className="min-w-0 font-medium text-slate-900">{formatDateLabel(booking.delivery_date)}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-slate-400">Pickup:</dt>
            <dd className="min-w-0 font-medium text-slate-900">{formatDateLabel(booking.pickup_date)}</dd>
          </div>
        </dl>

        <div className="hidden h-full items-center justify-end lg:flex">
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center rounded-full p-2 text-slate-400 transition group-hover:translate-x-0.5 group-hover:scale-110 group-hover:text-slate-700 group-focus-visible:translate-x-0.5 group-focus-visible:scale-110 group-focus-visible:text-slate-700"
          >
            <ChevronRightIcon className="h-6 w-6" />
          </span>
        </div>
      </div>
    </Link>
  );
}
