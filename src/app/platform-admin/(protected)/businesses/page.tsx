import {
  BuildingOffice2Icon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PauseCircleIcon,
  PencilSquareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { AdminSummaryCard } from "@/app/admin/_components/AdminSummaryCard";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { getPlatformTenantIndex } from "@/lib/platform-admin/tenants";
import type { PlatformTenantSummary } from "@/lib/platform-admin/setup-completeness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function statusBadgeClassName(status: "active" | "inactive") {
  return status === "active"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-slate-100 text-slate-600 ring-slate-200";
}

function setupBadgeClassName(status: PlatformTenantSummary["setup"]["readinessStatus"]) {
  switch (status) {
    case "active":
    case "ready_to_launch":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "active_setup_incomplete":
      return "bg-red-50 text-red-700 ring-red-200";
    case "in_progress":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "not_started":
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

function setupLabel(status: PlatformTenantSummary["setup"]["readinessStatus"]) {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "ready_to_launch":
      return "Ready to launch";
    case "active":
      return "Active";
    case "active_setup_incomplete":
      return "Active - setup incomplete";
  }
}

function BusinessRow({ tenant }: { tenant: PlatformTenantSummary }) {
  const lifecycleStatus = tenant.status === "active" ? "active" : "inactive";

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-4 pl-4 pr-3 sm:pl-5">
        <div className="min-w-[14rem]">
          <Link
            href={`/platform-admin/businesses/${tenant.id}`}
            className="font-semibold text-slate-900 hover:text-sky-700"
          >
            {tenant.displayName}
          </Link>
          <div className="mt-1 text-xs text-slate-500">{tenant.id}</div>
        </div>
      </td>
      <td className="px-3 py-4 text-sm text-slate-600">{tenant.slug}</td>
      <td className="px-3 py-4">
        <span
          className={joinClasses(
            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
            statusBadgeClassName(lifecycleStatus),
          )}
        >
          {lifecycleStatus === "active" ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-3 py-4">
        <span
          className={joinClasses(
            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
            setupBadgeClassName(tenant.setup.readinessStatus),
          )}
        >
          {setupLabel(tenant.setup.readinessStatus)}
        </span>
        {tenant.setup.status === "needs_attention" ? (
          <div className="mt-1 text-xs text-slate-500">
            {tenant.setup.requiredCompleteCount} / {tenant.setup.requiredAreaCount} required
          </div>
        ) : null}
      </td>
      <td className="px-3 py-4 text-sm text-slate-600">
        {tenant.signals.activeAdminMembershipCount} active
      </td>
      <td className="px-3 py-4 text-sm text-slate-600">{formatDate(tenant.createdAt)}</td>
      <td className="py-4 pl-3 pr-4 text-right sm:pr-5">
        <div className="flex justify-end gap-2">
          <Link
            href={`/platform-admin/businesses/${tenant.id}`}
            className="admin-btn admin-btn-secondary admin-btn-sm"
          >
            View
          </Link>
          <Link
            href={`/platform-admin/businesses/${tenant.id}/edit`}
            className="admin-btn admin-btn-secondary admin-btn-sm"
            aria-label={`Edit ${tenant.displayName}`}
          >
            <PencilSquareIcon className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </td>
    </tr>
  );
}

export default async function PlatformBusinessesPage() {
  const { tenants, stats } = await getPlatformTenantIndex();

  return (
    <AdminPage width="wide" className="space-y-6 pt-2">
      <AdminPageHeader
        eyebrow="Platform"
        title="Businesses"
        description="Create businesses, inspect setup status, and manage basic lifecycle state."
        actions={
          <Link href="/platform-admin/businesses/new" className="admin-btn admin-btn-primary">
            <PlusIcon className="h-4 w-4" />
            Create business
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard
          label="Total businesses"
          value={stats.totalBusinesses}
          icon={BuildingOffice2Icon}
          tone="blue"
          compact
        />
        <AdminSummaryCard
          label="Active businesses"
          value={stats.activeBusinesses}
          icon={CheckCircleIcon}
          tone="green"
          compact
        />
        <AdminSummaryCard
          label="Inactive businesses"
          value={stats.inactiveBusinesses}
          icon={PauseCircleIcon}
          tone="slate"
          compact
        />
        <AdminSummaryCard
          label="Needing setup"
          value={stats.businessesNeedingSetup}
          icon={ExclamationTriangleIcon}
          tone={stats.businessesNeedingSetup > 0 ? "amber" : "green"}
          compact
        />
      </div>

      <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900">Business list</h2>
          <p className="mt-1 text-xs text-slate-500">
            Rows link to exact tenant UUID detail pages. Keep setup incomplete businesses inactive until they are ready.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:pl-5">
                  Business
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Slug
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Setup status
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Admin access
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Created
                </th>
                <th className="py-3 pl-3 pr-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 sm:pr-5">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tenants.map((tenant) => (
                <BusinessRow key={tenant.id} tenant={tenant} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPage>
  );
}
