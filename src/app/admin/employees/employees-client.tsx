"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  ChevronRightIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  UserMinusIcon,
} from "@heroicons/react/24/outline";
import { ClickableTableRow } from "@/app/admin/analytics/zip-heatmap/clickable-table-row";
import { adminSummaryCardShell } from "@/app/admin/_components/AdminSummaryCard";
import {
  formatDate,
  formatPhone,
  getEmployeeRoleLabel,
  type EmployeeRecord,
} from "@/lib/admin/employees";

type EmployeesClientProps = {
  initialEmployees: EmployeeRecord[];
  loadError: string | null;
};

type EmployeesQuickFilter = "all" | "active" | "inactive" | "license_expiring_soon";

function getLicenseStatus(employee: EmployeeRecord) {
  if (!employee.licenseExpiration) {
    return {
      label: "No expiration",
      tone: "neutral" as const,
    };
  }

  const expiration = new Date(`${employee.licenseExpiration}T00:00:00`);
  const now = new Date();
  const diffDays = (expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return {
      label: "Expired",
      tone: "danger" as const,
    };
  }

  if (diffDays <= 90) {
    return {
      label: "Expiring soon",
      tone: "danger" as const,
    };
  }

  return {
    label: "Current",
    tone: "safe" as const,
  };
}

function isLicenseExpiringSoon(employee: EmployeeRecord) {
  if (!employee.licenseExpiration) return false;
  const expiration = new Date(`${employee.licenseExpiration}T00:00:00`);
  const now = new Date();
  const diffDays = (expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 90;
}

export function EmployeesClient({ initialEmployees, loadError }: EmployeesClientProps) {
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [quickFilter, setQuickFilter] = useState<EmployeesQuickFilter>("all");
  const deferredSearch = useDeferredValue(search);

  const expiringSoonEmployees = useMemo(
    () => initialEmployees.filter((employee) => isLicenseExpiringSoon(employee)),
    [initialEmployees],
  );

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return initialEmployees
      .filter((employee) => {
        if (quickFilter === "active") return employee.active;
        if (quickFilter === "inactive") return !employee.active;
        if (quickFilter === "license_expiring_soon") return isLicenseExpiringSoon(employee);

        return includeInactive || employee.active;
      })
      .filter((employee) => {
        if (!normalizedSearch) return true;

        return [
          employee.firstName,
          employee.lastName,
          employee.jobTitle,
          employee.phone,
          employee.secondPhone,
          employee.email,
          employee.city,
          employee.state,
          employee.employeeId,
          employee.roleKey,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((left, right) => {
        if (left.active !== right.active) return left.active ? -1 : 1;
        return `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`);
      });
  }, [deferredSearch, includeInactive, initialEmployees, quickFilter]);

  const activeEmployees = initialEmployees.filter((employee) => employee.active);
  const inactiveEmployees = initialEmployees.length - activeEmployees.length;
  const expiringSoonCount = expiringSoonEmployees.length;
  const hasSearch = search.trim().length > 0;
  const hasNoEmployees = initialEmployees.length === 0;
  const isQuickFilterActive = quickFilter !== "all";

  function clearRosterFilters() {
    setSearch("");
    setIncludeInactive(false);
    setQuickFilter("all");
  }

  function toggleQuickFilter(nextFilter: EmployeesQuickFilter) {
    setQuickFilter((current) => (current === nextFilter ? "all" : nextFilter));
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Active employees",
            value: activeEmployees.length,
            tone: "blue" as const,
            icon: UserGroupIcon,
            filterValue: "active" as const,
          },
          {
            label: "Inactive employees",
            value: inactiveEmployees,
            tone: "amber" as const,
            icon: UserMinusIcon,
            filterValue: "inactive" as const,
          },
          {
            label: "Licenses expiring soon",
            value: expiringSoonCount,
            tone: "rose" as const,
            icon: ExclamationTriangleIcon,
            filterValue: "license_expiring_soon" as const,
          },
        ].map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={() => toggleQuickFilter(stat.filterValue)}
            aria-pressed={quickFilter === stat.filterValue}
            className={[
              adminSummaryCardShell(
                stat.tone,
                "w-full p-5 text-left ring-1 transition duration-200 ease-out",
              ),
              "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300",
              quickFilter === stat.filterValue
                ? stat.tone === "blue"
                  ? "ring-sky-300/90 shadow-[0_0_0_1px_rgba(125,211,252,0.5)]"
                  : stat.tone === "amber"
                    ? "ring-amber-300/90 shadow-[0_0_0_1px_rgba(252,211,77,0.4)]"
                    : "ring-rose-300/90 shadow-[0_0_0_1px_rgba(251,113,133,0.35)]"
                : "ring-white/50 hover:ring-slate-200/80",
            ].join(" ")}
          >
            <div className="flex gap-4">
              <span
                className={[
                  "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/65 ring-1 ring-inset transition",
                  stat.tone === "blue"
                    ? "bg-sky-100/95 text-sky-700 ring-sky-200/90"
                    : stat.tone === "amber"
                      ? "bg-amber-100/95 text-amber-700 ring-amber-200/90"
                      : "bg-rose-100/95 text-rose-700 ring-rose-200/90",
                  quickFilter === stat.filterValue ? "scale-[1.02]" : "",
                ].join(" ")}
              >
                <stat.icon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="flex h-12 items-center text-sm font-medium leading-5 text-slate-600">{stat.label}</div>
                <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{stat.value}</div>
              </div>
            </div>
          </button>
        ))}
      </section>

      <section className="rounded-[32px] bg-white px-6 pb-6 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-8 sm:pt-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Search Employees</h2>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block flex-1">
            <span className="sr-only">Search employees</span>
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, title, phone, or email"
              className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#F97316]"
            />
          </label>

          <label
            className={[
              "inline-flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium transition",
              isQuickFilterActive ? "cursor-not-allowed text-slate-400" : "text-slate-700",
            ].join(" ")}
          >
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
              disabled={isQuickFilterActive}
              className="h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
            />
            Include inactive
          </label>

          {(hasSearch || includeInactive || isQuickFilterActive) ? (
            <button
              type="button"
              onClick={clearRosterFilters}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Clear view
            </button>
          ) : null}
        </div>

        {loadError ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <div>Employee records could not be loaded from Supabase: {loadError}</div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100"
            >
              Refresh page
            </button>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[32px] bg-white shadow-xl ring-1 ring-slate-200/70">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold tracking-tight text-slate-900">Employees</div>
            <div className="text-sm text-slate-500">
              {filteredEmployees.length} {filteredEmployees.length === 1 ? "employee" : "employees"}
            </div>
          </div>
        </div>

        {filteredEmployees.length === 0 ? (
          <div className="px-6 py-16">
            <div className="mx-auto max-w-xl rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <div className="text-lg font-semibold text-slate-900">
                {hasNoEmployees ? "No employees yet" : "No employees match this view"}
              </div>
              {hasNoEmployees ? (
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Create the first employee record for this business. Inactive records remain available for history and reactivation later.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-slate-200 text-sm">
              <colgroup>
                <col style={{ width: "260px" }} />
                <col style={{ width: "150px" }} />
                <col style={{ width: "200px" }} />
                <col style={{ width: "260px" }} />
                <col style={{ width: "220px" }} />
                <col style={{ width: "50px" }} />
              </colgroup>

              <thead className="bg-slate-50/80">
                <tr className="text-left">
                  <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-8">
                    Employee
                  </th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Title
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Contact
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    License
                  </th>
                  <th className="px-6 py-3.5 text-center sm:px-8">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200/70">
                {filteredEmployees.map((employee) => {
                  const licenseStatus = getLicenseStatus(employee);

                  return (
                    <ClickableTableRow
                      key={employee.id}
                      href={`/admin/employees/${employee.id}`}
                      ariaLabel={`Open employee ${employee.firstName} ${employee.lastName}`}
                      className="group cursor-pointer bg-white outline-none transition hover:bg-slate-50/70 focus-visible:bg-slate-50/70 focus-visible:outline-none"
                    >
                      <td className="px-6 py-4 align-top sm:px-8">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 transition group-hover:text-slate-950 group-focus-visible:text-slate-950">
                            {employee.firstName} {employee.lastName}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">{employee.employeeId || "No employee ID"}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {employee.roleKey ? getEmployeeRoleLabel(employee.roleKey) : employee.jobTitle}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center align-top">
                        <span
                          className={[
                            "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
                            employee.active
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-amber-50 text-amber-800 ring-amber-200",
                          ].join(" ")}
                        >
                          {employee.active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="px-4 py-4 align-top text-sm text-slate-700">
                        <div className="font-medium text-slate-900">{employee.jobTitle}</div>
                        <div className="mt-1 text-slate-500">
                          {[employee.city, employee.state].filter(Boolean).join(", ") || "Location not set"}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="min-w-0 text-sm text-slate-700">
                          <div className="font-medium text-slate-900">{formatPhone(employee.phone)}</div>
                          <div className="mt-1 truncate text-slate-500">{employee.email || "No email"}</div>
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="text-sm text-slate-700">
                          <div className="font-medium text-slate-900">{formatDate(employee.licenseExpiration)}</div>
                          <div className="mt-2">
                            <span
                              className={[
                                "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
                                licenseStatus.tone === "danger"
                                  ? "bg-rose-50 text-rose-700 ring-rose-200"
                                  : licenseStatus.tone === "safe"
                                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                    : "bg-slate-100 text-slate-700 ring-slate-200",
                              ].join(" ")}
                            >
                              {licenseStatus.label}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-middle sm:px-8">
                        <div className="flex items-center justify-center">
                          <span
                            aria-hidden="true"
                            className="inline-flex items-center justify-center rounded-full p-2 text-slate-400 transition group-hover:translate-x-0.5 group-hover:scale-110 group-hover:text-slate-700 group-focus-visible:translate-x-0.5 group-focus-visible:scale-110 group-focus-visible:text-slate-700"
                          >
                            <ChevronRightIcon className="h-6 w-6" />
                          </span>
                        </div>
                      </td>
                    </ClickableTableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
