"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import {
  ServiceDatesSection,
  type ServiceDateEditorState,
} from "@/app/admin/_components/admin/service-dates-section";
import { TrackerConfigurationSection } from "@/app/admin/_components/admin/tracker-configuration-section";
import { adminToast } from "@/app/admin/_components/admin/admin-toast";
import { validateDumpsterRecord } from "@/lib/admin/dumpster-inventory-shared";
import {
  createEmptyDumpster,
  dumpsterServiceDateTypeOptions,
  type DumpsterRecord,
  type DumpsterServiceDateRecord,
} from "@/lib/admin/equipment";
import { formatDateTimeLabelET } from "@/lib/time";

type DumpsterErrors = Partial<Record<keyof DumpsterRecord, string>>;
type DetailMode = "review" | "edit" | "create";
type TrackerSectionMode = "view" | "edit";
const fieldInputClass =
  "h-11 w-full rounded-[14px] border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#F97316] disabled:text-slate-900 disabled:opacity-100";
const fieldTextareaClass =
  "w-full rounded-[14px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#F97316] disabled:text-slate-900 disabled:opacity-100";
const fieldErrorClass = "border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-100";
const requiredFieldOrder: Array<"displayName" | "size" | "tracker"> = [
  "displayName",
  "size",
  "tracker",
];

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getSizeInputValue(size: string) {
  const trimmed = size.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/(\d+(?:\.\d+)?)/);
  return match ? match[1] : trimmed;
}

function formatDumpsterSize(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `${trimmed} yard`;
}

function parseDimensionParts(dimensions: string) {
  const trimmed = dimensions.trim();
  if (!trimmed) {
    return { length: "", width: "", height: "" };
  }

  const parts = trimmed.split(/\s*x\s*/i).map((part) => part.trim());
  const normalizePart = (part?: string) => (part ? part.replace(/'+$/g, "").trim() : "");

  return {
    length: normalizePart(parts[0]),
    width: normalizePart(parts[1]),
    height: normalizePart(parts[2]),
  };
}

function formatDimensionPart(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `${trimmed.replace(/'+$/g, "")}'`;
}

function combineDimensionParts({
  length,
  width,
  height,
}: {
  length: string;
  width: string;
  height: string;
}) {
  return [length, width, height].map(formatDimensionPart).filter(Boolean).join(" x ");
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

function sortServiceDates(records: DumpsterServiceDateRecord[]) {
  return [...records].sort((left, right) => {
    if (left.serviceDate !== right.serviceDate) {
      return right.serviceDate.localeCompare(left.serviceDate);
    }
    return right.createdAt.localeCompare(left.createdAt);
  });
}

function emptyServiceDateEditor(): ServiceDateEditorState {
  return {
    id: null,
    serviceDate: "",
    serviceType: "Inspection",
    notes: "",
  };
}

function Field({
  label,
  error,
  errorId,
  required = false,
  children,
}: {
  label: string;
  error?: string;
  errorId?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <FieldLabel label={label} required={required} />
      {children}
      {error ? (
        <div id={errorId} className="mt-1 text-xs font-medium text-rose-600">
          {error}
        </div>
      ) : null}
    </label>
  );
}

function FieldLabel({ label, tooltip, required = false }: { label: string; tooltip?: string; required?: boolean }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
      <span>
        {label}
        {required ? <span className="ml-1 text-rose-500" aria-hidden="true">*</span> : null}
      </span>
      {required ? <span className="sr-only">Required</span> : null}
      {tooltip ? (
        <button
          type="button"
          aria-label={`${label} details`}
          className="group relative rounded-full p-0.5 text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2"
        >
          <InformationCircleIcon className="h-4 w-4" aria-hidden="true" />
          <span
            role="tooltip"
            className="pointer-events-none absolute left-0 top-7 z-50 w-72 translate-y-1 rounded-[14px] border border-slate-200/90 bg-white px-3.5 py-2.5 text-left text-xs font-medium leading-5 text-slate-600 opacity-0 shadow-[0_16px_36px_rgba(15,23,42,0.14)] transition duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
          >
            {tooltip}
          </span>
        </button>
      ) : null}
    </div>
  );
}

export function DumpsterDetailClient({
  initialDumpster,
  initialMode,
  initialEquipmentId,
  initialServiceDates = [],
}: {
  initialDumpster: DumpsterRecord | null;
  initialMode: DetailMode;
  initialEquipmentId?: string;
  initialServiceDates?: DumpsterServiceDateRecord[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<DetailMode>(initialMode);
  const [dumpster, setDumpster] = useState<DumpsterRecord | null>(initialDumpster);
  const [draft, setDraft] = useState<DumpsterRecord>(
    initialMode === "create"
      ? { ...createEmptyDumpster(), equipmentId: initialEquipmentId ?? "" }
      : initialDumpster
        ? { ...initialDumpster, tracker: { ...initialDumpster.tracker } }
        : createEmptyDumpster(),
  );
  const [errors, setErrors] = useState<DumpsterErrors>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [serviceDates, setServiceDates] = useState<DumpsterServiceDateRecord[]>(
    sortServiceDates(initialServiceDates),
  );
  const [serviceDateEditor, setServiceDateEditor] = useState<ServiceDateEditorState | null>(null);
  const [serviceDateError, setServiceDateError] = useState<string | null>(null);
  const [isSavingServiceDate, setIsSavingServiceDate] = useState(false);
  const [serviceDateToDelete, setServiceDateToDelete] = useState<DumpsterServiceDateRecord | null>(null);
  const [isDeletingServiceDate, setIsDeletingServiceDate] = useState(false);
  const [trackerSectionMode, setTrackerSectionMode] = useState<TrackerSectionMode>("view");
  const fieldRefs = useRef<Partial<Record<"displayName" | "size" | "tracker", HTMLElement | null>>>({});

  function focusFirstError(nextErrors: DumpsterErrors) {
    const firstErrorKey = requiredFieldOrder.find((key) => nextErrors[key]);
    if (!firstErrorKey) return;

    requestAnimationFrame(() => {
      const target = fieldRefs.current[firstErrorKey];
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.focus();
    });
  }

  function registerFieldRef<Key extends "displayName" | "size" | "tracker">(key: Key) {
    return (element: HTMLElement | null) => {
      fieldRefs.current[key] = element;
    };
  }

  function beginEdit() {
    if (!dumpster) return;
    setDraft({ ...dumpster, tracker: { ...dumpster.tracker } });
    setErrors({});
    setHasSubmitted(false);
    setTrackerSectionMode("view");
    setMode("edit");
  }

  function beginTrackerEdit() {
    if (!dumpster) return;
    setDraft((current) => ({ ...current, tracker: { ...dumpster.tracker } }));
    setErrors((current) => ({ ...current, tracker: undefined }));
    setHasSubmitted(false);
    setTrackerSectionMode("edit");
  }

  function cancelTrackerEdit() {
    if (dumpster) {
      setDraft((current) => ({ ...current, tracker: { ...dumpster.tracker } }));
    }
    setErrors((current) => ({ ...current, tracker: undefined }));
    setHasSubmitted(false);
    setTrackerSectionMode("view");
  }

  function updateDraft<K extends keyof DumpsterRecord>(key: K, value: DumpsterRecord[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (hasSubmitted) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  function updateDimensionPart(key: "length" | "width" | "height", value: string) {
    const nextParts = { ...parseDimensionParts(draft.dimensions), [key]: value };
    updateDraft("dimensions", combineDimensionParts(nextParts));
  }

  function updateTracker<K extends keyof DumpsterRecord["tracker"]>(
    key: K,
    value: DumpsterRecord["tracker"][K],
  ) {
    setDraft((current) => ({ ...current, tracker: { ...current.tracker, [key]: value } }));
    if (hasSubmitted) {
      setErrors((current) => ({ ...current, tracker: undefined }));
    }
  }

  function beginAddServiceDate() {
    setServiceDateEditor(emptyServiceDateEditor());
    setServiceDateError(null);
  }

  function beginEditServiceDate(record: DumpsterServiceDateRecord) {
    setServiceDateEditor({
      id: record.id,
      serviceDate: record.serviceDate,
      serviceType: record.serviceType,
      notes: record.notes,
    });
    setServiceDateError(null);
  }

  function updateServiceDateEditor<K extends keyof ServiceDateEditorState>(
    key: K,
    value: ServiceDateEditorState[K],
  ) {
    setServiceDateEditor((current) => (current ? { ...current, [key]: value } : current));
    if (serviceDateError) {
      setServiceDateError(null);
    }
  }

  async function saveDraft() {
    setHasSubmitted(true);
    const nextErrors = validateDumpsterRecord(draft);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      focusFirstError(nextErrors);
      adminToast.error("Please review the highlighted fields below.");
      return false;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        mode === "create"
          ? "/api/admin/dumpsters"
          : `/api/admin/dumpsters/${encodeURIComponent(draft.id)}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dumpster: draft }),
        },
      );
      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok || !json?.dumpster) {
        const nextErrors = (json?.fieldErrors as DumpsterErrors | undefined) ?? {};
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
          focusFirstError(nextErrors);
        }
        adminToast.error(json?.error || "Could not save dumpster.");
        return false;
      }

      const saved = json.dumpster as DumpsterRecord;
      setDumpster(saved);
      setDraft({ ...saved, tracker: { ...saved.tracker } });

      if (mode === "create") {
        adminToast.success("Dumpster created.");
        router.replace(`/admin/equipment/dumpsters/${saved.id}?mode=edit`);
        return true;
      }

      router.refresh();
      adminToast.success("Dumpster updated.");
      return true;
    } catch (error) {
      adminToast.error(error instanceof Error ? error.message : "Could not save dumpster.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function saveTrackerSection() {
    const didSave = await saveDraft();
    if (didSave && mode === "review") {
      setTrackerSectionMode("view");
    }
  }

  async function saveServiceDate() {
    const targetDumpsterId = dumpster?.id ?? draft.id;
    if (!targetDumpsterId || !serviceDateEditor) return;

    if (!serviceDateEditor.serviceDate) {
      setServiceDateError("Date is required.");
      return;
    }

    setIsSavingServiceDate(true);

    try {
      const response = await fetch(
        serviceDateEditor.id
          ? `/api/admin/dumpster-service-dates/${encodeURIComponent(serviceDateEditor.id)}`
          : `/api/admin/dumpsters/${encodeURIComponent(targetDumpsterId)}/service-dates`,
        {
          method: serviceDateEditor.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceDate: {
              serviceDate: serviceDateEditor.serviceDate,
              serviceType: serviceDateEditor.serviceType,
              notes: serviceDateEditor.notes,
            },
          }),
        },
      );
      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok || !json?.serviceDate) {
        setServiceDateError(json?.error || "Could not save service date.");
        return;
      }

      const saved = json.serviceDate as DumpsterServiceDateRecord;
      setServiceDates((current) =>
        sortServiceDates([...current.filter((record) => record.id !== saved.id), saved]),
      );
      setServiceDateEditor(null);
      router.refresh();
      adminToast.success(serviceDateEditor.id ? "Service date updated." : "Service date added.");
    } catch (error) {
      setServiceDateError(error instanceof Error ? error.message : "Could not save service date.");
    } finally {
      setIsSavingServiceDate(false);
    }
  }

  async function toggleActive() {
    const target = dumpster ?? (mode !== "create" ? draft : null);
    if (!target?.id) return;

    setIsToggling(true);

    try {
      const response = await fetch(`/api/admin/dumpsters/${encodeURIComponent(target.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !target.active }),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok || !json?.dumpster) {
        adminToast.error(json?.error || "Could not update dumpster status.");
        return;
      }

      const saved = json.dumpster as DumpsterRecord;
      setDumpster(saved);
      setDraft({ ...saved, tracker: { ...saved.tracker } });
      router.refresh();
      adminToast.success(saved.active ? "Dumpster reactivated." : "Dumpster deactivated.");
    } catch (error) {
      adminToast.error(error instanceof Error ? error.message : "Could not update dumpster status.");
    } finally {
      setIsToggling(false);
    }
  }

  async function deleteServiceDate() {
    if (!serviceDateToDelete?.id) return;

    setIsDeletingServiceDate(true);

    try {
      const response = await fetch(
        `/api/admin/dumpster-service-dates/${encodeURIComponent(serviceDateToDelete.id)}`,
        { method: "DELETE" },
      );
      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok) {
        adminToast.error(json?.error || "Could not delete service date.");
        return;
      }

      setServiceDates((current) => current.filter((record) => record.id !== serviceDateToDelete.id));
      if (serviceDateEditor?.id === serviceDateToDelete.id) {
        setServiceDateEditor(null);
      }
      setServiceDateToDelete(null);
      router.refresh();
      adminToast.success("Service date deleted.");
    } catch (error) {
      adminToast.error(error instanceof Error ? error.message : "Could not delete service date.");
    } finally {
      setIsDeletingServiceDate(false);
    }
  }

  async function deleteDumpster() {
    const targetId = dumpster?.id ?? draft.id;
    if (!targetId) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/dumpsters/${encodeURIComponent(targetId)}`, {
        method: "DELETE",
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok) {
        adminToast.error(json?.error || "Could not delete dumpster.");
        return;
      }

      setIsDeleteDialogOpen(false);
      router.push("/admin/equipment/dumpsters?deleted=1");
    } catch (error) {
      adminToast.error(error instanceof Error ? error.message : "Could not delete dumpster.");
    } finally {
      setIsDeleting(false);
    }
  }

  const currentRecord = dumpster ?? draft;
  const dimensionParts = parseDimensionParts(draft.dimensions);
  const showServiceDates = mode !== "create" && Boolean(currentRecord.id);

  return (
    <>
      {mode === "review" && dumpster ? (
        <div className="space-y-6">
          <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">Dumpster details</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={beginEdit}
                  className="admin-btn admin-btn-secondary h-10 px-4"
                >
                  Edit dumpster
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="admin-btn admin-btn-destructive h-10 px-4"
                >
                  Delete dumpster
                </button>
                <button
                  type="button"
                  onClick={toggleActive}
                  disabled={isToggling}
                  className="admin-btn admin-btn-secondary h-10 px-4 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isToggling ? "Saving..." : dumpster.active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Dumpster location", dumpster.yardLocation || "—"],
                  ["Dimensions", dumpster.dimensions || "—"],
                  ["In service", formatDate(dumpster.inServiceDate)],
                  [
                    "Tracker",
                    dumpster.tracker.enabled
                      ? `${dumpster.tracker.status} • ${dumpster.tracker.trackerId || "No ID"}`
                      : "Not installed",
                  ],
                  ["Asset tag", dumpster.assetTag || "—"],
                  ["Serial number", dumpster.serialNumber || "—"],
                  ["Manufacturer", dumpster.manufacturer || "—"],
                  ["Model", dumpster.model || "—"],
                  ["Last updated", formatDateTimeLabelET(dumpster.updatedAt)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[14px] border border-slate-200 bg-white p-4">
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
                    <dd className="mt-2 text-sm font-medium text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="rounded-[14px] border border-slate-200 bg-white p-5">
                <div className="text-sm font-semibold text-slate-900">Notes</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {dumpster.notes || "No notes added yet."}
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">
                {mode === "create" ? "Dumpster details" : "Edit dumpster"}
              </div>
            </div>
            {mode !== "create" && dumpster?.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="admin-btn admin-btn-destructive h-10 px-4"
                >
                  Delete dumpster
                </button>
                <button
                  type="button"
                  onClick={toggleActive}
                  disabled={isToggling}
                  className="admin-btn admin-btn-secondary h-10 px-4 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isToggling ? "Saving..." : dumpster.active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-6">
            {hasSubmitted && Object.keys(errors).length > 0 ? (
              <div
                className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                role="alert"
              >
                <div className="font-semibold">Please fix the highlighted fields.</div>
                <div className="mt-1">
                  {requiredFieldOrder
                    .filter((key) => errors[key])
                    .map((key) => errors[key])
                    .join(" ")}
                </div>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Nickname"
                error={errors.displayName}
                errorId="dumpster-displayName-error"
                required
              >
                <input
                  value={draft.displayName}
                  onChange={(event) => updateDraft("displayName", event.target.value)}
                  aria-invalid={hasSubmitted && Boolean(errors.displayName)}
                  aria-describedby={hasSubmitted && errors.displayName ? "dumpster-displayName-error" : undefined}
                  ref={registerFieldRef("displayName") as React.Ref<HTMLInputElement>}
                  className={joinClasses(fieldInputClass, hasSubmitted && errors.displayName && fieldErrorClass)}
                />
              </Field>
              <Field label="Size (yards)" error={errors.size} errorId="dumpster-size-error" required>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={getSizeInputValue(draft.size)}
                  onChange={(event) =>
                    updateDraft("size", event.target.value ? formatDumpsterSize(event.target.value) : "")
                  }
                  aria-invalid={hasSubmitted && Boolean(errors.size)}
                  aria-describedby={hasSubmitted && errors.size ? "dumpster-size-error" : undefined}
                  ref={registerFieldRef("size") as React.Ref<HTMLInputElement>}
                  className={joinClasses(fieldInputClass, hasSubmitted && errors.size && fieldErrorClass)}
                />
              </Field>
              <label className="block">
                <FieldLabel
                  label="Asset tag"
                  tooltip="A physical sticker, plate, barcode, or QR code attached to the dumpster so staff can identify it in the yard or on a job site."
                />
                <input
                  value={draft.assetTag}
                  onChange={(event) => updateDraft("assetTag", event.target.value)}
                  placeholder="e.g. TAG-101"
                  className={fieldInputClass}
                />
              </label>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Length">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={dimensionParts.length}
                    onChange={(event) => updateDimensionPart("length", event.target.value)}
                    placeholder="e.g. 22"
                    className={fieldInputClass}
                  />
                </Field>
                <Field label="Width">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={dimensionParts.width}
                    onChange={(event) => updateDimensionPart("width", event.target.value)}
                    placeholder="e.g. 8"
                    className={fieldInputClass}
                  />
                </Field>
                <Field label="Height">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={dimensionParts.height}
                    onChange={(event) => updateDimensionPart("height", event.target.value)}
                    placeholder="e.g. 4.5"
                    className={fieldInputClass}
                  />
                </Field>
              </div>
              <Field label="Dumpster location">
                <input
                  value={draft.yardLocation}
                  onChange={(event) => updateDraft("yardLocation", event.target.value)}
                  className={fieldInputClass}
                />
              </Field>
              <Field label="In-service date">
                <input
                  type="date"
                  value={draft.inServiceDate}
                  onChange={(event) => updateDraft("inServiceDate", event.target.value)}
                  className={fieldInputClass}
                />
              </Field>
              <Field label="Serial number">
                <input
                  value={draft.serialNumber}
                  onChange={(event) => updateDraft("serialNumber", event.target.value)}
                  className={fieldInputClass}
                />
              </Field>
              <Field label="Manufacturer">
                <input
                  value={draft.manufacturer}
                  onChange={(event) => updateDraft("manufacturer", event.target.value)}
                  className={fieldInputClass}
                />
              </Field>
              <Field label="Model">
                <input
                  value={draft.model}
                  onChange={(event) => updateDraft("model", event.target.value)}
                  className={fieldInputClass}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Notes">
                  <textarea
                    value={draft.notes}
                    onChange={(event) => updateDraft("notes", event.target.value)}
                    rows={3}
                    className={fieldTextareaClass}
                  />
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div className="text-xs text-slate-500">
                Last updated {draft.updatedAt ? formatDateTimeLabelET(draft.updatedAt) : "not yet saved"}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (mode === "create") {
                      router.push("/admin/equipment/dumpsters");
                      return;
                    }
                    if (dumpster) {
                      setDraft({ ...dumpster, tracker: { ...dumpster.tracker } });
                    }
                    setErrors({});
                    setTrackerSectionMode("view");
                    setMode("review");
                  }}
                  className="admin-btn admin-btn-secondary h-11 px-5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={isSaving}
                  className="admin-btn admin-btn-primary h-11 px-5"
                >
                  {isSaving ? "Saving..." : mode === "create" ? "Create dumpster" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {showServiceDates ? (
        <ServiceDatesSection
          description="Track inspections, maintenance, repairs, and other service events for this dumpster."
          records={serviceDates}
          editor={serviceDateEditor}
          serviceDateError={serviceDateError}
          serviceTypeOptions={dumpsterServiceDateTypeOptions}
          onAdd={beginAddServiceDate}
          onEdit={(record) => beginEditServiceDate(record as DumpsterServiceDateRecord)}
          onDelete={(record) => setServiceDateToDelete(record as DumpsterServiceDateRecord)}
          onEditorChange={updateServiceDateEditor}
          onEditorCancel={() => {
            setServiceDateEditor(null);
            setServiceDateError(null);
          }}
          onEditorSave={saveServiceDate}
          formatDate={formatDate}
          isSaving={isSavingServiceDate}
          emptyMessage="No service dates have been logged yet."
        />
      ) : null}

      <TrackerConfigurationSection
        mode={mode === "review" && trackerSectionMode === "view" ? "view" : "edit"}
        tracker={{
          enabled:
            mode === "review" && trackerSectionMode === "view" ? currentRecord.tracker.enabled : draft.tracker.enabled,
          provider:
            mode === "review" && trackerSectionMode === "view" ? currentRecord.tracker.provider : draft.tracker.provider,
          trackerId:
            mode === "review" && trackerSectionMode === "view" ? currentRecord.tracker.trackerId : draft.tracker.trackerId,
          installationDate:
            mode === "review" && trackerSectionMode === "view"
              ? formatDate(currentRecord.tracker.installationDate)
              : draft.tracker.installationDate,
          lastCheckIn:
            mode === "review" && trackerSectionMode === "view"
              ? formatDateTimeLabelET(currentRecord.tracker.lastCheckIn)
              : draft.tracker.lastCheckIn,
          status:
            mode === "review" && trackerSectionMode === "view" ? currentRecord.tracker.status : draft.tracker.status,
          notes:
            mode === "review" && trackerSectionMode === "view" ? currentRecord.tracker.notes : draft.tracker.notes,
        }}
        onChange={
          mode === "review" && trackerSectionMode === "view"
            ? undefined
            : ((key, value) =>
                updateTracker(key as keyof DumpsterRecord["tracker"], value as DumpsterRecord["tracker"][keyof DumpsterRecord["tracker"]]))
        }
        error={errors.tracker}
        errorId="dumpster-tracker-error"
        trackerIdRef={registerFieldRef("tracker") as React.Ref<HTMLInputElement>}
        onEdit={mode === "review" && trackerSectionMode === "view" ? beginTrackerEdit : undefined}
        onCancel={mode === "review" ? cancelTrackerEdit : undefined}
        onSave={mode === "review" ? saveTrackerSection : saveDraft}
        isSaving={isSaving}
        saveLabel="Save changes"
        showCancel={mode === "review"}
      />

      {isDeleteDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md rounded-[14px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="text-lg font-semibold text-slate-900">Delete dumpster</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Are you sure you want to delete this dumpster?
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isDeleting}
                className="admin-btn admin-btn-secondary h-11 px-5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteDumpster}
                disabled={isDeleting}
                className="admin-btn admin-btn-destructive h-11 px-5"
              >
                {isDeleting ? "Deleting..." : "Confirm delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {serviceDateToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md rounded-[14px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="text-lg font-semibold text-slate-900">Delete service date</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Are you sure you want to delete the {serviceDateToDelete.serviceType.toLowerCase()} record from{" "}
              {formatDate(serviceDateToDelete.serviceDate)}?
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setServiceDateToDelete(null)}
                disabled={isDeletingServiceDate}
                className="admin-btn admin-btn-secondary h-11 px-5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteServiceDate}
                disabled={isDeletingServiceDate}
                className="admin-btn admin-btn-destructive h-11 px-5"
              >
                {isDeletingServiceDate ? "Deleting..." : "Confirm delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
