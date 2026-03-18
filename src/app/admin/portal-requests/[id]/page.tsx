export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAvailableCustomerVisibleStatuses,
  getActionTypeLabel,
  getActionTypeShortDescription,
  getCustomerVisibleStatusLabel,
  getCustomerVisibleStatusTone,
  getExtensionReasonLabel,
  getInternalRequestStatusLabel,
  getInternalRequestStatusTone,
  getIssueCategoryLabel,
  getIssuePreferredContactMethodLabel,
  getIssueUrgencyLabel,
  getRequestPriorityLabel,
  getRequestPriorityTone,
  type ExtensionRequestDetails,
  type IssueReportDetails,
  type PickupRequestDetails,
} from "@/lib/rental-action-requests";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { updatePortalRequestAction } from "./actions";

type PortalRequestDetail = {
  id: string;
  booking_id: string;
  customer_id: string;
  action_type: "pickup_request" | "extension_request" | "issue_report";
  status: "submitted" | "under_review" | "approved" | "denied" | "completed";
  customer_visible_status:
    | "received"
    | "under_review"
    | "pickup_scheduled"
    | "unable_to_confirm"
    | "completed";
  priority: "low" | "normal" | "high" | "urgent";
  details_json: PickupRequestDetails | ExtensionRequestDetails | IssueReportDetails | null;
  internal_notes: string | null;
  customer_update: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  resolved_at: string | null;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  booking: {
    id: string;
    status: string | null;
    customer_name: string | null;
    customer_street: string | null;
    customer_city: string | null;
    customer_zip: string | null;
    delivery_date: string | null;
    pickup_date: string | null;
  } | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-900">{value}</div>
    </div>
  );
}

export default async function AdminPortalRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};

  const { data, error } = await supabaseAdmin
    .from("rental_action_requests")
    .select(
      `
      id,
      booking_id,
      customer_id,
      action_type,
      status,
      customer_visible_status,
      priority,
      details_json,
      internal_notes,
      customer_update,
      submitted_at,
      reviewed_at,
      resolved_at,
      customer:customers(id, name, email, phone),
      booking:bookings(id, status, customer_name, customer_street, customer_city, customer_zip, delivery_date, pickup_date)
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) notFound();

  const request = data as PortalRequestDetail;
  const pickupDetails = (request.details_json ?? null) as PickupRequestDetails | null;
  const extensionDetails = (request.details_json ?? null) as ExtensionRequestDetails | null;
  const issueDetails = (request.details_json ?? null) as IssueReportDetails | null;

  return (
    <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/admin/portal-requests" className="text-sm font-medium text-slate-500 hover:text-slate-900">
            ← Back to portal requests
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            {getActionTypeLabel(request.action_type)}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Request #{request.id.slice(0, 8)} for rental #{request.booking_id.slice(0, 8)}
          </p>
          <p className="mt-2 text-sm text-slate-500">{getActionTypeShortDescription(request.action_type)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getRequestPriorityTone(
              request.priority,
            )}`}
          >
            Priority: {getRequestPriorityLabel(request.priority)}
          </span>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getInternalRequestStatusTone(
              request.status,
            )}`}
          >
            {getInternalRequestStatusLabel(request.status)}
          </span>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getCustomerVisibleStatusTone(
              request.customer_visible_status,
            )}`}
          >
            Customer: {getCustomerVisibleStatusLabel(request.customer_visible_status, request.action_type)}
          </span>
        </div>
      </div>

      {resolvedSearchParams.saved ? (
        <div className="mt-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
          Request updates saved.
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Request summary</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <DetailBlock label="Submitted" value={formatDateTime(request.submitted_at)} />
              <DetailBlock label="Priority" value={getRequestPriorityLabel(request.priority)} />
              <DetailBlock
                label="Customer"
                value={request.customer?.name || request.booking?.customer_name || "Unknown customer"}
              />
              <DetailBlock label="Customer email" value={request.customer?.email || "—"} />
              <DetailBlock label="Customer phone" value={request.customer?.phone || "—"} />
              <DetailBlock label="Rental status" value={request.booking?.status || "—"} />
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Booking details</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <DetailBlock
                label="Service address"
                value={
                  [request.booking?.customer_street, request.booking?.customer_city, request.booking?.customer_zip]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
              <DetailBlock label="Delivery date" value={formatDate(request.booking?.delivery_date ?? null)} />
              <DetailBlock label="Pickup date" value={formatDate(request.booking?.pickup_date ?? null)} />
              <DetailBlock
                label="Booking"
                value={
                  <Link
                    href={`/admin/bookings/${request.booking_id}`}
                    className="font-semibold text-slate-900 hover:text-[#F97316]"
                  >
                    Open rental →
                  </Link>
                }
              />
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Requested details</h2>
            {request.action_type === "issue_report" ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <DetailBlock label="Issue category" value={getIssueCategoryLabel(issueDetails?.issueCategory ?? null)} />
                <DetailBlock label="Urgency" value={getIssueUrgencyLabel(issueDetails?.urgency ?? null)} />
                <DetailBlock
                  label="Preferred contact"
                  value={getIssuePreferredContactMethodLabel(issueDetails?.preferredContactMethod ?? null)}
                />
                <DetailBlock label="Description" value={issueDetails?.description || "—"} />
              </div>
            ) : request.action_type === "extension_request" ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <DetailBlock label="Extra days requested" value={extensionDetails?.requestedExtraDays ?? "—"} />
                <DetailBlock label="Reason" value={getExtensionReasonLabel(extensionDetails?.reason ?? null)} />
                <DetailBlock
                  label="Possible fees acknowledged"
                  value={extensionDetails?.acknowledgePossibleFees ? "Yes" : "No"}
                />
                <DetailBlock label="Notes" value={extensionDetails?.notes || "No notes added"} />
              </div>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <DetailBlock
                  label="Pickup timing"
                  value={
                    pickupDetails?.timingPreference === "specific_date"
                      ? "On a specific date"
                      : "As soon as possible"
                  }
                />
                <DetailBlock
                  label="Requested date"
                  value={pickupDetails?.requestedDate ? formatDate(pickupDetails.requestedDate) : "ASAP"}
                />
                <DetailBlock label="Access confirmed" value={pickupDetails?.accessConfirmed ? "Yes" : "No"} />
                <DetailBlock label="Notes" value={pickupDetails?.notes || "No notes added"} />
              </div>
            )}
          </div>

          {request.customer_update?.trim() ? (
            <div className="rounded-[28px] border border-emerald-100 bg-emerald-50/60 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Latest customer update</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{request.customer_update.trim()}</p>
            </div>
          ) : null}
        </section>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Admin response</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Update the internal workflow, add internal context, and control what the customer sees in the portal.
            </p>

            <form action={updatePortalRequestAction} className="mt-6 space-y-5">
              <input type="hidden" name="id" value={request.id} />

              <div>
                <label htmlFor="status" className="text-sm font-semibold text-slate-900">
                  Internal status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={request.status}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                >
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under review</option>
                  <option value="approved">Approved</option>
                  <option value="denied">Denied</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label htmlFor="customer_visible_status" className="text-sm font-semibold text-slate-900">
                  Customer-visible status
                </label>
                <select
                  id="customer_visible_status"
                  name="customer_visible_status"
                  defaultValue={request.customer_visible_status}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                >
                  {getAvailableCustomerVisibleStatuses(request.action_type).map((status) => (
                    <option key={status} value={status}>
                      {getCustomerVisibleStatusLabel(status, request.action_type)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl bg-slate-50/80 p-4">
                <label htmlFor="internal_notes" className="text-sm font-semibold text-slate-900">
                  Internal notes
                </label>
                <textarea
                  id="internal_notes"
                  name="internal_notes"
                  rows={5}
                  defaultValue={request.internal_notes ?? ""}
                  placeholder="Routing context, dispatch notes, or follow-up needed"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>

              <div className="rounded-2xl bg-slate-50/80 p-4">
                <label htmlFor="customer_update" className="text-sm font-semibold text-slate-900">
                  Customer update
                </label>
                <textarea
                  id="customer_update"
                  name="customer_update"
                  rows={4}
                  defaultValue={request.customer_update ?? ""}
                  placeholder="Optional short update shown back in the customer portal"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Save request updates
              </button>
            </form>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Workflow timestamps</h2>
            <div className="mt-5 space-y-4">
              <DetailBlock label="Submitted" value={formatDateTime(request.submitted_at)} />
              <DetailBlock label="Reviewed" value={formatDateTime(request.reviewed_at)} />
              <DetailBlock label="Resolved" value={formatDateTime(request.resolved_at)} />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
