"use client";

import type { ReactNode } from "react";
import type { Ref } from "react";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { trackerStatusOptions, type EquipmentTrackerStatus } from "@/lib/admin/equipment";

type TrackerConfigurationValue = {
  enabled: boolean;
  provider: string;
  trackerId: string;
  installationDate: string;
  lastCheckIn: string;
  status: EquipmentTrackerStatus | "";
  notes: string;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function Field({
  label,
  error,
  errorId,
  children,
}: {
  label: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium text-slate-700">{label}</div>
      {children}
      {error ? (
        <div id={errorId} className="mt-1 text-xs font-medium text-rose-600">
          {error}
        </div>
      ) : null}
    </label>
  );
}

const fieldInputClass =
  "h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#F97316] disabled:text-slate-900 disabled:opacity-100";
const fieldTextareaClass =
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#F97316] disabled:text-slate-900 disabled:opacity-100";
const fieldErrorClass = "border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-100";

export function TrackerConfigurationSection({
  mode,
  tracker,
  onChange,
  error,
  errorId,
  trackerIdRef,
  onEdit,
  onCancel,
  onSave,
  isSaving = false,
  saveLabel = "Save changes",
  saveDisabled = false,
  showCancel = false,
}: {
  mode: "view" | "edit";
  tracker: TrackerConfigurationValue;
  onChange?: <K extends keyof TrackerConfigurationValue>(key: K, value: TrackerConfigurationValue[K]) => void;
  error?: string;
  errorId?: string;
  trackerIdRef?: Ref<HTMLInputElement>;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  saveLabel?: string;
  saveDisabled?: boolean;
  showCancel?: boolean;
}) {
  const canEdit = mode === "edit" && onChange;

  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <WrenchScrewdriverIcon className="h-5 w-5" />
          Tracker configuration
        </div>
        {mode === "view" && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-10 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Edit tracker
          </button>
        ) : null}
      </div>

      {mode === "view" ? (
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Tracker enabled", tracker.enabled ? "Yes" : "No"],
            ["Tracker provider", tracker.provider || "—"],
            ["Tracker ID / device ID", tracker.trackerId || "—"],
            ["Installation date", tracker.installationDate || "—"],
            ["Last check-in / last seen", tracker.lastCheckIn || "—"],
            ["Tracker status", tracker.status || "—"],
            ["Tracker notes / troubleshooting", tracker.notes || "—"],
          ].map(([label, value]) => (
            <div
              key={label}
              className={joinClasses(
                "rounded-[24px] border border-slate-200 bg-white p-4",
                label === "Tracker notes / troubleshooting" && "sm:col-span-2 xl:col-span-3",
              )}
            >
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
              <dd className="mt-2 text-sm font-medium text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={tracker.enabled}
                onChange={(event) => onChange?.("enabled", event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
              />
              Tracker enabled
            </label>
            <Field label="Tracker provider">
              <input
                value={tracker.provider}
                onChange={(event) => onChange?.("provider", event.target.value)}
                className={fieldInputClass}
              />
            </Field>
            <Field label="Tracker ID / device ID" error={error} errorId={errorId}>
              <input
                value={tracker.trackerId}
                onChange={(event) => onChange?.("trackerId", event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                ref={trackerIdRef}
                className={joinClasses(fieldInputClass, error && fieldErrorClass)}
              />
            </Field>
            <Field label="Installation date">
              <input
                type="date"
                value={tracker.installationDate}
                onChange={(event) => onChange?.("installationDate", event.target.value)}
                className={fieldInputClass}
              />
            </Field>
            <Field label="Last check-in / last seen">
              <input
                type="datetime-local"
                value={tracker.lastCheckIn ? tracker.lastCheckIn.slice(0, 16) : ""}
                onChange={(event) =>
                  onChange?.("lastCheckIn", event.target.value ? new Date(event.target.value).toISOString() : "")
                }
                className={fieldInputClass}
              />
            </Field>
            <Field label="Tracker status">
              <select
                value={tracker.status}
                onChange={(event) => onChange?.("status", event.target.value as EquipmentTrackerStatus)}
                className={fieldInputClass}
              >
                {trackerStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Tracker notes / troubleshooting">
                <textarea
                  value={tracker.notes}
                  onChange={(event) => onChange?.("notes", event.target.value)}
                  rows={3}
                  className={fieldTextareaClass}
                />
              </Field>
            </div>
          </div>

          {onSave ? (
            <div className="mt-6 flex justify-end gap-2 pt-6">
              {showCancel && onCancel ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving || saveDisabled}
                className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : saveLabel}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
