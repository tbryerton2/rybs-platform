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
import { getPortalRequests } from "@/lib/admin/portal-requests";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { formatCustomerName } from "@/lib/customer-name";
import { requireAdminOwner } from "@/lib/admin/auth";

type SearchParams = Record<string, string | string[] | undefined>;

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
  const adminSession = await requireAdminOwner();
  const resolvedSearchParams = (await searchParams) ?? {};
  const filter = sp(resolvedSearchParams, "filter") ?? "all";
  const { requests, loadError } = await getPortalRequests(filter, adminSession.business.id);

  return (
    <AdminPage className="pt-6">
      <AdminPageHeader
        title="Portal Requests"
        description="Review self-service rental requests submitted from the customer portal."
        actions={
          <>
            <FilterLink href="/admin/portal-requests?filter=all" label="All" active={filter === "all"} />
            <FilterLink href="/admin/portal-requests?filter=attention" label="Needs attention" active={filter === "attention"} />
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
          </>
        }
      />

      {loadError ? (
        <div className="mt-6 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Portal requests could not be fully loaded. {loadError}
        </div>
      ) : null}

      <section className="mt-8 rounded-[20px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="text-sm font-semibold text-slate-900">
            {requests.length} {requests.length === 1 ? "request" : "requests"}
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="px-6 py-10 text-sm leading-6 text-slate-500">
            {loadError ? "No portal requests are available right now." : "No portal requests match this filter yet."}
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
                        {request.customer?.name ||
                          formatCustomerName(
                            request.booking?.customer_first_name,
                            request.booking?.customer_last_name,
                            "Unknown customer",
                          )}
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
                        className="admin-btn admin-btn-secondary admin-btn-sm"
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
    </AdminPage>
  );
}
