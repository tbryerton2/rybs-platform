import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getActionTypeLabel,
  getActionTypeShortDescription,
  getCustomerVisibleStatusLabel,
  getCustomerVisibleStatusTone,
} from "@/lib/rental-action-requests";
import { canReorderBooking } from "@/lib/reorder";
import { requirePortalCustomer } from "@/lib/portal/auth";
import { getPortalRental, getPortalRequestSummary } from "@/lib/portal/data";
import { getPortalRentalLabel } from "@/lib/portal/rental-number";
import type { PortalBookingRequest } from "@/lib/portal/data";
import { formatUsdFromCents } from "@/lib/money";
import { PortalShell } from "../../_components/portal-shell";
import { PortalStatusBadge } from "../../_components/portal-status-badge";
import { PortalSubpageHeader } from "../../_components/portal-subpage-header";
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

function formatServiceArea(town: string | null, county: string | null) {
  return [town, county].filter(Boolean).join(", ");
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
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
  if (submitted === "extension") {
    return "Your extension request was submitted for review.";
  }
  if (submitted === "issue") {
    return "Your issue report was submitted.";
  }
  return null;
}

function ActionCard({
  title,
  description,
  tone = "default",
  children,
}: {
  title: string;
  description: string;
  tone?: "default" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "rounded-[28px] border p-5 shadow-sm",
        tone === "muted" ? "border-slate-200 bg-slate-50/70" : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        Rental action
      </div>
      <h3 className="mt-2 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function RequestHistoryCard({
  request,
}: {
  request: PortalBookingRequest;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            {getActionTypeShortDescription(request.action_type)}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {getActionTypeLabel(request.action_type)}
          </div>
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${getCustomerVisibleStatusTone(
            request.customer_visible_status,
          )}`}
        >
          {getCustomerVisibleStatusLabel(request.customer_visible_status, request.action_type)}
        </span>
      </div>
      <div className="mt-3 text-sm text-slate-500">Submitted {formatDateTime(request.submitted_at)}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{getPortalRequestSummary(request)}</div>
      {request.customer_update?.trim() ? (
        <div className="mt-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Latest update</div>
          <div className="mt-1">{request.customer_update.trim()}</div>
        </div>
      ) : null}
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

  const { booking, requests, pickupEligibility, extensionEligibility, issueReportEligibility } = rental;
  const submissionMessage = getSubmissionMessage(resolvedSearchParams);
  const reorderEligible = canReorderBooking(booking.status);
  const bookingContactDiffers =
    normalizeText(booking.customer_name) !== normalizeText(customer.name) ||
    normalizeText(booking.customer_email) !== normalizeText(customer.email) ||
    normalizePhone(booking.customer_phone) !== normalizePhone(customer.phone);

  return (
    <PortalShell pathname={`/portal/rentals/${booking.id}`}>
      <div className="space-y-6">
        <PortalSubpageHeader
          title={getPortalRentalLabel(booking.booking_ref)}
          description={`${booking.customer_street || "Address pending"}${
            booking.customer_city || booking.customer_zip
              ? `, ${[booking.customer_city, booking.customer_zip].filter(Boolean).join(" ")}`
              : ""
          }`}
          meta={<PortalStatusBadge stage={booking.portalStage} />}
        />

        {submissionMessage ? (
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
            {submissionMessage}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div
                className={`grid gap-4 sm:grid-cols-2 ${
                  formatServiceArea(booking.service_town, booking.service_county)
                    ? "xl:grid-cols-4"
                    : "xl:grid-cols-3"
                }`}
              >
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
                {formatServiceArea(booking.service_town, booking.service_county) ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Service area
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      {formatServiceArea(booking.service_town, booking.service_county)}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 rounded-3xl border border-orange-100 bg-orange-50/70 px-5 py-4">
                <div className="text-sm font-semibold text-slate-900">What happens next</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{booking.nextAction}</div>
              </div>
            </div>

            {bookingContactDiffers ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Booking contact</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      This booking was submitted with contact details that differ from your current account profile.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                    Booked with snapshot
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Name</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{booking.customer_name || "—"}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{booking.customer_email || "—"}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{booking.customer_phone || "—"}</div>
                  </div>
                </div>
              </div>
            ) : null}

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
                  tone={pickupEligibility.eligible ? "default" : "muted"}
                >
                  {pickupEligibility.eligible ? (
                    <Link
                      href={`/portal/rentals/${booking.id}/pickup-request`}
                      className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Start pickup request
                    </Link>
                  ) : (
                    <div className="rounded-2xl bg-white px-4 py-4 text-sm leading-6 text-slate-500 ring-1 ring-slate-200">
                      {pickupEligibility.reason}
                    </div>
                  )}
                </ActionCard>

                <ActionCard
                  title="Request more time"
                  description="Need to keep the dumpster longer? Send a request and we’ll review availability and any added cost."
                  tone={extensionEligibility.eligible ? "default" : "muted"}
                >
                  {extensionEligibility.eligible ? (
                    <Link
                      href={`/portal/rentals/${booking.id}/extension-request`}
                      className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Start extension request
                    </Link>
                  ) : (
                    <div className="rounded-2xl bg-white px-4 py-4 text-sm leading-6 text-slate-500 ring-1 ring-slate-200">
                      {extensionEligibility.reason}
                    </div>
                  )}
                </ActionCard>

                <ActionCard
                  title="Report an issue"
                  description="Tell us about service or rental problems and our team will review it."
                  tone={issueReportEligibility.eligible ? "default" : "muted"}
                >
                  {issueReportEligibility.eligible ? (
                    <Link
                      href={`/portal/rentals/${booking.id}/issue-report`}
                      className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Report an issue
                    </Link>
                  ) : (
                    <div className="rounded-2xl bg-white px-4 py-4 text-sm leading-6 text-slate-500 ring-1 ring-slate-200">
                      {issueReportEligibility.reason}
                    </div>
                  )}
                </ActionCard>

                {reorderEligible ? (
                  <ActionCard
                    title="Book this setup again"
                    description="Start a new booking using this rental as your starting point. You can review and update everything before confirming."
                  >
                    <Link
                      href={`/book/address?reorderFrom=${encodeURIComponent(booking.id)}`}
                      className="inline-flex items-center justify-center rounded-2xl bg-[#F97316] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#EA580C]"
                    >
                      Book this setup again
                    </Link>
                  </ActionCard>
                ) : null}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Rental requests</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Track what you submitted and the latest response from our team.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                  {requests.length} total
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {requests.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm leading-6 text-slate-500">
                    No rental requests have been submitted for this rental yet. When you request pickup,
                    more time, or support, updates will appear here.
                  </div>
                ) : (
                  requests.slice(0, 5).map((request) => <RequestHistoryCard key={request.id} request={request} />)
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PortalShell>
  );
}
