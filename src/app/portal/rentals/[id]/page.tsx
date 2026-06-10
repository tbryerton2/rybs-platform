import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  BoltIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import {
  getActionTypeLabel,
  getActionTypeShortDescription,
  getCustomerVisibleStatusLabel,
  getCustomerVisibleStatusTone,
} from "@/lib/rental-action-requests";
import { canReorderBooking } from "@/lib/reorder";
import { combineCustomerNameParts, formatCustomerName } from "@/lib/customer-name";
import { requirePortalCustomer } from "@/lib/portal/auth";
import { getPortalRental, getPortalRequestSummary } from "@/lib/portal/data";
import { getPortalRentalLabel } from "@/lib/portal/rental-number";
import { getPortalStageLabel } from "@/lib/portal/status";
import type { PortalBookingRequest } from "@/lib/portal/data";
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

function formatServiceArea(town: string | null, county: string | null) {
  return [town, county].filter(Boolean).join(", ");
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
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

function formatAddressLine(parts: Array<string | null | undefined>, fallback = "Not provided") {
  const value = parts.filter(Boolean).join(", ");
  return value || fallback;
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="text-sm leading-6 text-slate-900">{value}</div>
    </div>
  );
}

function InfoCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="mt-5 divide-y divide-slate-200/80">{children}</div>
    </section>
  );
}

function ActionTile({
  title,
  href,
  icon: Icon,
  eligible,
  reason,
}: {
  title: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  eligible: boolean;
  reason: string | null;
}) {
  const styles =
    title === "Request pickup"
      ? {
          surface: "border-emerald-200 bg-emerald-50/55",
          iconWrap: "bg-white text-emerald-700 ring-emerald-100",
          chevronWrap:
            "border-emerald-200 bg-white text-emerald-700 group-hover:border-emerald-300 group-hover:bg-emerald-50 group-hover:text-emerald-800",
          hover: "hover:border-emerald-300 hover:bg-emerald-50/75",
          disabled: "border-emerald-200/70 bg-emerald-50/35",
          disabledIcon: "bg-white/90 text-emerald-500 ring-emerald-100",
          disabledChevron: "border-emerald-200/80 bg-white/90 text-emerald-400",
        }
      : title === "Request more time"
        ? {
          surface: "border-amber-200 bg-amber-50/55",
          iconWrap: "bg-white text-amber-700 ring-amber-100",
            chevronWrap:
              "border-amber-200 bg-white text-amber-600 group-hover:border-amber-300 group-hover:bg-amber-50 group-hover:text-amber-700",
            hover: "hover:border-amber-300 hover:bg-amber-50/75",
            disabled: "border-amber-200/70 bg-amber-50/35",
            disabledIcon: "bg-white/90 text-amber-500 ring-amber-100",
            disabledChevron: "border-amber-200/80 bg-white/90 text-amber-300",
          }
        : {
            surface: "border-rose-200 bg-rose-50/55",
            iconWrap: "bg-white text-rose-700 ring-rose-100",
            chevronWrap:
              "border-rose-200 bg-white text-rose-600 group-hover:border-rose-300 group-hover:bg-rose-50 group-hover:text-rose-700",
            hover: "hover:border-rose-300 hover:bg-rose-50/75",
            disabled: "border-rose-200/70 bg-rose-50/35",
            disabledIcon: "bg-white/90 text-rose-500 ring-rose-100",
            disabledChevron: "border-rose-200/80 bg-white/90 text-rose-300",
          };

  if (!eligible) {
    return (
      <div className={`rounded-[24px] border px-4 py-4 text-sm text-slate-500 ${styles.disabled}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${styles.disabledIcon}`}>
              <Icon className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="font-semibold text-slate-700">{title}</div>
              <div className="mt-1 leading-6">
                {title === "Request pickup" ? "Available after delivery" : reason}
              </div>
            </div>
          </div>
          <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${styles.disabledChevron}`}>
            <ChevronRightIcon className="h-4 w-4" />
          </span>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`group rounded-[24px] border px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 ${styles.surface} ${styles.hover}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${styles.iconWrap}`}>
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            <div className="mt-1 text-sm text-slate-500">
              {title === "Request pickup"
                ? "Schedule pickup"
                : title === "Request more time"
                  ? "Ask for extra days"
                  : "Get support"}
            </div>
          </div>
        </div>
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition ${styles.chevronWrap}`}>
          <ChevronRightIcon className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function RequestHistoryCard({ request }: { request: PortalBookingRequest }) {
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
  const bookingCustomerName = combineCustomerNameParts(booking.customer_first_name, booking.customer_last_name);
  const bookingContactDiffers =
    normalizeText(bookingCustomerName) !== normalizeText(customer.name) ||
    normalizeText(booking.customer_email) !== normalizeText(customer.email) ||
    normalizePhone(booking.customer_phone) !== normalizePhone(customer.phone);

  const address = `${booking.customer_street || "Address pending"}${
    booking.customer_city || booking.customer_zip
      ? `, ${[booking.customer_city, booking.customer_zip].filter(Boolean).join(" ")}`
      : ""
  }`;

  return (
    <PortalShell pathname={`/portal/rentals/${booking.id}`}>
      <div className="space-y-6">
        <div className="space-y-4">
          <Link
            href="/portal/rentals"
            className="inline-flex items-center text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            ← Back to rentals
          </Link>

          <div className="space-y-[18px]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Rental details
                </div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  {getPortalRentalLabel(booking.booking_ref)}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">{address}</p>
              </div>
              <div className="flex items-start gap-3 lg:pt-1">
                <PortalStatusBadge stage={booking.portalStage} />
              </div>
            </div>

            {submissionMessage ? (
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
                {submissionMessage}
              </div>
            ) : null}

            <div>
              <RentalTimeline stage={booking.portalStage} />
            </div>
          </div>
        </div>

        <section className="rounded-[30px] border border-slate-200/90 bg-white px-5 py-5 shadow-[0_12px_28px_rgba(15,23,42,0.045)] sm:px-6 sm:py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                <BoltIcon className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-semibold text-slate-900">Quick actions</h2>
            </div>
            {reorderEligible ? (
              <Link
                href={`/book/address?reorderFrom=${encodeURIComponent(booking.id)}`}
                className="text-sm font-semibold text-[#ea580c] transition hover:text-[#c2410c]"
              >
                Book this setup again
              </Link>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <ActionTile
              title="Request pickup"
              href={`/portal/rentals/${booking.id}/pickup-request`}
              icon={TruckIcon}
              eligible={pickupEligibility.eligible}
              reason={pickupEligibility.reason}
            />
            <ActionTile
              title="Request more time"
              href={`/portal/rentals/${booking.id}/extension-request`}
              icon={ClockIcon}
              eligible={extensionEligibility.eligible}
              reason={extensionEligibility.reason}
            />
            <ActionTile
              title="Report an issue"
              href={`/portal/rentals/${booking.id}/issue-report`}
              icon={ExclamationTriangleIcon}
              eligible={issueReportEligibility.eligible}
              reason={issueReportEligibility.reason}
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <InfoCard title="Rental Information" icon={TruckIcon}>
            <InfoItem label="Rental ID" value={getPortalRentalLabel(booking.booking_ref)} />
            <InfoItem label="Portal status" value={getPortalStageLabel(booking.portalStage)} />
            <InfoItem label="Order date" value={booking.created_at ? formatDate(booking.created_at.slice(0, 10)) : "—"} />
            <InfoItem label="Requests submitted" value={`${requests.length}`} />
          </InfoCard>

          <InfoCard title="Schedule" icon={CalendarDaysIcon}>
            <InfoItem label="Delivery date" value={formatDate(booking.delivery_date)} />
            <InfoItem label="Pickup date" value={formatDate(booking.pickup_date)} />
            <InfoItem label="Pickup mode" value={booking.pickup_mode === "request" ? "By request" : booking.pickup_mode === "schedule" ? "Scheduled" : "Not set"} />
            <InfoItem label="What happens next" value={booking.nextAction} />
          </InfoCard>

          <InfoCard title="Location" icon={MapPinIcon}>
            <InfoItem
              label="Service address"
              value={formatAddressLine(
                [
                  booking.customer_street,
                  [booking.customer_city].filter(Boolean).join(", "),
                  booking.customer_zip,
                ],
                "Address pending",
              )}
            />
            <InfoItem label="Customer name" value={bookingCustomerName || customer.name || "—"} />
            <InfoItem label="Service area" value={formatServiceArea(booking.service_town, booking.service_county) || "—"} />
          </InfoCard>

          <InfoCard title="Financial Summary" icon={CurrencyDollarIcon}>
            <InfoItem label="Rental total" value={formatUsdFromCents(booking.total_price_cents)} />
            <InfoItem label="Billing details" value="Included in your booking confirmation" />
            <InfoItem label="Billing questions" value="Use Report an issue for support" />
            <InfoItem label="Rebook this setup" value={reorderEligible ? "Available" : "Not available yet"} />
          </InfoCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-6">
            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">Notes and instructions</h2>
              <div className="mt-3 text-sm leading-6 text-slate-500">
                {booking.notes || "No special notes are attached to this rental yet."}
              </div>
            </section>

            {bookingContactDiffers ? (
              <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Booking contact</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      This rental was booked with contact details that differ from your current account profile.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                    Snapshot
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <InfoItem
                    label="Name"
                    value={formatCustomerName(booking.customer_first_name, booking.customer_last_name)}
                  />
                  <InfoItem label="Email" value={booking.customer_email || "—"} />
                  <InfoItem label="Phone" value={booking.customer_phone || "—"} />
                </div>
              </section>
            ) : null}
          </div>

          <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Rental requests</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Track what you submitted and the latest response from our team.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                {requests.length} total
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {requests.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm leading-6 text-slate-500">
                  No rental requests have been submitted for this rental yet. When you request pickup,
                  more time, or support, updates will appear here.
                </div>
              ) : (
                requests.slice(0, 5).map((request) => <RequestHistoryCard key={request.id} request={request} />)
              )}
            </div>
          </section>
        </section>
      </div>
    </PortalShell>
  );
}
