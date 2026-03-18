export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import {
  getActionTypeLabel,
  getActionTypeShortDescription,
  getCustomerVisibleStatusLabel,
  getCustomerVisibleStatusTone,
  getInternalRequestStatusLabel,
  getInternalRequestStatusTone,
  getRequestPriorityLabel,
  getRequestPriorityTone,
} from "@/lib/rental-action-requests";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SearchParams = Record<string, string | string[] | undefined>;

type PortalRequestListRow = {
  id: string;
  booking_id: string;
  action_type: "pickup_request" | "extension_request" | "issue_report";
  status: "submitted" | "under_review" | "approved" | "denied" | "completed";
  customer_visible_status:
    | "received"
    | "under_review"
    | "pickup_scheduled"
    | "unable_to_confirm"
    | "completed";
  priority: "low" | "normal" | "high" | "urgent";
  submitted_at: string;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  booking: {
    id: string;
    customer_name: string | null;
    customer_street: string | null;
    customer_city: string | null;
    customer_zip: string | null;
    status: string | null;
  } | null;
};

function sp(obj: SearchParams, key: string) {
  const value = obj[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getFilterWhere(filter: string) {
  switch (filter) {
    case "submitted":
      return { type: "eq" as const, value: "submitted" };
    case "under_review":
      return { type: "eq" as const, value: "under_review" };
    case "completed":
      return { type: "eq" as const, value: "completed" };
    default:
      return null;
  }
}

async function getPortalRequests(filter: string) {
  let query = supabaseAdmin
    .from("rental_action_requests")
    .select(
      `
      id,
      booking_id,
      action_type,
      status,
      customer_visible_status,
      priority,
      submitted_at,
      customer:customers(id, name, email),
      booking:bookings(id, customer_name, customer_street, customer_city, customer_zip, status)
    `,
    )
    .order("submitted_at", { ascending: false })
    .limit(200);

  const where = getFilterWhere(filter);
  if (where?.type === "eq") {
    query = query.eq("status", where.value);
  }

  if (filter === "pickup_request" || filter === "extension_request" || filter === "issue_report") {
    query = query.eq("action_type", filter);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []) as PortalRequestListRow[];
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default async function AdminPortalRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const filter = sp(resolvedSearchParams, "filter") ?? "all";
  const requests = await getPortalRequests(filter);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-16 pt-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center rounded-full bg-[#F97316]/10 px-3 py-1 text-xs font-semibold text-[#F97316]">
            Admin
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            Portal requests
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Review self-service rental requests submitted from the customer portal.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterLink href="/admin/portal-requests?filter=all" label="All" active={filter === "all"} />
          <FilterLink href="/admin/portal-requests?filter=submitted" label="New" active={filter === "submitted"} />
          <FilterLink
            href="/admin/portal-requests?filter=under_review"
            label="Under review"
            active={filter === "under_review"}
          />
          <FilterLink href="/admin/portal-requests?filter=completed" label="Completed" active={filter === "completed"} />
          <FilterLink href="/admin/portal-requests?filter=pickup_request" label="Pickup" active={filter === "pickup_request"} />
          <FilterLink href="/admin/portal-requests?filter=extension_request" label="Extension" active={filter === "extension_request"} />
          <FilterLink href="/admin/portal-requests?filter=issue_report" label="Issues" active={filter === "issue_report"} />
        </div>
      </div>

      <section className="mt-8 rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="text-sm font-semibold text-slate-900">
            {requests.length} {requests.length === 1 ? "request" : "requests"}
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="px-6 py-10 text-sm leading-6 text-slate-500">
            No portal requests match this filter yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3">Submitted</th>
                  <th className="px-6 py-3">Request</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Rental</th>
                  <th className="px-6 py-3">Priority</th>
                  <th className="px-6 py-3">Address</th>
                  <th className="px-6 py-3">Internal</th>
                  <th className="px-6 py-3">Customer view</th>
                  <th className="px-6 py-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((request) => (
                  <tr key={request.id} className="align-top">
                    <td className="px-6 py-4 text-slate-600">{formatDateTime(request.submitted_at)}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{getActionTypeLabel(request.action_type)}</div>
                      <div className="mt-1 text-slate-500">{getActionTypeShortDescription(request.action_type)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">
                        {request.customer?.name || request.booking?.customer_name || "Unknown customer"}
                      </div>
                      <div className="mt-1 text-slate-500">{request.customer?.email || "—"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">Rental #{request.booking_id.slice(0, 8)}</div>
                      <div className="mt-1 text-slate-500">{request.booking?.status || "—"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${getRequestPriorityTone(
                          request.priority,
                        )}`}
                      >
                        {getRequestPriorityLabel(request.priority)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {[request.booking?.customer_street, request.booking?.customer_city, request.booking?.customer_zip]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${getInternalRequestStatusTone(
                          request.status,
                        )}`}
                      >
                        {getInternalRequestStatusLabel(request.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${getCustomerVisibleStatusTone(
                          request.customer_visible_status,
                        )}`}
                      >
                        {getCustomerVisibleStatusLabel(request.customer_visible_status, request.action_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/portal-requests/${request.id}`}
                        className="inline-flex rounded-full border border-slate-200 px-3 py-1.5 font-semibold text-slate-900 transition hover:border-[#F97316]/30 hover:bg-[#F97316]/5 hover:text-[#F97316]"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
