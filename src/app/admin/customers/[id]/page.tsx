export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PageProps = {
  params: Promise<{ id: string }>;
};

type BookingRow = {
  id: string;
  created_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string | null;
  pickup_date: string | null;
  status:
    | "confirmed"
    | "scheduled"
    | "delivered"
    | "picked_up"
    | "cancelled"
    | string
    | null;
  total_price_cents: number | null;
  notes: string | null;
};

const ACTIVE_STATUSES = new Set(["confirmed", "scheduled", "delivered"]);

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMoney(value: number | null) {
  if (value == null) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function statusPillClass(status: string | null) {
  switch (status) {
    case "confirmed":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
    case "scheduled":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "delivered":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "picked_up":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
    case "cancelled":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
}

function prettyStatus(status: string | null) {
  if (!status) return "Unknown";
  return status.replaceAll("_", " ");
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return null;
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const identifier = decodeURIComponent(id);
  const isEmail = identifier.includes("@");

  const baseQuery = supabaseAdmin
    .from("bookings")
    .select(`
      id,
      created_at,
      customer_name,
      customer_email,
      customer_phone,
      customer_street,
      customer_city,
      customer_zip,
      delivery_date,
      pickup_date,
      status,
      total_price_cents,
      notes
    `)
    .order("delivery_date", { ascending: false, nullsFirst: false });

  const { data, error } = isEmail
    ? await baseQuery.eq("customer_email", identifier)
    : await baseQuery.eq("customer_phone", identifier);

  if (error) {
    throw new Error(error.message);
  }

  const bookings = (data ?? []) as BookingRow[];

  if (bookings.length === 0) {
    notFound();
  }

  const latest = bookings[0];

  const customerName =
    firstNonEmpty(
      ...bookings.map((b) => b.customer_name),
    ) ?? "Unnamed customer";

  const customerEmail = firstNonEmpty(
    ...bookings.map((b) => b.customer_email),
  );

  const customerPhone = firstNonEmpty(
    ...bookings.map((b) => b.customer_phone),
  );

  const primaryCity = firstNonEmpty(
    ...bookings.map((b) => b.customer_city),
  );

  const primaryZip = firstNonEmpty(
    ...bookings.map((b) => b.customer_zip),
  );

  const totalBookings = bookings.length;
  const activeBookings = bookings.filter((b) =>
    ACTIVE_STATUSES.has(b.status ?? ""),
  );

  const activeJob =
    activeBookings.find((b) => b.status === "delivered") ??
    activeBookings.find((b) => b.status === "scheduled") ??
    activeBookings.find((b) => b.status === "confirmed") ??
    null;

  const firstBooking = [...bookings]
    .sort((a, b) => {
      const aDate = new Date(a.created_at ?? 0).getTime();
      const bDate = new Date(b.created_at ?? 0).getTime();
      return aDate - bDate;
    })[0];

  const primaryLocation =
    primaryCity || primaryZip
      ? [primaryCity, primaryZip].filter(Boolean).join(" ")
      : "—";

  const internalNotes = firstNonEmpty(
    ...bookings.map((b) => b.notes),
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-500">
            Customers
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            {customerName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
            <span>{customerPhone || "No phone"}</span>
            <span>{customerEmail || "No email"}</span>
            <span>{primaryLocation}</span>
          </div>
        </div>

        <Link
          href="/admin/customers"
          className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Back to customers
        </Link>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total bookings
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              {totalBookings}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Active bookings
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              {activeBookings.length}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              First booking
            </div>
            <div className="mt-2 text-base font-semibold text-slate-900">
              {formatDate(firstBooking?.created_at ?? null)}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Customer ID
            </div>
            <div className="mt-2 truncate text-sm font-medium text-slate-900">
              {identifier}
            </div>
          </div>
        </div>
      </section>

      {activeJob ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Active job</h2>
          </div>

          <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Delivery date
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {formatDate(activeJob.delivery_date)}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Pickup date
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {formatDate(activeJob.pickup_date)}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </div>
                  <div className="mt-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusPillClass(
                        activeJob.status,
                      )}`}
                    >
                      {prettyStatus(activeJob.status)}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Location
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {[activeJob.customer_city, activeJob.customer_zip]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                <Link
                  href={`/admin/bookings/${activeJob.id}`}
                  className="inline-flex h-11 items-center rounded-2xl bg-[#F97316] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
                >
                  View booking
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Booking history
          </h2>
          <div className="text-sm text-slate-500">
            {bookings.length} total
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50/80">
                <tr className="text-left">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Delivery date
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    City / ZIP
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Price
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {formatDate(booking.delivery_date)}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {[booking.customer_city, booking.customer_zip]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusPillClass(
                          booking.status,
                        )}`}
                      >
                        {prettyStatus(booking.status)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {formatMoney(
                        booking.total_price_cents != null
                          ? booking.total_price_cents / 100
                          : null
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/bookings/${booking.id}`}
                        className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        View booking
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Customer notes
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Internal notes and preferences for future jobs.
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          {internalNotes ? (
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {internalNotes}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              No customer-level notes yet. For V1, this can remain read-only or
              be replaced with a simple editable field later.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}