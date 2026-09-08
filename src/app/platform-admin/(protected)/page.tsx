import {
  BuildingOffice2Icon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PauseCircleIcon,
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

function StatusBadge({ status }: { status: PlatformTenantSummary["status"] }) {
  const lifecycleStatus = status === "active" ? "active" : "inactive";

  return (
    <span
      className={joinClasses(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        statusBadgeClassName(lifecycleStatus),
      )}
    >
      {lifecycleStatus === "active" ? "Active" : "Inactive"}
    </span>
  );
}

function SetupBadge({ tenant }: { tenant: PlatformTenantSummary }) {
  return (
    <span
      className={joinClasses(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        setupBadgeClassName(tenant.setup.readinessStatus),
      )}
    >
      {setupLabel(tenant.setup.readinessStatus)}
    </span>
  );
}

function BusinessLink({ tenant }: { tenant: PlatformTenantSummary }) {
  return (
    <div className="min-w-[13rem]">
      <Link
        href={`/platform-admin/businesses/${tenant.id}`}
        className="font-semibold text-slate-900 hover:text-sky-700"
      >
        {tenant.displayName}
      </Link>
      <div className="mt-1 text-xs text-slate-500">{tenant.slug}</div>
    </div>
  );
}

function ActionLink({ tenant }: { tenant: PlatformTenantSummary }) {
  return (
    <Link
      href={`/platform-admin/businesses/${tenant.id}`}
      className="admin-btn admin-btn-secondary admin-btn-sm"
    >
      View
    </Link>
  );
}

function AttentionRow({ tenant }: { tenant: PlatformTenantSummary }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-4 pl-4 pr-3 align-top sm:pl-5">
        <BusinessLink tenant={tenant} />
      </td>
      <td className="px-3 py-4 align-top">
        <StatusBadge status={tenant.status} />
      </td>
      <td className="px-3 py-4 align-top">
        <div className="flex max-w-2xl flex-wrap gap-1.5">
          {tenant.setup.missingRequiredAreas.map((area) => (
            <span
              key={area.key}
              className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200"
              title={area.needed}
            >
              {area.label}
            </span>
          ))}
        </div>
      </td>
      <td className="py-4 pl-3 pr-4 text-right align-top sm:pr-5">
        <ActionLink tenant={tenant} />
      </td>
    </tr>
  );
}

function RecentBusinessRow({ tenant }: { tenant: PlatformTenantSummary }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-4 pl-4 pr-3 sm:pl-5">
        <BusinessLink tenant={tenant} />
      </td>
      <td className="px-3 py-4">
        <StatusBadge status={tenant.status} />
      </td>
      <td className="px-3 py-4">
        <SetupBadge tenant={tenant} />
        {tenant.setup.status === "needs_attention" ? (
          <div className="mt-1 text-xs text-slate-500">
            {tenant.setup.requiredCompleteCount} / {tenant.setup.requiredAreaCount} required
          </div>
        ) : null}
      </td>
      <td className="px-3 py-4 text-sm text-slate-600">{formatDate(tenant.createdAt)}</td>
      <td className="py-4 pl-3 pr-4 text-right sm:pr-5">
        <ActionLink tenant={tenant} />
      </td>
    </tr>
  );
}

export default async function PlatformAdminDashboardPage() {
  const { tenants, stats } = await getPlatformTenantIndex();
  const businessesNeedingAttention = tenants.filter(
    (tenant) => tenant.setup.status === "needs_attention",
  );
  const recentlyAdded = [...tenants]
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);

      return (
        (Number.isFinite(rightTime) ? rightTime : 0) -
        (Number.isFinite(leftTime) ? leftTime : 0)
      );
    })
    .slice(0, 5);
  const activeBusinessesWithIncompleteSetup = businessesNeedingAttention.filter(
    (tenant) => tenant.status === "active",
  );

  return (
    <AdminPage width="wide" className="space-y-6 pt-2">
      <AdminPageHeader
        eyebrow="Platform"
        title="Platform Admin"
        description="At-a-glance operational status across businesses."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard
          label="Total Businesses"
          value={stats.totalBusinesses}
          icon={BuildingOffice2Icon}
          tone="blue"
          compact
        />
        <AdminSummaryCard
          label="Active"
          value={stats.activeBusinesses}
          icon={CheckCircleIcon}
          tone="green"
          compact
        />
        <AdminSummaryCard
          label="Inactive"
          value={stats.inactiveBusinesses}
          icon={PauseCircleIcon}
          tone="slate"
          compact
        />
        <AdminSummaryCard
          label="Need Setup"
          value={stats.businessesNeedingSetup}
          icon={ExclamationTriangleIcon}
          tone={stats.businessesNeedingSetup > 0 ? "amber" : "green"}
          compact
        />
      </div>

      <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900">Businesses needing attention</h2>
        </div>

        {businessesNeedingAttention.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-600 sm:px-5">
            All businesses are fully configured.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:pl-5">
                    Business
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Needs attention
                  </th>
                  <th className="py-3 pl-3 pr-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 sm:pr-5">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {businessesNeedingAttention.map((tenant) => (
                  <AttentionRow key={tenant.id} tenant={tenant} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold text-slate-900">Recently added</h2>
          </div>

          {recentlyAdded.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-600 sm:px-5">
              No businesses have been created yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:pl-5">
                      Business
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Setup status
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
                  {recentlyAdded.map((tenant) => (
                    <RecentBusinessRow key={tenant.id} tenant={tenant} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200">
              <ClockIcon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Platform status</h2>
              {activeBusinessesWithIncompleteSetup.length > 0 ? (
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {activeBusinessesWithIncompleteSetup.length} active business
                  {activeBusinessesWithIncompleteSetup.length === 1 ? "" : "es"} have incomplete required setup.
                </p>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  No platform issues detected from current business records.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </AdminPage>
  );
}
