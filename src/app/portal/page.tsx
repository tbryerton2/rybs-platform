import Link from "next/link";
import { requirePortalCustomer } from "@/lib/portal/auth";
import { getPortalDashboardData } from "@/lib/portal/data";
import { getPortalRentalLabel } from "@/lib/portal/rental-number";
import { formatUsdFromCents } from "@/lib/money";
import { PortalEmptyState } from "./_components/portal-empty-state";
import { PortalBookingCard } from "./_components/portal-booking-card";
import { PortalShell } from "./_components/portal-shell";
import { PortalStatusBadge } from "./_components/portal-status-badge";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00`));
}

function formatContactValue(value: string | null, fallback = "Not on file") {
  return value?.trim() || fallback;
}

function formatAddressLine(parts: Array<string | null | undefined>, fallback: string) {
  const value = parts.filter(Boolean).join(", ");
  return value || fallback;
}

function formatServiceArea(town: string | null, county: string | null) {
  return [town, county].filter(Boolean).join(", ");
}

function QuickAction({
  title,
  description,
  href,
  ctaLabel,
  eligible,
  reason,
}: {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  eligible: boolean;
  reason: string | null;
}) {
  return (
    <div
      className={[
        "rounded-[24px] border px-4 py-4",
        eligible ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50/70",
      ].join(" ")}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Manage rental</div>
      <h4 className="mt-2 text-sm font-semibold text-slate-900">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      <div className="mt-4">
        {eligible ? (
          <Link
            href={href}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {ctaLabel}
          </Link>
        ) : (
          <div className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-500 ring-1 ring-slate-200">
            {reason}
          </div>
        )}
      </div>
    </div>
  );
}

function RentalMetaCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default async function PortalHomePage() {
  const customer = await requirePortalCustomer();
  const { activeRental, recentBookings, locations } = await getPortalDashboardData(customer.id);

  return (
    <PortalShell pathname="/portal">
      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="space-y-6">
          <div className="rounded-[32px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-sm">
            <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-200 ring-1 ring-white/10">
              Portal home
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              {customer.name || "Your Tan Can Man portal"}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Track your rental, see what happens next, and request service updates without leaving
              the portal.
            </p>
          </div>

          {activeRental ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Active rental
                </div>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    {getPortalRentalLabel(activeRental.id)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {activeRental.customer_street || "Address pending"}
                    {activeRental.customer_city || activeRental.customer_zip
                      ? `, ${[activeRental.customer_city, activeRental.customer_zip].filter(Boolean).join(" ")}`
                      : ""}
                  </p>
                </div>

                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <PortalStatusBadge stage={activeRental.portalStage} />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                    {activeRental.requestCount} request{activeRental.requestCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div
                className={`mt-6 grid gap-4 sm:grid-cols-2 ${
                  formatServiceArea(activeRental.service_town, activeRental.service_county)
                    ? "xl:grid-cols-4"
                    : "xl:grid-cols-3"
                }`}
              >
                <RentalMetaCard label="Delivery date" value={formatDate(activeRental.delivery_date)} />
                <RentalMetaCard label="Pickup date" value={formatDate(activeRental.pickup_date)} />
                <RentalMetaCard
                  label="Rental total"
                  value={formatUsdFromCents(activeRental.total_price_cents)}
                />
                {formatServiceArea(activeRental.service_town, activeRental.service_county) ? (
                  <RentalMetaCard
                    label="Service area"
                    value={formatServiceArea(activeRental.service_town, activeRental.service_county)}
                  />
                ) : null}
              </div>

              <div className="mt-6 rounded-3xl border border-orange-100 bg-orange-50/70 px-5 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
                  Next important action
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{activeRental.nextAction}</div>
                {activeRental.latestRequestSummary ? (
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    Latest request: {activeRental.latestRequestSummary}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/portal/rentals/${activeRental.id}`}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  View rental
                </Link>
                <Link
                  href="/portal/account"
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  View account
                </Link>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-3">
                <QuickAction
                  title="Request pickup"
                  description="Finished with your dumpster? Let us know and we’ll review pickup timing."
                  href={`/portal/rentals/${activeRental.id}/pickup-request`}
                  ctaLabel="Start pickup request"
                  eligible={activeRental.pickupEligibility.eligible}
                  reason={activeRental.pickupEligibility.reason}
                />
                <QuickAction
                  title="Request more time"
                  description="Need to keep the dumpster longer? Send a request for review."
                  href={`/portal/rentals/${activeRental.id}/extension-request`}
                  ctaLabel="Request more time"
                  eligible={activeRental.extensionEligibility.eligible}
                  reason={activeRental.extensionEligibility.reason}
                />
                <QuickAction
                  title="Report an issue"
                  description="Tell us what is wrong and our team will follow up."
                  href={`/portal/rentals/${activeRental.id}/issue-report`}
                  ctaLabel="Report an issue"
                  eligible={activeRental.issueReportEligibility.eligible}
                  reason={activeRental.issueReportEligibility.reason}
                />
              </div>
            </div>
          ) : (
            <PortalEmptyState />
          )}

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Recent bookings</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Review your recent rentals, current job status, and the latest activity tied to
                  each job.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                  {recentBookings.length} shown
                </span>
                <Link href="/portal/rentals" className="text-sm font-semibold text-slate-500 hover:text-slate-900">
                  View all bookings
                </Link>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {recentBookings.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm leading-6 text-slate-500">
                  No rentals are linked to this portal account yet. Once bookings are connected,
                  your rental history and status updates will appear here.
                </div>
              ) : (
                recentBookings.map((booking) => <PortalBookingCard key={booking.id} booking={booking} compact />)
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Account summary</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Your main contact details and default job-site information.
                </p>
              </div>
              <Link href="/portal/account" className="text-sm font-semibold text-slate-500 hover:text-slate-900">
                Open account
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {formatContactValue(customer.email)}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {formatContactValue(customer.phone)}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Default address
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-900">
                  {formatAddressLine(
                    [customer.primary_street, customer.primary_city, customer.primary_zip],
                    "No default address saved",
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Saved locations</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Job sites we can reuse to speed up future rentals.
                </p>
              </div>
              <Link href="/portal/account" className="text-sm font-semibold text-slate-500 hover:text-slate-900">
                View all
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {locations.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm leading-6 text-slate-500">
                  We will save job sites here as you book with Tan Can Man, so future rentals are
                  faster to review.
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
                    <div className="mt-2 text-sm leading-6 text-slate-500">
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
