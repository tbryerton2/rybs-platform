import Link from "next/link";
import { requirePortalCustomer } from "@/lib/portal/auth";
import { getPortalDashboardData } from "@/lib/portal/data";
import { formatUsdFromCents } from "@/lib/money";
import { PortalShell } from "./_components/portal-shell";
import { PortalStatusBadge } from "./_components/portal-status-badge";
import { PortalEmptyState } from "./_components/portal-empty-state";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00`));
}

export default async function PortalHomePage() {
  const customer = await requirePortalCustomer();
  const { activeRental, recentBookings, locations } = await getPortalDashboardData(customer.id);

  return (
    <PortalShell pathname="/portal">
      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="space-y-6">
          <div className="rounded-[28px] bg-gradient-to-br from-slate-950 to-slate-800 px-6 py-6 text-white">
            <div className="text-sm uppercase tracking-[0.2em] text-orange-200">Welcome back</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              {customer.name || "Your Tan Can Man portal"}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Track your rental, see what happens next, and request service updates without
              leaving this page.
            </p>
          </div>

          {activeRental ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Active rental
                  </div>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    Dumpster rental #{activeRental.id.slice(0, 8)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {activeRental.customer_street || "Address pending"}
                    {activeRental.customer_city || activeRental.customer_zip
                      ? `, ${[activeRental.customer_city, activeRental.customer_zip].filter(Boolean).join(" ")}`
                      : ""}
                  </p>
                </div>

                <PortalStatusBadge stage={activeRental.portalStage} />
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Delivery date
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {formatDate(activeRental.delivery_date)}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Pickup date
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {formatDate(activeRental.pickup_date)}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Current balance
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {formatUsdFromCents(activeRental.total_price_cents)}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-orange-100 bg-orange-50/70 px-5 py-4">
                <div className="text-sm font-semibold text-slate-900">Next important action</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{activeRental.nextAction}</div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/portal/rentals/${activeRental.id}`}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  View rental
                </Link>
                <Link
                  href={`/portal/rentals/${activeRental.id}/pickup-request`}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Request pickup
                </Link>
              </div>
            </div>
          ) : (
            <PortalEmptyState />
          )}

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Recent bookings</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Your recent rental history and current job status.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {recentBookings.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  No rentals are linked to this portal account yet.
                </div>
              ) : (
                recentBookings.map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/portal/rentals/${booking.id}`}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        Rental #{booking.id.slice(0, 8)}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {booking.customer_street || "Address pending"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-slate-500">{formatDate(booking.delivery_date)}</div>
                      <PortalStatusBadge stage={booking.portalStage} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Account summary</h3>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-slate-500">Email</dt>
                <dd className="mt-1 text-slate-900">{customer.email || "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Phone</dt>
                <dd className="mt-1 text-slate-900">{customer.phone || "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Default address</dt>
                <dd className="mt-1 text-slate-900">
                  {[customer.primary_street, customer.primary_city, customer.primary_zip]
                    .filter(Boolean)
                    .join(", ") || "No default address saved"}
                </dd>
              </div>
            </dl>
            <Link
              href="/portal/account"
              className="mt-6 inline-flex rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Account settings
            </Link>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-900">Saved locations</h3>
              <Link href="/portal/account" className="text-sm font-medium text-slate-500 hover:text-slate-900">
                View all
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {locations.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  We will save job sites here as you book with Tan Can Man.
                </div>
              ) : (
                locations.slice(0, 3).map((location) => (
                  <div key={location.id} className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">{location.label}</div>
                      {location.is_default ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                          Default
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      {[location.street, location.city, location.zip].filter(Boolean).join(", ")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </PortalShell>
  );
}
