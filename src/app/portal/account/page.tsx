import Link from "next/link";
import { requirePortalCustomer } from "@/lib/portal/auth";
import { getPortalDashboardData } from "@/lib/portal/data";
import { getPortalRentalLabel } from "@/lib/portal/rental-number";
import { canReorderBooking } from "@/lib/reorder";
import { deactivatePortalAccountAction } from "./actions";
import { PortalShell } from "../_components/portal-shell";
import { PortalSubpageHeader } from "../_components/portal-subpage-header";
import { PortalStatusBadge } from "../_components/portal-status-badge";

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

function ContactCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm leading-6 text-slate-900">{value}</div>
    </div>
  );
}

export default async function PortalAccountPage() {
  const customer = await requirePortalCustomer();
  const { locations, recentBookings } = await getPortalDashboardData(customer.id);

  return (
    <PortalShell pathname="/portal/account">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <PortalSubpageHeader
            title={customer.name || "Your portal account"}
            description="Review your contact details, saved service locations, and recent rental activity. Account settings stay read-only in v1."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ContactCard label="Full name" value={formatContactValue(customer.name)} />
            <ContactCard label="Email" value={formatContactValue(customer.email)} />
            <ContactCard label="Phone" value={formatContactValue(customer.phone)} />
            <ContactCard
              label="Default address"
              value={formatAddressLine(
                [customer.primary_street, customer.primary_city, customer.primary_zip],
                "No default address saved",
              )}
            />
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/70 px-5 py-4">
            <div className="text-sm font-semibold text-slate-900">Account access</div>
            <div className="mt-1 text-sm leading-6 text-slate-600">
              Portal account settings are read-only for now. Contact Tan Can Man if you need to
              update your default contact details.
            </div>
            <form action={deactivatePortalAccountAction} className="mt-4">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Deactivate account
              </button>
            </form>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Saved service locations</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Job sites Tan Can Man can reuse for future rentals and deliveries.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                {locations.length} total
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {locations.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-sm leading-6 text-slate-500">
                  No saved service locations yet. As you book with Tan Can Man, job sites will
                  appear here to make future rentals faster to review.
                </div>
              ) : (
                locations.map((location) => (
                  <div key={location.id} className="rounded-[24px] border border-slate-200 bg-slate-50/70 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{location.label}</div>
                        <div className="mt-1 text-sm leading-6 text-slate-500">
                          {[location.street, location.city, location.zip].filter(Boolean).join(", ")}
                        </div>
                      </div>
                      {location.is_default ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                          Default
                        </span>
                      ) : null}
                    </div>
                    {location.delivery_notes ? (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                        {location.delivery_notes}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Rental history snapshot</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    A quick view of the rentals currently linked to this portal account.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                  {recentBookings.length} linked
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Total rentals
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{recentBookings.length}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Active rentals
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">
                    {
                      recentBookings.filter((booking) =>
                        ["confirmed", "scheduled", "delivered"].includes((booking.status ?? "").toLowerCase()),
                      ).length
                    }
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Saved locations
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{locations.length}</div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {recentBookings.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm leading-6 text-slate-500">
                    No rentals are linked to this account yet. When bookings are matched to your
                    portal account, they will appear here automatically.
                  </div>
                ) : (
                  recentBookings.slice(0, 4).map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-[24px] border border-slate-200 bg-slate-50/70 px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {getPortalRentalLabel(booking.booking_ref)}
                          </div>
                          <div className="mt-1 text-sm leading-6 text-slate-500">
                            {booking.customer_street || "Address pending"}
                          </div>
                        </div>
                        <PortalStatusBadge stage={booking.portalStage} />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Delivery
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {formatDate(booking.delivery_date)}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Latest activity
                          </div>
                          <div className="mt-1 text-sm leading-6 text-slate-600">
                            {booking.latestRequestSummary || booking.nextAction}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          href={`/portal/rentals/${booking.id}`}
                          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          View rental
                        </Link>
                        {canReorderBooking(booking.status) ? (
                          <Link
                            href={`/book/address?reorderFrom=${encodeURIComponent(booking.id)}`}
                            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                          >
                            Book again
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </PortalShell>
  );
}
