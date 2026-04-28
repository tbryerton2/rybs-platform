export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import {
  ArrowPathIcon,
  ChevronRightIcon,
  UserPlusIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { AdminSummaryCard } from "@/app/admin/_components/AdminSummaryCard";
import { AdminPageHelpLink } from "@/app/admin/_components/admin/admin-page-help-link";
import { ClickableTableRow } from "@/app/admin/analytics/zip-heatmap/clickable-table-row";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { getCustomerFacingBookingLabel } from "@/lib/identity";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SearchParams = Record<string, string | string[] | undefined>;
type CustomerListView = "all" | "new" | "repeat";

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

function getCustomerListView(value: string | undefined): CustomerListView {
  return value === "new" || value === "repeat" ? value : "all";
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

function getYearMonthInEastern(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(value);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  return `${year}-${month}`;
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = (await searchParams) ?? {};
  const selectedView = getCustomerListView(readParam(resolved, "view"));
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

  const allCustomers = ((customersData ?? []) as CustomerRow[])
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
    });

  const currentMonthKey = getYearMonthInEastern(new Date());
  const repeatCustomers = allCustomers.filter((customer) => customer.bookingCount > 1).length;
  const newCustomersThisMonth = allCustomers.filter((customer) => {
    if (!customer.created_at) return false;
    return getYearMonthInEastern(new Date(customer.created_at)) === currentMonthKey;
  }).length;
  const filteredByCard = allCustomers.filter((customer) => {
    if (selectedView === "new") {
      if (!customer.created_at) return false;
      return getYearMonthInEastern(new Date(customer.created_at)) === currentMonthKey;
    }

    if (selectedView === "repeat") {
      return customer.bookingCount > 1;
    }

    return true;
  });
  const customers = filteredByCard.filter((customer) => {
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

  function buildCustomersHref(view: CustomerListView) {
    const params = new URLSearchParams();
    if (view !== "all") params.set("view", view);
    if (query) params.set("q", query);
    const next = params.toString();
    return next ? `/admin/customers?${next}` : "/admin/customers";
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Customers"
        className="mb-6 gap-3 xl:items-center"
        actions={
          <AdminPageHelpLink
            href="/admin/docs/customer-booking-identity"
            label="View customers guide"
          />
        }
      />

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <AdminSummaryCard
          label="Total customers"
          value={allCustomers.length}
          icon={UsersIcon}
          tone="rose"
          layout="pricing"
          stretch
          href={buildCustomersHref("all")}
          active={selectedView === "all"}
        />
        <AdminSummaryCard
          label="New customers this month"
          value={newCustomersThisMonth}
          icon={UserPlusIcon}
          tone="green"
          layout="pricing"
          stretch
          href={buildCustomersHref("new")}
          active={selectedView === "new"}
        />
        <AdminSummaryCard
          label="Repeat customers"
          value={repeatCustomers}
          icon={ArrowPathIcon}
          tone="blue"
          layout="pricing"
          stretch
          href={buildCustomersHref("repeat")}
          active={selectedView === "repeat"}
        />
      </section>

      <section className="mb-8 rounded-[32px] bg-white px-6 pb-6 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-8 sm:pt-7">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Search customers</h2>

        <form className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input type="hidden" name="view" value={selectedView} />
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
              href={buildCustomersHref(selectedView)}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </section>

      <section className="overflow-hidden rounded-[32px] bg-white shadow-xl ring-1 ring-slate-200/70">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-lg font-semibold tracking-tight text-slate-900">Customer list</div>
            <div className="text-sm font-medium text-slate-500">
              {customers.length} {customers.length === 1 ? "customer" : "customers"}
              {query ? <> matching “{query}”</> : null}
              {!query && selectedView === "new" ? <> this month</> : null}
              {!query && selectedView === "repeat" ? <> with repeat bookings</> : null}
            </div>
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
                  href={buildCustomersHref(selectedView)}
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
          <div className="px-6 py-5 sm:px-8">
            <table className="w-full table-fixed border-separate border-spacing-y-3">
              <colgroup>
                <col style={{ width: "230px" }} />
                <col style={{ width: "200px" }} />
                <col style={{ width: "200px" }} />
                <col style={{ width: "270px" }} />
                <col style={{ width: "220px" }} />
                <col style={{ width: "50px" }} />
              </colgroup>

              <thead>
                <tr>
                  <th className="rounded-l-[22px] border-y border-l border-slate-200/90 bg-slate-100 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    Customer
                  </th>
                  <th className="border-y border-slate-200/90 bg-slate-100 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    Portal Status
                  </th>
                  <th className="border-y border-slate-200/90 bg-slate-100 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    Total Bookings
                  </th>
                  <th className="border-y border-slate-200/90 bg-slate-100 px-4 pl-[60px] py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    Latest booking
                  </th>
                  <th className="border-y border-slate-200/90 bg-slate-100 px-4 pr-[120px] py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    Lifetime value
                  </th>
                  <th className="rounded-r-[22px] border-y border-r border-slate-200/90 bg-slate-100 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {customers.map((customer) => (
                  <ClickableTableRow
                    key={customer.id}
                    href={`/admin/customers/${customer.id}`}
                    ariaLabel={`Open customer ${customer.name || customer.email || customer.id}`}
                    className="group cursor-pointer outline-none transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-300"
                  >
                    <td className="rounded-l-[24px] border-y border-l border-slate-200 bg-white px-5 py-[18px] align-top transition group-hover:border-slate-300 group-hover:bg-slate-50/70">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 transition group-hover:text-slate-950 group-focus-visible:text-slate-950">
                          {customer.name || "Unnamed customer"}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">{customer.email || "No email"}</div>
                        <div className="mt-1 text-sm text-slate-600">{formatPhone(customer.phone)}</div>
                      </div>
                    </td>

                    <td className="border-y border-slate-200 bg-white px-4 py-[18px] text-center align-top transition group-hover:border-slate-300 group-hover:bg-slate-50/70">
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
                    </td>

                    <td className="border-y border-slate-200 bg-white px-4 py-[18px] text-center align-top text-sm font-medium text-slate-900 transition group-hover:border-slate-300 group-hover:bg-slate-50/70">
                      {customer.bookingCount}
                    </td>

                    <td className="border-y border-slate-200 bg-white px-4 pl-[60px] py-[18px] align-top transition group-hover:border-slate-300 group-hover:bg-slate-50/70">
                      {customer.latestBooking ? (
                        <div className="min-w-0 text-sm text-slate-700">
                          <div className="font-semibold text-slate-900">
                            {getCustomerFacingBookingLabel(customer.latestBooking.booking_ref)}
                          </div>
                          <div className="mt-1">{formatDate(customer.latestBooking.delivery_date)}</div>
                          <div className="mt-1 truncate text-slate-500">
                            {customer.latestBooking.customer_street || "Address pending"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">No linked bookings</span>
                      )}
                    </td>

                    <td className="border-y border-slate-200 bg-white px-4 pr-[120px] py-[18px] text-right align-top text-sm font-semibold text-slate-900 transition group-hover:border-slate-300 group-hover:bg-slate-50/70">
                      {formatUsd(customer.lifetimeValue)}
                    </td>

                    <td className="rounded-r-[24px] border-y border-r border-slate-200 bg-white px-3 py-[18px] align-middle transition group-hover:border-slate-300 group-hover:bg-slate-50/70">
                      <div className="flex items-center justify-center">
                        <span
                          aria-hidden="true"
                          className="inline-flex items-center justify-center rounded-full p-2 text-slate-400 transition group-hover:translate-x-0.5 group-hover:scale-110 group-hover:text-slate-700 group-focus-visible:translate-x-0.5 group-focus-visible:scale-110 group-focus-visible:text-slate-700"
                        >
                          <ChevronRightIcon className="h-6 w-6" />
                        </span>
                      </div>
                    </td>
                  </ClickableTableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminPage>
  );
}
