"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon, UserMinusIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { adminToast } from "@/app/admin/_components/admin/admin-toast";
import {
  createEmptyEmployee,
  employeeRoleOptions,
  formatPhone,
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
  description?: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
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
        error ? "border-rose-300 focus:border-rose-400" : "border-slate-300 focus:border-[#F97316]",
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
        error ? "border-rose-300 focus:border-rose-400" : "border-slate-300 focus:border-[#F97316]",
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

function formatPhoneInputValue(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length === 0) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

type EmployeeDetailClientProps = {
  mode: "create" | "edit";
  initialEmployee?: EmployeeRecord | null;
};

export function EmployeeDetailClient({
  mode,
  initialEmployee,
}: EmployeeDetailClientProps) {
  const router = useRouter();
  const startingEmployee = initialEmployee ?? createEmptyEmployee();
  const [savedEmployee, setSavedEmployee] = useState<EmployeeRecord>(startingEmployee);
  const [draft, setDraft] = useState<EmployeeRecord>(startingEmployee);
  const [errors, setErrors] = useState<EmployeeFormErrors>({});
  const [panelError, setPanelError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const employeeName = `${draft.firstName} ${draft.lastName}`.trim() || "New employee";
  const isCreateMode = mode === "create";
  const hasUnsavedChanges =
    JSON.stringify(normalizeEmployeeMutationInput(toEmployeeMutationInput(draft))) !==
    JSON.stringify(normalizeEmployeeMutationInput(toEmployeeMutationInput(savedEmployee)));

  function updateDraft<K extends keyof EmployeeRecord>(key: K, value: EmployeeRecord[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({
      ...current,
      [key as keyof EmployeeFormErrors]: undefined,
    }));
    setPanelError(null);
  }

  function resetDraft() {
    if (isCreateMode) {
      router.push("/admin/employees");
      return;
    }

    setDraft(savedEmployee);
    setErrors({});
    setPanelError(null);
  }

  function saveDraft() {
    const payload = normalizeEmployeeMutationInput(toEmployeeMutationInput(draft));
    const nextErrors = validateEmployee(payload, { requireEmployeeId: !isCreateMode });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setPanelError("Please review the highlighted fields before saving.");
      adminToast.error("Please review the employee form.");
      return;
    }

    startTransition(async () => {
      const result = isCreateMode
        ? await createEmployeeAction(payload)
        : await updateEmployeeAction(draft.id, payload);

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setPanelError(result.error);
        adminToast.error(result.error);
        return;
      }

      setSavedEmployee(result.employee);
      setDraft(result.employee);
      setErrors({});
      setPanelError(null);

      if (isCreateMode) {
        router.push(`/admin/employees/${result.employee.id}?saved=created`);
        return;
      }

      router.replace(`/admin/employees/${result.employee.id}?saved=updated`);
    });
  }

  function toggleEmployeeStatus() {
    if (isCreateMode) return;

    const confirmed = draft.active
      ? window.confirm(
          `Move ${draft.firstName} ${draft.lastName} to inactive? This keeps the record and history but removes the employee from the default active roster.`,
        )
      : window.confirm(
          `Reactivate ${draft.firstName} ${draft.lastName}? This will return the employee to the active roster.`,
        );

    if (!confirmed) return;

    startTransition(async () => {
      const result = draft.active
        ? await deactivateEmployeeAction(draft.id)
        : await reactivateEmployeeAction(draft.id);

      if (!result.ok) {
        setPanelError(result.error);
        adminToast.error(result.error);
        return;
      }

      setSavedEmployee(result.employee);
      setDraft(result.employee);
      setPanelError(null);
      router.replace(
        `/admin/employees/${result.employee.id}?saved=${result.employee.active ? "reactivated" : "deactivated"}`,
      );
    });
  }

  return (
    <div className="space-y-6">
      {!isCreateMode ? (
        <section className="space-y-3">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Employee Details</div>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  {employeeName}
                </h1>
                <span
                  className={[
                    "inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1",
                    draft.active
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-amber-50 text-amber-800 ring-amber-200",
                  ].join(" ")}
                >
                  {draft.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                <span>{draft.jobTitle || "Add a job title"}</span>
                <span className="text-slate-300" aria-hidden="true">
                  |
                </span>
                <span>{draft.email || "No email"}</span>
                <span className="text-slate-300" aria-hidden="true">
                  |
                </span>
                <span>{draft.phone ? formatPhone(draft.phone) : "No phone"}</span>
                <span className="text-slate-300" aria-hidden="true">
                  |
                </span>
                <span>{draft.employeeId || "No employee ID yet"}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <button
                type="button"
                onClick={toggleEmployeeStatus}
                disabled={isPending}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                {draft.active ? <UserMinusIcon className="h-4 w-4" /> : <UserPlusIcon className="h-4 w-4" />}
                {draft.active ? "Deactivate" : "Reactivate"}
              </button>
              {hasUnsavedChanges ? (
                <button
                  type="button"
                  onClick={resetDraft}
                  disabled={isPending}
                  className="inline-flex h-10 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  Reset changes
                </button>
              ) : null}
              <button
                type="button"
                onClick={saveDraft}
                disabled={isPending}
                className="inline-flex h-10 items-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isPending ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {panelError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {panelError}
        </div>
      ) : null}

      {!draft.active ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This employee is inactive. The record stays available for history, compliance review, and future reactivation.
        </div>
      ) : null}

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <SectionTitle title="Employee details" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="First name" required error={errors.firstName}>
            <Input
              disabled={isPending}
              value={draft.firstName}
              onChange={(value) => updateDraft("firstName", value)}
              error={errors.firstName}
            />
          </Field>
          <Field label="Last name" required error={errors.lastName}>
            <Input
              disabled={isPending}
              value={draft.lastName}
              onChange={(value) => updateDraft("lastName", value)}
              error={errors.lastName}
            />
          </Field>
          <Field label="Employee ID" error={errors.employeeId}>
            <Input
              disabled={isPending || isCreateMode}
              value={draft.employeeId}
              onChange={(value) => updateDraft("employeeId", normalizeEmployeeCodeInput(value))}
              placeholder={isCreateMode ? "Auto-generated" : undefined}
              error={errors.employeeId}
            />
          </Field>
          <Field label="Job title / role" error={errors.jobTitle}>
            <Input
              disabled={isPending}
              value={draft.jobTitle}
              onChange={(value) => updateDraft("jobTitle", value)}
              error={errors.jobTitle}
            />
          </Field>
          <Field label="Role key">
            <Select
              disabled={isPending}
              value={draft.roleKey}
              onChange={(value) => updateDraft("roleKey", value as EmployeeRecord["roleKey"])}
            >
              <option value="">None</option>
              {employeeRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Preferred contact method">
            <Select
              disabled={isPending}
              value={draft.preferredContactMethod}
              onChange={(value) =>
                updateDraft("preferredContactMethod", value as EmployeeRecord["preferredContactMethod"])
              }
            >
              {preferredContactMethodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date of birth" required error={errors.dateOfBirth}>
            <Input
              disabled={isPending}
              type="date"
              value={draft.dateOfBirth}
              onChange={(value) => updateDraft("dateOfBirth", value)}
              error={errors.dateOfBirth}
            />
          </Field>
          <Field label="Hire date" error={errors.hireDate}>
            <Input
              disabled={isPending}
              type="date"
              value={draft.hireDate}
              onChange={(value) => updateDraft("hireDate", value)}
              error={errors.hireDate}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <SectionTitle title="Contact and address" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Street address" required error={errors.streetAddress}>
            <Input
              disabled={isPending}
              value={draft.streetAddress}
              onChange={(value) => updateDraft("streetAddress", value)}
              error={errors.streetAddress}
            />
          </Field>
          <Field label="City" required error={errors.city}>
            <Input
              disabled={isPending}
              value={draft.city}
              onChange={(value) => updateDraft("city", value)}
              error={errors.city}
            />
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
            <Input
              disabled={isPending}
              value={formatPhoneInputValue(draft.phone)}
              onChange={(value) => updateDraft("phone", normalizePhoneInput(formatPhoneInputValue(value)))}
              error={errors.phone}
            />
          </Field>
          <Field label="Optional second phone" error={errors.secondPhone}>
            <Input
              disabled={isPending}
              value={formatPhoneInputValue(draft.secondPhone)}
              onChange={(value) => updateDraft("secondPhone", normalizePhoneInput(formatPhoneInputValue(value)))}
              error={errors.secondPhone}
            />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input
              disabled={isPending}
              type="email"
              value={draft.email}
              onChange={(value) => updateDraft("email", normalizeEmailInput(value))}
              error={errors.email}
            />
          </Field>
          <div className="hidden md:block" aria-hidden="true" />
          <Field label="Emergency contact name" error={errors.emergencyContactName}>
            <Input
              disabled={isPending}
              value={draft.emergencyContactName}
              onChange={(value) => updateDraft("emergencyContactName", value)}
              error={errors.emergencyContactName}
            />
          </Field>
          <Field label="Emergency contact phone" error={errors.emergencyContactPhone}>
            <Input
              disabled={isPending}
              value={formatPhoneInputValue(draft.emergencyContactPhone)}
              onChange={(value) =>
                updateDraft("emergencyContactPhone", normalizePhoneInput(formatPhoneInputValue(value)))
              }
              error={errors.emergencyContactPhone}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <SectionTitle title="Driver's license and notes" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="License number" error={errors.licenseNumber}>
            <Input
              disabled={isPending}
              value={draft.licenseNumber}
              onChange={(value) => updateDraft("licenseNumber", value.toUpperCase())}
              error={errors.licenseNumber}
            />
          </Field>
          <Field label="License state" error={errors.licenseState}>
            <Input
              disabled={isPending}
              value={draft.licenseState}
              onChange={(value) => updateDraft("licenseState", normalizeStateInput(value))}
              maxLength={2}
              error={errors.licenseState}
            />
          </Field>
          <Field label="License class / type" error={errors.licenseClass}>
            <Input
              disabled={isPending}
              value={draft.licenseClass}
              onChange={(value) => updateDraft("licenseClass", value)}
              error={errors.licenseClass}
            />
          </Field>
          <Field label="Expiration date" error={errors.licenseExpiration}>
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

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
            <CheckCircleIcon className="h-4 w-4" />
            Inactive employees are retained rather than removed.
          </div>
          {isCreateMode ? (
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetDraft}
                disabled={isPending}
                className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDraft}
                disabled={isPending}
                className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isPending ? "Saving..." : "Create employee"}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {!isCreateMode ? (
        <div className="flex justify-end">
          <div className="flex flex-wrap gap-2">
            {hasUnsavedChanges ? (
              <button
                type="button"
                onClick={resetDraft}
                disabled={isPending}
                className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                Reset changes
              </button>
            ) : null}
            <button
              type="button"
              onClick={saveDraft}
              disabled={isPending}
              className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isPending ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
