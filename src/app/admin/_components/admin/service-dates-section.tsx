"use client";

import { PencilSquareIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import {
  fleetEquipmentServiceDateTypeOptions,
  type ServiceDateType,
} from "@/lib/admin/equipment";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const fieldInputClass =
  "h-11 w-full rounded-[14px] border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#F97316] disabled:text-slate-900 disabled:opacity-100";
const fieldTextareaClass =
  "w-full rounded-[14px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#F97316] disabled:text-slate-900 disabled:opacity-100";
const fieldErrorClass = "border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-100";

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </div>
      {children}
    </label>
  );
}

export type ServiceDateRowRecord = {
  id: string;
  serviceDate: string;
  serviceType: ServiceDateType;
  notes: string;
};

export type ServiceDateEditorState = {
  id: string | null;
  serviceDate: string;
  serviceType: ServiceDateType;
  notes: string;
};

export function ServiceDatesSection({
  description,
  records,
  editor,
  serviceDateError,
  serviceTypeOptions,
  onAdd,
  onEdit,
  onDelete,
  onEditorChange,
  onEditorCancel,
  onEditorSave,
  formatDate,
  isSaving,
  emptyMessage,
  getStatusLabel,
  addDisabled = false,
  addDisabledReason,
}: {
  description: string;
  records: ServiceDateRowRecord[];
  editor: ServiceDateEditorState | null;
  serviceDateError: string | null;
  serviceTypeOptions?: readonly ServiceDateType[];
  onAdd?: () => void;
  onEdit?: (record: ServiceDateRowRecord) => void;
  onDelete?: (record: ServiceDateRowRecord) => void;
  onEditorChange: <K extends keyof ServiceDateEditorState>(key: K, value: ServiceDateEditorState[K]) => void;
  onEditorCancel: () => void;
  onEditorSave: () => void;
  formatDate: (value: string) => string;
  isSaving: boolean;
  emptyMessage: string;
  getStatusLabel?: (record: ServiceDateRowRecord) => "Current" | "Due soon" | "Overdue" | null;
  addDisabled?: boolean;
  addDisabledReason?: string;
}) {
  const showAddButton = Boolean(onAdd);
  const showRowActions = Boolean(onEdit && onDelete);
  const resolvedServiceTypeOptions = Array.isArray(serviceTypeOptions) && serviceTypeOptions.length > 0
    ? serviceTypeOptions
    : fleetEquipmentServiceDateTypeOptions;
  const showStatusColumn = Boolean(getStatusLabel);

  function statusPillClasses(status: "Current" | "Due soon" | "Overdue") {
    if (status === "Due soon") return "bg-amber-50 text-amber-700 ring-amber-200";
    if (status === "Overdue") return "bg-rose-50 text-rose-700 ring-rose-200";
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-900">Service dates</div>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {showAddButton ? (
          <button
            type="button"
            onClick={onAdd}
            disabled={addDisabled}
            title={addDisabledReason}
            className="admin-btn admin-btn-primary h-10 gap-2 px-4"
          >
            <PlusIcon className="h-4 w-4" />
            Add service date
          </button>
        ) : null}
      </div>

      <div className="mt-6 space-y-4">
        {records.length ? (
          <div className="overflow-hidden rounded-[14px] border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50/80">
                <tr className="text-left">
                  <th className="px-5 py-3 font-semibold uppercase tracking-[0.12em] text-slate-500">Date</th>
                  <th className="px-5 py-3 font-semibold uppercase tracking-[0.12em] text-slate-500">Type</th>
                  {showStatusColumn ? (
                    <th className="px-5 py-3 font-semibold uppercase tracking-[0.12em] text-slate-500">Status</th>
                  ) : null}
                  <th className="px-5 py-3 font-semibold uppercase tracking-[0.12em] text-slate-500">Notes</th>
                  {showRowActions ? <th className="px-5 py-3" aria-label="Actions" /> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {records.map((record) => {
                  const statusLabel = getStatusLabel?.(record) ?? null;
                  return (
                    <tr key={record.id}>
                      <td className="px-5 py-4 font-medium text-slate-900">{formatDate(record.serviceDate)}</td>
                      <td className="px-5 py-4 text-slate-600">{record.serviceType}</td>
                      {showStatusColumn ? (
                        <td className="px-5 py-4">
                          {statusLabel ? (
                            <span
                              className={[
                                "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                                statusPillClasses(statusLabel),
                              ].join(" ")}
                            >
                              {statusLabel}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      ) : null}
                      <td className="px-5 py-4 text-slate-600">{record.notes || "—"}</td>
                      {showRowActions ? (
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onEdit?.(record)}
                              className="admin-btn admin-btn-secondary h-9 gap-1 px-3"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete?.(record)}
                              className="admin-btn admin-btn-destructive h-9 gap-1 px-3"
                            >
                              <TrashIcon className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-[14px] border border-dashed border-slate-300 bg-slate-50/60 px-5 py-8 text-sm text-slate-500">
            {emptyMessage}
          </div>
        )}

        {editor ? (
          <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-5">
            <div className="text-sm font-semibold text-slate-900">
              {editor.id ? "Edit service date" : "Add service date"}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Date" required>
                <input
                  type="date"
                  value={editor.serviceDate}
                  onChange={(event) => onEditorChange("serviceDate", event.target.value)}
                  className={joinClasses(fieldInputClass, serviceDateError && !editor.serviceDate && fieldErrorClass)}
                />
              </Field>
              <Field label="Type" required>
                <select
                  value={editor.serviceType}
                  onChange={(event) =>
                    onEditorChange("serviceType", event.target.value as ServiceDateType)
                  }
                  className={fieldInputClass}
                >
                  {resolvedServiceTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Notes">
                  <textarea
                    value={editor.notes}
                    onChange={(event) => onEditorChange("notes", event.target.value)}
                    rows={3}
                    className={fieldTextareaClass}
                  />
                </Field>
              </div>
            </div>
            {serviceDateError ? (
              <div className="mt-3 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {serviceDateError}
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onEditorCancel}
                className="admin-btn admin-btn-secondary h-10 px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onEditorSave}
                disabled={isSaving}
                className="admin-btn admin-btn-primary h-10 px-4"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
