"use client";

import { useMemo, useState } from "react";
import {
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  UserMinusIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import {
  createEmptyEmployee,
  createMockEmployees,
  employeeStatusTagOptions,
  preferredContactMethodOptions,
  type EmployeeRecord,
} from "@/lib/admin/employees";

type EmployeeFormErrors = Partial<Record<keyof EmployeeRecord, string>>;

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value || "—";
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(`${value}T12:00:00`));
}

function formatTimestamp(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function normalizePhoneInput(value: string) {
  return value.replace(/[^\d()+\-\s]/g, "");
}

function normalizeZipInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 5);
}

function validateEmployee(employee: EmployeeRecord) {
  const errors: EmployeeFormErrors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneDigits = employee.phone.replace(/\D/g, "");
  const secondPhoneDigits = employee.secondPhone.replace(/\D/g, "");
  const emergencyPhoneDigits = employee.emergencyContactPhone.replace(/\D/g, "");

  if (!employee.firstName.trim()) errors.firstName = "First name is required.";
  if (!employee.lastName.trim()) errors.lastName = "Last name is required.";
  if (!employee.employeeId.trim()) errors.employeeId = "Employee ID is required.";
  if (!employee.streetAddress.trim()) errors.streetAddress = "Street address is required.";
  if (!employee.city.trim()) errors.city = "City is required.";
  if (!employee.state.trim()) errors.state = "State is required.";
  if (employee.state.trim().length !== 2) errors.state = "Use a 2-letter state code.";
  if (employee.zip.trim().length !== 5) errors.zip = "ZIP must be 5 digits.";
  if (!employee.jobTitle.trim()) errors.jobTitle = "Job title is required.";
  if (phoneDigits.length !== 10) errors.phone = "Phone must be 10 digits.";
  if (employee.secondPhone && secondPhoneDigits.length !== 10) errors.secondPhone = "Second phone must be 10 digits.";
  if (!emailPattern.test(employee.email.trim())) errors.email = "Enter a valid email address.";
  if (!employee.dateOfBirth) errors.dateOfBirth = "Date of birth is required.";
  if (!employee.hireDate) errors.hireDate = "Hire date is required.";
  if (!employee.licenseNumber.trim()) errors.licenseNumber = "License number is required.";
  if (!employee.licenseState.trim()) errors.licenseState = "License state is required.";
  if (employee.licenseState.trim().length !== 2) errors.licenseState = "Use a 2-letter state code.";
  if (!employee.licenseClass.trim()) errors.licenseClass = "License class is required.";
  if (!employee.licenseExpiration) errors.licenseExpiration = "License expiration is required.";
  if (!employee.emergencyContactName.trim()) errors.emergencyContactName = "Emergency contact name is required.";
  if (emergencyPhoneDigits.length !== 10) errors.emergencyContactPhone = "Emergency contact phone must be 10 digits.";

  return errors;
}

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
  children: React.ReactNode;
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
}: {
  value: string;
  onChange: (nextValue: string) => void;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  error?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={[
        "h-11 w-full rounded-2xl border bg-white px-4 text-sm text-slate-900 outline-none transition",
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
}: {
  value: string;
  onChange: (nextValue: string) => void;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={[
        "h-11 w-full rounded-2xl border bg-white px-4 text-sm text-slate-900 outline-none transition",
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
}: {
  value: string;
  onChange: (nextValue: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={4}
      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#F97316]"
    />
  );
}

export function EmployeesClient() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>(() => createMockEmployees());
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [draft, setDraft] = useState<EmployeeRecord | null>(null);
  const [draftMode, setDraftMode] = useState<"create" | "edit">("create");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [errors, setErrors] = useState<EmployeeFormErrors>({});

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

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
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((left, right) => {
        if (left.active !== right.active) return left.active ? -1 : 1;
        return `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`);
      });
  }, [employees, includeInactive, search]);

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

  function openCreateForm() {
    setDraft(createEmptyEmployee());
    setDraftMode("create");
    setErrors({});
    setSelectedEmployeeId(null);
  }

  function openEditForm(employee: EmployeeRecord) {
    setDraft({ ...employee });
    setDraftMode("edit");
    setErrors({});
    setSelectedEmployeeId(employee.id);
  }

  function openReview(employeeId: string) {
    setSelectedEmployeeId(employeeId);
    setDraft(null);
    setErrors({});
  }

  function closeForm() {
    setDraft(null);
    setErrors({});
  }

  function updateDraft<K extends keyof EmployeeRecord>(key: K, value: EmployeeRecord[K]) {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function saveDraft() {
    if (!draft) return;
    const nextErrors = validateEmployee(draft);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const now = new Date().toISOString();
    if (draftMode === "create") {
      const created: EmployeeRecord = {
        ...draft,
        id: `emp_${crypto.randomUUID()}`,
        updatedAt: now,
      };
      setEmployees((current) => [created, ...current]);
      setSelectedEmployeeId(created.id);
      setDraft({ ...created });
      setDraftMode("edit");
      return;
    }

    const saved = { ...draft, updatedAt: now };
    setEmployees((current) => current.map((employee) => (employee.id === saved.id ? saved : employee)));
    setSelectedEmployeeId(saved.id);
    setDraft(saved);
  }

  function toggleEmployeeStatus(employeeId: string) {
    setEmployees((current) =>
      current.map((employee) =>
        employee.id === employeeId
          ? { ...employee, active: !employee.active, updatedAt: new Date().toISOString() }
          : employee,
      ),
    );

    setDraft((current) =>
      current && current.id === employeeId
        ? { ...current, active: !current.active, updatedAt: new Date().toISOString() }
        : current,
    );
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
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-orange-600"
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
        </div>
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
                <div className="text-lg font-semibold text-slate-900">No employees match the current view</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Adjust the search or include inactive employees to expand the roster. You can also start a new record from here.
                </p>
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="mt-6 inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Add employee
                </button>
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
                      <tr key={employee.id} className={isSelected ? "bg-orange-50/40" : "bg-white"}>
                        <td className="px-6 py-4 sm:px-8">
                          <button
                            type="button"
                            onClick={() => openReview(employee.id)}
                            className="text-left font-semibold text-slate-900 underline-offset-4 hover:underline"
                          >
                            {employee.firstName} {employee.lastName}
                          </button>
                          <div className="mt-1 text-xs text-slate-500">
                            {employee.employeeId}
                            {employee.statusTag ? <> • {employee.statusTag}</> : null}
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
                                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
                            ].join(" ")}
                          >
                            {employee.active ? "Active" : "Inactive"}
                          </span>
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
                      className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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

            {draft ? (
              <div className="mt-6 space-y-8">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div className="font-medium text-slate-700">
                      Status: <span className={draft.active ? "text-emerald-700" : "text-slate-600"}>{draft.active ? "Active" : "Inactive"}</span>
                    </div>
                    <div className="text-slate-500">Last updated {draft.updatedAt ? formatTimestamp(draft.updatedAt) : "not yet saved"}</div>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Core details" description="Capture the identity and day-to-day operational role for this employee." />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="First name" required error={errors.firstName}>
                      <Input value={draft.firstName} onChange={(value) => updateDraft("firstName", value)} error={errors.firstName} />
                    </Field>
                    <Field label="Last name" required error={errors.lastName}>
                      <Input value={draft.lastName} onChange={(value) => updateDraft("lastName", value)} error={errors.lastName} />
                    </Field>
                    <Field label="Employee ID" required error={errors.employeeId}>
                      <Input value={draft.employeeId} onChange={(value) => updateDraft("employeeId", value.toUpperCase())} error={errors.employeeId} />
                    </Field>
                    <Field label="Job title / role" required error={errors.jobTitle}>
                      <Input value={draft.jobTitle} onChange={(value) => updateDraft("jobTitle", value)} error={errors.jobTitle} />
                    </Field>
                    <Field label="Status tag">
                      <Select value={draft.statusTag} onChange={(value) => updateDraft("statusTag", value as EmployeeRecord["statusTag"])}>
                        <option value="">None</option>
                        {employeeStatusTagOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Preferred contact method">
                      <Select
                        value={draft.preferredContactMethod}
                        onChange={(value) => updateDraft("preferredContactMethod", value as EmployeeRecord["preferredContactMethod"])}
                      >
                        {preferredContactMethodOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Date of birth" required error={errors.dateOfBirth}>
                      <Input type="date" value={draft.dateOfBirth} onChange={(value) => updateDraft("dateOfBirth", value)} error={errors.dateOfBirth} />
                    </Field>
                    <Field label="Hire date" required error={errors.hireDate}>
                      <Input type="date" value={draft.hireDate} onChange={(value) => updateDraft("hireDate", value)} error={errors.hireDate} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Contact and address" description="Keep the primary routing and emergency contact details easy to review from one place." />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Street address" required error={errors.streetAddress}>
                      <Input value={draft.streetAddress} onChange={(value) => updateDraft("streetAddress", value)} error={errors.streetAddress} />
                    </Field>
                    <Field label="City" required error={errors.city}>
                      <Input value={draft.city} onChange={(value) => updateDraft("city", value)} error={errors.city} />
                    </Field>
                    <Field label="State" required error={errors.state}>
                      <Input value={draft.state} onChange={(value) => updateDraft("state", value.toUpperCase().slice(0, 2))} maxLength={2} error={errors.state} />
                    </Field>
                    <Field label="ZIP" required error={errors.zip}>
                      <Input value={draft.zip} onChange={(value) => updateDraft("zip", normalizeZipInput(value))} maxLength={5} error={errors.zip} />
                    </Field>
                    <Field label="Phone number" required error={errors.phone}>
                      <Input value={draft.phone} onChange={(value) => updateDraft("phone", normalizePhoneInput(value))} error={errors.phone} />
                    </Field>
                    <Field label="Optional second phone" error={errors.secondPhone}>
                      <Input value={draft.secondPhone} onChange={(value) => updateDraft("secondPhone", normalizePhoneInput(value))} error={errors.secondPhone} />
                    </Field>
                    <Field label="Email" required error={errors.email}>
                      <Input type="email" value={draft.email} onChange={(value) => updateDraft("email", value)} error={errors.email} />
                    </Field>
                    <Field label="Emergency contact name" required error={errors.emergencyContactName}>
                      <Input value={draft.emergencyContactName} onChange={(value) => updateDraft("emergencyContactName", value)} error={errors.emergencyContactName} />
                    </Field>
                    <Field label="Emergency contact phone" required error={errors.emergencyContactPhone}>
                      <Input
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
                      <Input value={draft.licenseNumber} onChange={(value) => updateDraft("licenseNumber", value.toUpperCase())} error={errors.licenseNumber} />
                    </Field>
                    <Field label="License state" required error={errors.licenseState}>
                      <Input
                        value={draft.licenseState}
                        onChange={(value) => updateDraft("licenseState", value.toUpperCase().slice(0, 2))}
                        maxLength={2}
                        error={errors.licenseState}
                      />
                    </Field>
                    <Field label="License class / type" required error={errors.licenseClass}>
                      <Input value={draft.licenseClass} onChange={(value) => updateDraft("licenseClass", value)} error={errors.licenseClass} />
                    </Field>
                    <Field label="Expiration date" required error={errors.licenseExpiration}>
                      <Input
                        type="date"
                        value={draft.licenseExpiration}
                        onChange={(value) => updateDraft("licenseExpiration", value)}
                        error={errors.licenseExpiration}
                      />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Notes">
                        <Textarea value={draft.notes} onChange={(value) => updateDraft("notes", value)} />
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
                      className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {draftMode === "create" ? "Create employee" : "Save changes"}
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
                        {selectedEmployee.jobTitle} • {selectedEmployee.employeeId}
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
                </div>

                <dl className="grid gap-4 sm:grid-cols-2">
                  {[
                    ["Phone", formatPhone(selectedEmployee.phone)],
                    ["Email", selectedEmployee.email],
                    ["Address", `${selectedEmployee.city}, ${selectedEmployee.state} ${selectedEmployee.zip}`],
                    ["License", `${selectedEmployee.licenseState} ${selectedEmployee.licenseClass}`],
                    ["License expiration", formatDate(selectedEmployee.licenseExpiration)],
                    ["Preferred contact", selectedEmployee.preferredContactMethod],
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
                Select an employee to review details, or create a new record to get started.
              </div>
            )}
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-slate-50/80 p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Data status</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This first version uses typed local mock state so the page can be reviewed without introducing a one-off backend pattern. The entity shape is structured for a future business-managed employees table with soft deactivation rather than deletion.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
