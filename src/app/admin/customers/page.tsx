// src/app/admin/customers/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatUsd } from "@/lib/money";

type SearchParams = Record<string, string | string[] | undefined>;

type CustomerRow = {
  id: string;
  identifier: string;
  identifier_type: "email" | "phone";
  name: string | null;
  email: string | null;
  phone: string | null;
  primary_city: string | null;
  primary_zip: string | null;
  booking_count: number;
  active_booking_count: number;
  first_booking_at: string | null;
  last_booking_at: string | null;
  lifetime_revenue: number | null;
};

function sp(obj: SearchParams, key: string) {
  const value = obj[key];
  return Array.isArray(value) ? value[0] : value;
}

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}


function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
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

function getLocationLabel(city: string | null, zip: string | null) {
  const parts = [clean(city), clean(zip)].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}


async function getCustomers(search: string) {
  let query = supabaseAdmin
    .from("customer_rollups")
    .select(
      `
      id,
      identifier,
      identifier_type,
      name,
      email,
      phone,
      primary_city,
      primary_zip,
      booking_count,
      active_booking_count,
      first_booking_at,
      last_booking_at,
      lifetime_revenue
    `
    )
    .order("last_booking_at", { ascending: false, nullsFirst: false });

  const term = search.trim();

  if (term) {
    query = query.or(
      [
        `name.ilike.%${term}%`,
        `email.ilike.%${term}%`,
        `phone.ilike.%${term}%`,
        `primary_city.ilike.%${term}%`,
        `primary_zip.ilike.%${term}%`,
      ].join(",")
    );
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return (data ?? []) as CustomerRow[];
}

async function getStats() {
  const { data, error } = await supabaseAdmin
    .from("customer_rollups")
    .select("id, booking_count");

  if (error) throw new Error(error.message);

  const rows =
    (data as
      | Array<{
          id: string;
          booking_count: number | null;
        }>
      | null) ?? [];

  return {
    totalUniqueCustomers: rows.length,
    totalBookings: rows.reduce((sum, row) => sum + (row.booking_count ?? 0), 0),
    repeatCustomers: rows.filter((row) => (row.booking_count ?? 0) > 1).length,
  };
}

function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: string;
  hint: string;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </div>
          <div className="mt-2 text-xs text-slate-500">{hint}</div>
        </div>

        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F97316]/10 text-lg text-[#F97316]">
          {icon}
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5 text-slate-400"
    >
      <path
        d="M14.1667 14.1667L17.5 17.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle
        cx="8.75"
        cy="8.75"
        r="5.83333"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const search = sp(resolvedSearchParams, "q")?.trim() ?? "";

  const [customers, stats] = await Promise.all([
    getCustomers(search),
    getStats(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 pt-10 pb-16">
      <div className="mb-8">
        <div className="inline-flex items-center rounded-full bg-[#F97316]/10 px-3 py-1 text-xs font-semibold text-[#F97316]">
          Admin
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Customers
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          View and search customers who have booked dumpster rentals.
        </p>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total unique customers"
          value={stats.totalUniqueCustomers}
          icon="👥"
          hint="Derived from booking contact records"
        />
        <StatCard
          label="Total bookings"
          value={stats.totalBookings}
          icon="🧾"
          hint="All customer jobs currently on record"
        />
        <StatCard
          label="Repeat customers"
          value={stats.repeatCustomers}
          icon="🔁"
          hint="Customers with more than one booking"
        />
      </section>

      <section className="mb-8 rounded-[32px] bg-white px-6 pb-6 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-8 sm:pt-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Search customers
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Search by customer name, phone, email, or ZIP code.
            </p>
          </div>
        </div>

        <form className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
              <SearchIcon />
            </span>

            <input
              id="q"
              name="q"
              defaultValue={search}
              placeholder="Search by name, phone, email, or ZIP"
              className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#F97316]"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              Search
            </button>

            {search ? (
              <Link
                href="/admin/customers"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Clear
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-[32px] bg-white shadow-xl ring-1 ring-slate-200/70">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                Customer list
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                A simple CRM view built from existing booking records.
              </p>
            </div>

            <div className="text-sm text-slate-500">
              <span className="font-semibold text-slate-900">{customers.length}</span>{" "}
              {customers.length === 1 ? "customer" : "customers"}
              {search ? (
                <>
                  {" "}
                  matching{" "}
                  <span className="font-medium text-slate-700">“{search}”</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {customers.length === 0 ? (
          <div className="px-6 py-16 text-center sm:px-8">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
              👤
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              No customers found
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Try a different customer name, phone number, email address, or ZIP code.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed">
              <thead className="bg-slate-50/80">
                <tr className="text-left">
                  <th className="w-[220px] px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-8">
                    Customer
                  </th>
                  <th className="w-[260px] px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Contact
                  </th>
                  <th className="w-[190px] px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Location
                  </th>
                  <th className="w-[80px] px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Bookings
                  </th>
                  <th className="w-[80px] px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Open jobs
                  </th>
                  <th className="w-[110px] px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Most recent
                  </th>
                  <th className="w-[110px] px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Lifetime value
                  </th>
                  <th className="w-[120px] px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {customers.map((customer) => {
                  const isRepeat = customer.booking_count > 1;

                  return (
                    <tr
                      key={customer.id}
                      className="border-t border-slate-200 transition hover:bg-slate-50/70"
                    >
                      <td className="px-6 py-4 align-top sm:px-8">
                        <div className="min-w-[180px]">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/admin/customers/${encodeURIComponent(customer.identifier)}`}
                                  className="font-semibold text-slate-900 hover:text-[#F97316]"
                                >
                                  {customer.name}
                                </Link>

                              {isRepeat ? (
                                <span className="inline-flex items-center rounded-full bg-[#F97316]/10 px-2.5 py-1 text-[11px] font-semibold text-[#F97316]">
                                    Repeat customer · {customer.booking_count} bookings
                                </span>
                                ) : null}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                                {isRepeat ? "Repeat customer record derived from bookings" : "Customer record derived from bookings"}
                            </div>
                          </div>
                        </div>
                      </td>

                        <td className="px-6 py-4 align-top">
                            <div className="min-w-[220px] space-y-2">
                                <div>
                                <div className="text-sm text-slate-700">
                                    <span className="font-medium text-slate-900">Phone:</span>{" "}
                                    {formatPhone(customer.phone)}
                                </div>

                                {customer.phone ? (
                                    <a
                                    href={`tel:${customer.phone.replace(/\D/g, "")}`}
                                    className="mt-1 inline-flex text-xs font-semibold text-[#F97316] hover:underline"
                                    >
                                    Call customer
                                    </a>
                                ) : null}
                                </div>

                                <div className="break-all text-sm text-slate-700">
                                <span className="font-medium text-slate-900">Email:</span>{" "}
                                {customer.email || "—"}
                                </div>
                            </div>
                        </td>

                      <td className="px-6 py-4 align-top">
                        <div className="min-w-[140px] text-sm text-slate-700">
                          {getLocationLabel(customer.primary_city, customer.primary_zip)}
                        </div>
                      </td>

                        <td className="px-3 py-4 align-top text-center">
                          <div
                            className={
                              isRepeat
                                ? "inline-flex h-10 w-[56px] items-center justify-center rounded-2xl bg-[#F97316]/10 text-sm font-semibold text-[#F97316]"
                                : "inline-flex h-10 w-[56px] items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-900"
                            }
                          >
                            {customer.booking_count}
                          </div>
                        </td>

                        <td className="px-3 py-4 align-top text-center">
                          <div
                            className={
                              customer.active_booking_count > 0
                                ? "inline-flex h-10 w-[56px] items-center justify-center rounded-2xl bg-emerald-50 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200"
                                : "inline-flex h-10 w-[56px] items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-500"
                            }
                          >
                            {customer.active_booking_count}
                          </div>
                        </td>

                      <td className="px-3 py-4 align-top text-center text-sm text-slate-700">
                        <div className="text-sm text-slate-700">
                          {formatDate(customer.last_booking_at)}
                        </div>
                      </td>

                      <td className="px-3 py-4 align-top text-center text-sm font-semibold text-slate-900">
                        <div className="text-sm font-semibold text-slate-900">
                          {formatUsd(customer.lifetime_revenue)}
                        </div>
                      </td>

                      <td className="px-3 py-4 align-top text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Link
                            href={`/admin/customers/${encodeURIComponent(customer.identifier)}`}
                            className="inline-flex h-10 min-w-[120px] items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 whitespace-nowrap transition hover:bg-slate-50"
                          >
                            View
                          </Link>

                          <Link
                            href={`/book?customer=${encodeURIComponent(customer.identifier)}`}
                            className="inline-flex h-10 min-w-[120px] items-center justify-center rounded-2xl bg-[#F97316] px-4 text-sm font-semibold text-white whitespace-nowrap transition hover:bg-orange-600"
                          >
                            New booking
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
