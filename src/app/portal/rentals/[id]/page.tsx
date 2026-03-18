import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getActionTypeLabel,
  getCustomerVisibleStatusLabel,
  getCustomerVisibleStatusTone,
} from "@/lib/rental-action-requests";
import { requirePortalCustomer } from "@/lib/portal/auth";
import { getPortalRental, getPortalRequestSummary } from "@/lib/portal/data";
import { formatUsdFromCents } from "@/lib/money";
import { PortalShell } from "../../_components/portal-shell";
import { PortalStatusBadge } from "../../_components/portal-status-badge";
import { RentalTimeline } from "../../_components/rental-timeline";

type SearchParams = Record<string, string | string[] | undefined>;

function readValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function getSubmissionMessage(searchParams: SearchParams) {
  const submitted = readValue(searchParams, "submitted");
  if (submitted === "pickup") {
    return "Your pickup request was submitted. We will confirm timing soon.";
  }
  return null;
}

function ActionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

export default async function PortalRentalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const customer = await requirePortalCustomer();
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const rental = await getPortalRental(customer.id, id);

  if (!rental) notFound();

  const { booking, requests, pickupEligibility } = rental;
  const submissionMessage = getSubmissionMessage(resolvedSearchParams);

  return (
    <PortalShell pathname={`/portal/rentals/${booking.id}`}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/portal" className="text-sm font-medium text-slate-500 hover:text-slate-900">
              ← Back to dashboard
            </Link>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              Rental #{booking.id.slice(0, 8)}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {booking.customer_street || "Address pending"}
              {booking.customer_city || booking.customer_zip
                ? `, ${[booking.customer_city, booking.customer_zip].filter(Boolean).join(" ")}`
                : ""}
            </p>
          </div>

          <PortalStatusBadge stage={booking.portalStage} />
        </div>

        {submissionMessage ? (
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
            {submissionMessage}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Delivery date
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {formatDate(booking.delivery_date)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Pickup date
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {formatDate(booking.pickup_date)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Rental total
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {formatUsdFromCents(booking.total_price_cents)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Service area
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {[booking.service_town, booking.service_county].filter(Boolean).join(", ") || "—"}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-orange-100 bg-orange-50/70 px-5 py-4">
                <div className="text-sm font-semibold text-slate-900">What happens next</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{booking.nextAction}</div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Rental timeline</h3>
              <p className="mt-1 text-sm text-slate-500">
                A simple view of where your rental stands and what is coming next.
              </p>
              <div className="mt-6">
                <RentalTimeline stage={booking.portalStage} />
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Notes and instructions</h3>
              <div className="mt-3 text-sm leading-6 text-slate-500">
                {booking.notes || "No special notes are attached to this rental yet."}
              </div>
            </div>
          </section>

          <aside className="space-y-6" id="actions">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Manage rental</h3>
              <p className="mt-1 text-sm text-slate-500">
                Request rental changes or support without calling or texting.
              </p>

              <div className="mt-5 space-y-4">
                <ActionCard
                  title="Request pickup"
                  description="Finished using your dumpster? Let us know and we’ll review your pickup request."
                >
                  {pickupEligibility.eligible ? (
                    <Link
                      href={`/portal/rentals/${booking.id}/pickup-request`}
                      className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Start pickup request
                    </Link>
                  ) : (
                    <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                      {pickupEligibility.reason}
                    </div>
                  )}
                </ActionCard>

                <ActionCard
                  title="Request more time"
                  description="Need to keep the dumpster longer? Coming soon."
                >
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-400">
                    Extension requests are coming soon.
                  </div>
                </ActionCard>

                <ActionCard
                  title="Report an issue"
                  description="Tell us about service or rental problems. Coming soon."
                >
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-400">
                    Issue reporting is coming soon.
                  </div>
                </ActionCard>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">Rental requests</h3>
              <div className="mt-4 space-y-3">
                {requests.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    No rental requests have been submitted for this rental yet.
                  </div>
                ) : (
                  requests.slice(0, 5).map((request) => (
                    <div key={request.id} className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">
                          {getActionTypeLabel(request.action_type)}
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${getCustomerVisibleStatusTone(
                            request.customer_visible_status,
                          )}`}
                        >
                          {getCustomerVisibleStatusLabel(request.customer_visible_status)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-500">
                        Submitted {formatDateTime(request.submitted_at)}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {getPortalRequestSummary(request)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PortalShell>
  );
}
