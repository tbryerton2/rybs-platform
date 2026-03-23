export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { AdminPageHelpLink } from "@/app/admin/_components/admin/admin-page-help-link";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { ContextHelpCard } from "@/app/admin/_components/admin/context-help-card";
import { getCustomerFacingBookingLabel } from "@/lib/identity";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SearchParams = Record<string, string | string[] | undefined>;

type CustomerRow = {
  id: string;
  created_at: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  primary_city: string | null;
  primary_zip: string | null;
  portal_status: string | null;
  deactivated_at: string | null;
};

type BookingSummaryRow = {
  id: string;
  booking_ref: string | null;
  customer_id: string | null;
  booking_contact_name: string | null;
  booking_contact_email: string | null;
  booking_contact_phone: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string | null;
  created_at: string | null;
  status: string | null;
  total_price_cents: number | null;
};

function readParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function formatPhone(phone: string | null) {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatUsd(cents: number | null) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function includesTerm(value: string | null | undefined, search: string) {
  return (value ?? "").toLowerCase().includes(search);
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = (await searchParams) ?? {};
  const query = (readParam(resolved, "q") ?? "").trim().toLowerCase();

  const [{ data: customersData, error: customersError }, { data: bookingsData, error: bookingsError }] =
    await Promise.all([
      supabaseAdmin
        .from("customers")
        .select("id, created_at, name, email, phone, primary_city, primary_zip, portal_status, deactivated_at")
        .order("updated_at", { ascending: false }),
      supabaseAdmin
        .from("bookings")
        .select("id, booking_ref, customer_id, booking_contact_name, booking_contact_email, booking_contact_phone, customer_street, customer_city, customer_zip, delivery_date, created_at, status, total_price_cents")
        .not("customer_id", "is", null),
    ]);

  if (customersError) throw new Error(customersError.message);
  if (bookingsError) throw new Error(bookingsError.message);

  const bookings = (bookingsData ?? []) as BookingSummaryRow[];
  const bookingsByCustomer = new Map<string, BookingSummaryRow[]>();
  for (const booking of bookings) {
    if (!booking.customer_id) continue;
    const existing = bookingsByCustomer.get(booking.customer_id) ?? [];
    existing.push(booking);
    bookingsByCustomer.set(booking.customer_id, existing);
  }

  const customers = ((customersData ?? []) as CustomerRow[])
    .map((customer) => {
      const linkedBookings = (bookingsByCustomer.get(customer.id) ?? []).sort((left, right) =>
        new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime(),
      );
      const activeBookingCount = linkedBookings.filter((booking) =>
        ["confirmed", "scheduled", "delivered"].includes((booking.status ?? "").toLowerCase()),
      ).length;
      const lifetimeValue = linkedBookings.reduce((sum, booking) => sum + (booking.total_price_cents ?? 0), 0);
      const latestBooking = linkedBookings[0] ?? null;

      return {
        ...customer,
        linkedBookings,
        activeBookingCount,
        bookingCount: linkedBookings.length,
        latestBooking,
        lifetimeValue,
      };
    })
    .filter((customer) => {
      if (!query) return true;

      return (
        includesTerm(customer.id, query) ||
        includesTerm(customer.name, query) ||
        includesTerm(customer.email, query) ||
        includesTerm(customer.phone, query) ||
        includesTerm(customer.primary_city, query) ||
        includesTerm(customer.primary_zip, query) ||
        customer.linkedBookings.some((booking) =>
          [
            booking.id,
            booking.booking_ref,
            booking.booking_contact_name,
            booking.booking_contact_email,
            booking.booking_contact_phone,
            booking.customer_street,
            booking.customer_city,
            booking.customer_zip,
          ].some((value) => includesTerm(value, query)),
        )
      );
    });

  const repeatCustomers = customers.filter((customer) => customer.bookingCount > 1).length;
  const totalBookings = customers.reduce((sum, customer) => sum + customer.bookingCount, 0);

  return (
    <AdminPage>
      <AdminPageHeader
        title="Customers"
        eyebrow="Customers"
        description="Search customers by current account details and quickly review linked booking history."
        actions={
          <AdminPageHelpLink
            href="/admin/docs/customer-booking-identity"
            label="View customers guide"
          />
        }
      />

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        {[
          { label: "Customers", value: customers.length, hint: "Customer/account records" },
          { label: "Linked bookings", value: totalBookings, hint: "Bookings attached to customer UUIDs" },
          { label: "Repeat customers", value: repeatCustomers, hint: "Customers with more than one booking" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
            <div className="text-sm font-medium text-slate-500">{stat.label}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{stat.value}</div>
            <div className="mt-2 text-xs text-slate-500">{stat.hint}</div>
          </div>
        ))}
      </section>

      <section className="mb-8 rounded-[32px] bg-white px-6 pb-6 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-8 sm:pt-7">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Search customers</h2>
        <p className="mt-1 text-sm text-slate-500">
          Find a customer by current email, name, or phone.
        </p>

        <form className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            id="q"
            name="q"
            defaultValue={query}
            placeholder="Email, name, or phone"
            className="h-12 flex-1 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#F97316]"
          />
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Search
          </button>
          {query ? (
            <Link
              href="/admin/customers"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Clear
            </Link>
          ) : null}
        </form>

        <div className="mt-4">
          <ContextHelpCard
            title="Search by current email, name, or phone."
            body="Linked bookings may still show older booking contact details."
            emphasis="subtle"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-[32px] bg-white shadow-xl ring-1 ring-slate-200/70">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <div className="text-lg font-semibold tracking-tight text-slate-900">Customer list</div>
          <div className="mt-1 text-sm text-slate-500">
            {customers.length} {customers.length === 1 ? "customer" : "customers"}
            {query ? <> matching “{query}”</> : null}
          </div>
        </div>

        {customers.length === 0 ? (
          <div className="px-6 py-16">
            <div className="mx-auto max-w-xl rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
              <div className="text-lg font-semibold text-slate-900">No customers found for this search</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Try the current email, customer name, or phone number. If you are looking from a booking, older booking contact details may differ from the current account profile.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/admin/customers"
                  className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Clear search
                </Link>
                <Link
                  href="/admin/docs/customer-booking-identity"
                  className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Learn more
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed">
              <thead className="bg-slate-50/80">
                <tr className="text-left">
                  <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-8">Customer</th>
                  <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Portal</th>
                  <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Latest booking</th>
                  <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Lifetime value</th>
                  <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((customer) => (
                  <tr key={customer.id} className="transition hover:bg-slate-50/70">
                    <td className="px-6 py-4 align-top sm:px-8">
                      <div className="font-semibold text-slate-900">{customer.name || "Unnamed customer"}</div>
                      <div className="mt-1 text-sm text-slate-600">{customer.email || "No email"}</div>
                      <div className="mt-1 text-sm text-slate-600">{formatPhone(customer.phone)}</div>
                      <div className="mt-2 text-xs text-slate-500">UUID: <span className="font-mono">{customer.id}</span></div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="space-y-2">
                        <span
                          className={[
                            "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
                            customer.portal_status === "deactivated"
                              ? "bg-rose-50 text-rose-700 ring-rose-200"
                              : customer.portal_status === "active"
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-slate-100 text-slate-700 ring-slate-200",
                          ].join(" ")}
                        >
                          {customer.portal_status ?? "invited"}
                        </span>
                        <div className="text-sm text-slate-600">
                          {customer.bookingCount} booking{customer.bookingCount === 1 ? "" : "s"} • {customer.activeBookingCount} active
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      {customer.latestBooking ? (
                        <div className="text-sm text-slate-700">
                          <div className="font-semibold text-slate-900">
                            {getCustomerFacingBookingLabel(customer.latestBooking.booking_ref)}
                          </div>
                          <div className="mt-1">{formatDate(customer.latestBooking.delivery_date)}</div>
                          <div className="mt-1 text-slate-500">
                            {customer.latestBooking.customer_street || "Address pending"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">No linked bookings</span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top text-sm font-semibold text-slate-900">
                      {formatUsd(customer.lifetimeValue)}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        View customer
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminPage>
  );
}
