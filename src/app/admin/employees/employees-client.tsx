"use client";

import type { ReactNode } from "react";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  UserMinusIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import { adminToast } from "@/app/admin/_components/admin/admin-toast";
import {
  createEmptyEmployee,
  employeeRoleOptions,
  formatDate,
  formatPhone,
  formatTimestamp,
  getEmployeeRoleLabel,
  normalizeEmailInput,
  normalizeEmployeeCodeInput,
  normalizeEmployeeMutationInput,
  normalizePhoneInput,
  normalizeStateInput,
  normalizeZipInput,
  preferredContactMethodOptions,
  toEmployeeMutationInput,
  validateEmployee,
  type EmployeeFormErrors,
  type EmployeeRecord,
} from "@/lib/admin/employees";
import {
  createEmployeeAction,
  deactivateEmployeeAction,
  reactivateEmployeeAction,
  updateEmployeeAction,
} from "./actions";

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-[#F97316]"> *</span> : null}
      </div>
      {children}
      {error ? <div className="mt-1.5 text-xs font-medium text-rose-600">{error}</div> : null}
    </label>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
  maxLength,
  error,
  disabled,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      className={[
        "h-11 w-full rounded-2xl border bg-white px-4 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-50",
        error
          ? "border-rose-300 focus:border-rose-400"
          : "border-slate-300 focus:border-[#F97316]",
      ].join(" ")}
    />
  );
}

function Select({
  value,
  onChange,
  children,
  error,
  disabled,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  children: ReactNode;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={[
        "h-11 w-full rounded-2xl border bg-white px-4 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-50",
        error
          ? "border-rose-300 focus:border-rose-400"
          : "border-slate-300 focus:border-[#F97316]",
      ].join(" ")}
    >
      {children}
    </select>
  );
}

function Textarea({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={4}
      disabled={disabled}
      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
    />
  );
}

type EmployeesClientProps = {
  initialEmployees: EmployeeRecord[];
  loadError: string | null;
};

export function EmployeesClient({
  initialEmployees,
  loadError,
}: EmployeesClientProps) {
  const [employees, setEmployees] = useState<EmployeeRecord[]>(initialEmployees);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [draft, setDraft] = useState<EmployeeRecord | null>(null);
  const [draftMode, setDraftMode] = useState<"create" | "edit">("create");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(initialEmployees[0]?.id ?? null);
  const [errors, setErrors] = useState<EmployeeFormErrors>({});
  const [panelError, setPanelError] = useState<string | null>(loadError);
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return employees
      .filter((employee) => includeInactive || employee.active)
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
  }, [deferredSearch, employees, includeInactive]);

  const selectedEmployee =
    filteredEmployees.find((employee) => employee.id === selectedEmployeeId) ??
    employees.find((employee) => employee.id === selectedEmployeeId) ??
    null;

  const activeEmployees = employees.filter((employee) => employee.active);
  const inactiveEmployees = employees.length - activeEmployees.length;
  const expiringSoonCount = employees.filter((employee) => {
    if (!employee.licenseExpiration) return false;
    const expiration = new Date(`${employee.licenseExpiration}T00:00:00`);
    const now = new Date();
    const diffDays = (expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 90;
  }).length;
  const hasSearch = search.trim().length > 0;
  const hasNoEmployees = employees.length === 0;
  const hasNoResults = !hasNoEmployees && filteredEmployees.length === 0;

  function openCreateForm() {
    setDraft(createEmptyEmployee());
    setDraftMode("create");
    setErrors({});
    setPanelError(null);
    setSelectedEmployeeId(null);
  }

  function openEditForm(employee: EmployeeRecord) {
    setDraft({ ...employee });
    setDraftMode("edit");
    setErrors({});
    setPanelError(null);
    setSelectedEmployeeId(employee.id);
  }

  function openReview(employeeId: string) {
    setSelectedEmployeeId(employeeId);
    setDraft(null);
    setErrors({});
    setPanelError(null);
  }

  function closeForm() {
    setDraft(null);
    setErrors({});
    setPanelError(null);
  }

  function updateDraft<K extends keyof EmployeeRecord>(key: K, value: EmployeeRecord[K]) {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
    setErrors((current) => ({
      ...current,
      [key as keyof EmployeeFormErrors]: undefined,
    }));
    setPanelError(null);
  }

  function clearRosterFilters() {
    setSearch("");
    setIncludeInactive(false);
  }

  function saveDraft() {
    if (!draft) return;

    const payload = normalizeEmployeeMutationInput(toEmployeeMutationInput(draft));
    const nextErrors = validateEmployee(payload);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setPanelError("Please review the highlighted fields before saving.");
      adminToast.error("Please review the employee form.");
      return;
    }

    startTransition(async () => {
      const result =
        draftMode === "create"
          ? await createEmployeeAction(payload)
          : await updateEmployeeAction(draft.id, payload);

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setPanelError(result.error);
        adminToast.error(result.error);
        return;
      }

      setEmployees((current) => {
        if (draftMode === "create") {
          return [result.employee, ...current];
        }

        return current.map((employee) =>
          employee.id === result.employee.id ? result.employee : employee,
        );
      });
      setSelectedEmployeeId(result.employee.id);
      setDraft(result.employee);
      setDraftMode("edit");
      setErrors({});
      setPanelError(null);
      adminToast.success(result.message);
    });
  }

  function toggleEmployeeStatus(employeeId: string) {
    const employee = employees.find((entry) => entry.id === employeeId);
    if (!employee) return;

    const confirmed = employee.active
      ? window.confirm(
          `Move ${employee.firstName} ${employee.lastName} to inactive? This keeps the record and history but removes the employee from the default active roster.`,
        )
      : window.confirm(
          `Reactivate ${employee.firstName} ${employee.lastName}? This will return the employee to the active roster.`,
        );

    if (!confirmed) return;

    startTransition(async () => {
      const result = employee.active
        ? await deactivateEmployeeAction(employeeId)
        : await reactivateEmployeeAction(employeeId);

      if (!result.ok) {
        setPanelError(result.error);
        adminToast.error(result.error);
        return;
      }

      setEmployees((current) =>
        current.map((entry) => (entry.id === result.employee.id ? result.employee : entry)),
      );
      setDraft((current) =>
        current && current.id === result.employee.id ? result.employee : current,
      );
      setSelectedEmployeeId(result.employee.id);
      setPanelError(null);
      adminToast.success(result.message);
    });
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active employees", value: activeEmployees.length, hint: "Shown by default in the roster" },
          { label: "Inactive records", value: inactiveEmployees, hint: "Kept for reactivation and history" },
          { label: "Licenses expiring soon", value: expiringSoonCount, hint: "Expiration within the next 90 days" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
            <div className="text-sm font-medium text-slate-500">{stat.label}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{stat.value}</div>
            <div className="mt-2 text-xs text-slate-500">{stat.hint}</div>
          </div>
        ))}
      </section>

      <section className="rounded-[32px] bg-white px-6 pb-6 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-8 sm:pt-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Team roster</h2>
            <p className="mt-1 text-sm text-slate-500">
              Active employees are shown by default. Search by name, role, phone, or email and open any record to review notes and license details.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
          >
            <PlusIcon className="h-4 w-4" />
            Add employee
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
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

          <label className="inline-flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
            />
            Include inactive
          </label>

          {(hasSearch || includeInactive) ? (
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

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)]">
        <div className="overflow-hidden rounded-[32px] bg-white shadow-xl ring-1 ring-slate-200/70">
          <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
            <div className="text-lg font-semibold tracking-tight text-slate-900">Employees</div>
            <div className="mt-1 text-sm text-slate-500">
              {filteredEmployees.length} {filteredEmployees.length === 1 ? "record" : "records"}
              {!includeInactive ? " shown from active roster" : " shown with inactive included"}
            </div>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="px-6 py-16">
              <div className="mx-auto max-w-xl rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                <div className="text-lg font-semibold text-slate-900">
                  {hasNoEmployees ? "No employees yet" : "No employees match this view"}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {hasNoEmployees
                    ? "Create the first employee record for this business. Inactive records remain available for history and reactivation later."
                    : hasNoResults
                      ? "Try a different search, clear the current view, or include inactive employees to widen the roster."
                      : "Adjust the current view to continue."}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  {!hasNoEmployees ? (
                    <button
                      type="button"
                      onClick={clearRosterFilters}
                      className="inline-flex h-11 items-center rounded-2xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Clear view
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={openCreateForm}
                    disabled={isPending}
                    className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Add employee
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50/80">
                  <tr className="text-left">
                    <th className="px-6 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-8">Name</th>
                    <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Title</th>
                    <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Phone</th>
                    <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Email</th>
                    <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">City / State</th>
                    <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">License exp.</th>
                    <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Status</th>
                    <th className="px-6 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-8">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredEmployees.map((employee) => {
                    const isSelected = selectedEmployeeId === employee.id;
                    return (
                      <tr
                        key={employee.id}
                        className={[
                          isSelected ? "bg-orange-50/40" : "bg-white",
                          !employee.active ? "opacity-80" : "",
                        ].join(" ")}
                      >
                        <td className="px-6 py-4 sm:px-8">
                          <button
                            type="button"
                            onClick={() => openReview(employee.id)}
                            className="text-left font-semibold text-slate-900 underline-offset-4 hover:underline"
                          >
                            {employee.firstName} {employee.lastName}
                          </button>
                          <div className="mt-1 text-xs text-slate-500">
                            {employee.employeeId || "No employee ID"}
                            {employee.roleKey ? <> • {getEmployeeRoleLabel(employee.roleKey)}</> : null}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-600">{employee.jobTitle}</td>
                        <td className="px-4 py-4 text-slate-600">{formatPhone(employee.phone)}</td>
                        <td className="px-4 py-4 text-slate-600">{employee.email}</td>
                        <td className="px-4 py-4 text-slate-600">{employee.city}, {employee.state}</td>
                        <td className="px-4 py-4 text-slate-600">{formatDate(employee.licenseExpiration)}</td>
                        <td className="px-4 py-4">
                          <span
                            className={[
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                              employee.active
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                : "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
                            ].join(" ")}
                          >
                            {employee.active ? "Active" : "Inactive"}
                          </span>
                          {!employee.active && employee.deactivatedAt ? (
                            <div className="mt-1 text-xs text-slate-500">
                              Inactive since {formatTimestamp(employee.deactivatedAt)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 sm:px-8">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openReview(employee.id)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              Review
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditForm(employee)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  {draft ? (draftMode === "create" ? "Add employee" : "Edit employee") : "Employee details"}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {draft
                    ? "Update operational details, contact information, and license records."
                    : "Select a roster entry to review it, or start a new employee record."}
                </p>
              </div>

              {draft ? (
                <div className="flex flex-wrap gap-2">
                  {draftMode === "edit" && draft.id ? (
                    <button
                      type="button"
                      onClick={() => toggleEmployeeStatus(draft.id)}
                      disabled={isPending}
                      className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                    >
                      {draft.active ? <UserMinusIcon className="h-4 w-4" /> : <UserPlusIcon className="h-4 w-4" />}
                      {draft.active ? "Deactivate" : "Reactivate"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={closeForm}
                    className="inline-flex h-10 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              ) : null}
            </div>

            {panelError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {panelError}
              </div>
            ) : null}

            {draft ? (
              <div className="mt-6 space-y-8">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div className="font-medium text-slate-700">
                      Status: <span className={draft.active ? "text-emerald-700" : "text-slate-600"}>{draft.active ? "Active" : "Inactive"}</span>
                    </div>
                    <div className="text-slate-500">
                      {isPending ? "Saving..." : `Last updated ${draft.updatedAt ? formatTimestamp(draft.updatedAt) : "not yet saved"}`}
                    </div>
                  </div>
                  {!draft.active ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      This employee is inactive. The record stays available for history, compliance review, and future reactivation.
                    </div>
                  ) : null}
                </div>

                <div>
                  <SectionTitle title="Core details" description="Capture the identity and day-to-day operational role for this employee." />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="First name" required error={errors.firstName}>
                      <Input disabled={isPending} value={draft.firstName} onChange={(value) => updateDraft("firstName", value)} error={errors.firstName} />
                    </Field>
                    <Field label="Last name" required error={errors.lastName}>
                      <Input disabled={isPending} value={draft.lastName} onChange={(value) => updateDraft("lastName", value)} error={errors.lastName} />
                    </Field>
                    <Field label="Employee ID" required error={errors.employeeId}>
                      <Input
                        disabled={isPending}
                        value={draft.employeeId}
                        onChange={(value) => updateDraft("employeeId", normalizeEmployeeCodeInput(value))}
                        error={errors.employeeId}
                      />
                    </Field>
                    <Field label="Job title / role" required error={errors.jobTitle}>
                      <Input disabled={isPending} value={draft.jobTitle} onChange={(value) => updateDraft("jobTitle", value)} error={errors.jobTitle} />
                    </Field>
                    <Field label="Role key">
                      <Select
                        disabled={isPending}
                        value={draft.roleKey}
                        onChange={(value) => updateDraft("roleKey", value as EmployeeRecord["roleKey"])}
                      >
                        <option value="">None</option>
                        {employeeRoleOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Preferred contact method">
                      <Select
                        disabled={isPending}
                        value={draft.preferredContactMethod}
                        onChange={(value) => updateDraft("preferredContactMethod", value as EmployeeRecord["preferredContactMethod"])}
                      >
                        {preferredContactMethodOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Date of birth" required error={errors.dateOfBirth}>
                      <Input disabled={isPending} type="date" value={draft.dateOfBirth} onChange={(value) => updateDraft("dateOfBirth", value)} error={errors.dateOfBirth} />
                    </Field>
                    <Field label="Hire date" required error={errors.hireDate}>
                      <Input disabled={isPending} type="date" value={draft.hireDate} onChange={(value) => updateDraft("hireDate", value)} error={errors.hireDate} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Contact and address" description="Keep the primary routing and emergency contact details easy to review from one place." />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Street address" required error={errors.streetAddress}>
                      <Input disabled={isPending} value={draft.streetAddress} onChange={(value) => updateDraft("streetAddress", value)} error={errors.streetAddress} />
                    </Field>
                    <Field label="City" required error={errors.city}>
                      <Input disabled={isPending} value={draft.city} onChange={(value) => updateDraft("city", value)} error={errors.city} />
                    </Field>
                    <Field label="State" required error={errors.state}>
                      <Input
                        disabled={isPending}
                        value={draft.state}
                        onChange={(value) => updateDraft("state", normalizeStateInput(value))}
                        maxLength={2}
                        error={errors.state}
                      />
                    </Field>
                    <Field label="ZIP" required error={errors.zip}>
                      <Input
                        disabled={isPending}
                        value={draft.zip}
                        onChange={(value) => updateDraft("zip", normalizeZipInput(value))}
                        maxLength={5}
                        error={errors.zip}
                      />
                    </Field>
                    <Field label="Phone number" required error={errors.phone}>
                      <Input disabled={isPending} value={draft.phone} onChange={(value) => updateDraft("phone", normalizePhoneInput(value))} error={errors.phone} />
                    </Field>
                    <Field label="Optional second phone" error={errors.secondPhone}>
                      <Input disabled={isPending} value={draft.secondPhone} onChange={(value) => updateDraft("secondPhone", normalizePhoneInput(value))} error={errors.secondPhone} />
                    </Field>
                    <Field label="Email" required error={errors.email}>
                      <Input
                        disabled={isPending}
                        type="email"
                        value={draft.email}
                        onChange={(value) => updateDraft("email", normalizeEmailInput(value))}
                        error={errors.email}
                      />
                    </Field>
                    <Field label="Emergency contact name" required error={errors.emergencyContactName}>
                      <Input
                        disabled={isPending}
                        value={draft.emergencyContactName}
                        onChange={(value) => updateDraft("emergencyContactName", value)}
                        error={errors.emergencyContactName}
                      />
                    </Field>
                    <Field label="Emergency contact phone" required error={errors.emergencyContactPhone}>
                      <Input
                        disabled={isPending}
                        value={draft.emergencyContactPhone}
                        onChange={(value) => updateDraft("emergencyContactPhone", normalizePhoneInput(value))}
                        error={errors.emergencyContactPhone}
                      />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Driver's license and notes" description="Surface license coverage and operational notes without turning this into HR software." />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="License number" required error={errors.licenseNumber}>
                      <Input disabled={isPending} value={draft.licenseNumber} onChange={(value) => updateDraft("licenseNumber", value.toUpperCase())} error={errors.licenseNumber} />
                    </Field>
                    <Field label="License state" required error={errors.licenseState}>
                      <Input
                        disabled={isPending}
                        value={draft.licenseState}
                        onChange={(value) => updateDraft("licenseState", normalizeStateInput(value))}
                        maxLength={2}
                        error={errors.licenseState}
                      />
                    </Field>
                    <Field label="License class / type" required error={errors.licenseClass}>
                      <Input disabled={isPending} value={draft.licenseClass} onChange={(value) => updateDraft("licenseClass", value)} error={errors.licenseClass} />
                    </Field>
                    <Field label="Expiration date" required error={errors.licenseExpiration}>
                      <Input
                        disabled={isPending}
                        type="date"
                        value={draft.licenseExpiration}
                        onChange={(value) => updateDraft("licenseExpiration", value)}
                        error={errors.licenseExpiration}
                      />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Notes">
                        <Textarea disabled={isPending} value={draft.notes} onChange={(value) => updateDraft("notes", value)} />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                    <CheckCircleIcon className="h-4 w-4" />
                    Inactive employees are retained rather than removed.
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={closeForm}
                      className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveDraft}
                      disabled={isPending}
                      className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {isPending ? "Saving..." : draftMode === "create" ? "Create employee" : "Save changes"}
                    </button>
                  </div>
                </div>
              </div>
            ) : selectedEmployee ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xl font-semibold text-slate-900">{selectedEmployee.firstName} {selectedEmployee.lastName}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {selectedEmployee.jobTitle} • {selectedEmployee.employeeId || "No employee ID"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditForm(selectedEmployee)}
                      className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                      Edit record
                    </button>
                  </div>
                  {!selectedEmployee.active ? (
                    <div className="mt-4 flex items-start gap-3 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                      <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <div className="font-semibold">Inactive employee record</div>
                        <div className="mt-1">
                          {selectedEmployee.deactivationReason
                            ? `${selectedEmployee.deactivationReason}${selectedEmployee.deactivatedAt ? ` • ${formatTimestamp(selectedEmployee.deactivatedAt)}` : ""}`
                            : "This record has been soft-deactivated and remains available for review and reactivation."}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <dl className="grid gap-4 sm:grid-cols-2">
                  {[
                    ["Phone", formatPhone(selectedEmployee.phone)],
                    ["Email", selectedEmployee.email],
                    ["Address", `${selectedEmployee.city}, ${selectedEmployee.state} ${selectedEmployee.zip}`],
                    ["License", `${selectedEmployee.licenseState} ${selectedEmployee.licenseClass}`],
                    ["License expiration", formatDate(selectedEmployee.licenseExpiration)],
                    ["Preferred contact", selectedEmployee.preferredContactMethod],
                    ["Role key", selectedEmployee.roleKey ? getEmployeeRoleLabel(selectedEmployee.roleKey) : "—"],
                    ["Emergency contact", `${selectedEmployee.emergencyContactName} • ${formatPhone(selectedEmployee.emergencyContactPhone)}`],
                    ["Last updated", formatTimestamp(selectedEmployee.updatedAt)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
                      <dd className="mt-2 text-sm font-medium text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <div className="text-sm font-semibold text-slate-900">Notes</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {selectedEmployee.notes || "No notes added yet."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">
                Select an employee to review details, or start a new employee record for this business.
              </div>
            )}
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-slate-50/80 p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Data status</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Employees now load from the tenant-scoped Supabase `business_employees` table. Records are business-owned, soft-deactivated instead of deleted, and ready for future auth-user linking without requiring login access today.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
