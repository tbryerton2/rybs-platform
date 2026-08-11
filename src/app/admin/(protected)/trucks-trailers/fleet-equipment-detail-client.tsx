"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ServiceDatesSection,
  type ServiceDateEditorState,
  type ServiceDateRowRecord,
} from "@/app/admin/_components/admin/service-dates-section";
import { TrackerConfigurationSection } from "@/app/admin/_components/admin/tracker-configuration-section";
import { adminToast } from "@/app/admin/_components/admin/admin-toast";
import { formatEnumLabel } from "@/lib/admin/enum-label";
import {
  createEmptyFleetEquipment,
  fleetEquipmentStatusOptions,
  fleetEquipmentTypeOptions,
  normalizeFleetEquipmentMutationInput,
  toFleetEquipmentMutationInput,
  validateFleetEquipment,
  type FleetEquipmentFormErrors,
  type FleetEquipmentRecord,
} from "@/lib/admin/fleet-equipment-shared";
import { fleetEquipmentServiceDateTypeOptions } from "@/lib/admin/equipment";
import { createFleetEquipmentAction, updateFleetEquipmentAction } from "./actions";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium text-slate-700">{label}</div>
      {children}
      {error ? <div className="mt-1 text-xs font-medium text-rose-600">{error}</div> : null}
    </label>
  );
}

type FleetEquipmentDetailClientProps = {
  mode: "create" | "edit";
  initialRecord?: FleetEquipmentRecord | null;
  initialServiceDates?: ServiceDateRowRecord[];
  cancelHref?: string;
};

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(`${value}T12:00:00`));
}

function sortServiceDates(records: ServiceDateRowRecord[]) {
  return [...records].sort((left, right) => {
    if (left.serviceDate !== right.serviceDate) {
      return right.serviceDate.localeCompare(left.serviceDate);
    }
    return right.id.localeCompare(left.id);
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

export function FleetEquipmentDetailClient({
  mode,
  initialRecord,
  initialServiceDates = [],
  cancelHref,
}: FleetEquipmentDetailClientProps) {
  const router = useRouter();
  const startingRecord = initialRecord ?? createEmptyFleetEquipment();
  const [savedRecord, setSavedRecord] = useState<FleetEquipmentRecord>(startingRecord);
  const [draft, setDraft] = useState<FleetEquipmentRecord>(startingRecord);
  const [serviceDates, setServiceDates] = useState<ServiceDateRowRecord[]>(
    sortServiceDates(initialServiceDates),
  );
  const [serviceDateEditor, setServiceDateEditor] = useState<ServiceDateEditorState | null>(null);
  const [serviceDateError, setServiceDateError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FleetEquipmentFormErrors>({});
  const [panelError, setPanelError] = useState<string | null>(null);
  const [isSavingServiceDate, setIsSavingServiceDate] = useState(false);
  const [isDeletingServiceDate, setIsDeletingServiceDate] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isCreateMode = mode === "create";
  const canManageServiceDates = !isCreateMode && Boolean(draft.id);

  function updateDraft<K extends keyof FleetEquipmentRecord>(key: K, value: FleetEquipmentRecord[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key as keyof FleetEquipmentFormErrors]: undefined }));
    setPanelError(null);
  }

  function resetDraft() {
    if (isCreateMode) {
      router.push("/admin/trucks-trailers");
      return;
    }

    if (cancelHref) {
      router.push(cancelHref);
      return;
    }

    setDraft(savedRecord);
    setErrors({});
    setPanelError(null);
  }

  function beginAddServiceDate() {
    setServiceDateEditor(emptyServiceDateEditor());
    setServiceDateError(null);
  }

  function beginEditServiceDate(record: ServiceDateRowRecord) {
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

  function saveDraft() {
    const payload = normalizeFleetEquipmentMutationInput(toFleetEquipmentMutationInput(draft));
    const nextErrors = validateFleetEquipment(payload);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setPanelError("Please review the highlighted fleet equipment fields before saving.");
      adminToast.error("Please review the truck or trailer form.");
      return;
    }

    startTransition(async () => {
      const result = isCreateMode
        ? await createFleetEquipmentAction(payload)
        : await updateFleetEquipmentAction(draft.id, payload);

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setPanelError(result.error);
        adminToast.error(result.error);
        return;
      }

      setSavedRecord(result.record);
      setDraft(result.record);
      setErrors({});
      setPanelError(null);

      if (isCreateMode) {
        router.push("/admin/trucks-trailers?saved=created");
        return;
      }

      router.push(`/admin/trucks-trailers/${result.record.id}?saved=updated`);
    });
  }

  async function saveServiceDate() {
    if (!draft.id || !serviceDateEditor) return;

    if (!serviceDateEditor.serviceDate) {
      setServiceDateError("Date is required.");
      return;
    }

    setIsSavingServiceDate(true);

    try {
      const response = await fetch(
        serviceDateEditor.id
          ? `/api/admin/fleet-equipment-service-dates/${encodeURIComponent(serviceDateEditor.id)}`
          : `/api/admin/fleet-equipment/${encodeURIComponent(draft.id)}/service-dates`,
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

      const saved = json.serviceDate as ServiceDateRowRecord;
      setServiceDates((current) => sortServiceDates([...current.filter((record) => record.id !== saved.id), saved]));
      setServiceDateEditor(null);
      router.refresh();
      adminToast.success(serviceDateEditor.id ? "Service date updated." : "Service date added.");
    } catch (error) {
      setServiceDateError(error instanceof Error ? error.message : "Could not save service date.");
    } finally {
      setIsSavingServiceDate(false);
    }
  }

  async function deleteServiceDate(record: ServiceDateRowRecord) {
    if (!record.id || isDeletingServiceDate) return;
    const confirmed = window.confirm(
      `Delete the ${record.serviceType.toLowerCase()} record from ${formatDate(record.serviceDate)}?`,
    );
    if (!confirmed) return;

    setIsDeletingServiceDate(true);

    try {
      const response = await fetch(
        `/api/admin/fleet-equipment-service-dates/${encodeURIComponent(record.id)}`,
        { method: "DELETE" },
      );
      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok) {
        adminToast.error(json?.error || "Could not delete service date.");
        return;
      }

      setServiceDates((current) => current.filter((currentRecord) => currentRecord.id !== record.id));
      if (serviceDateEditor?.id === record.id) {
        setServiceDateEditor(null);
      }
      router.refresh();
      adminToast.success("Service date deleted.");
    } catch (error) {
      adminToast.error(error instanceof Error ? error.message : "Could not delete service date.");
    } finally {
      setIsDeletingServiceDate(false);
    }
  }

  function updateTrackerField(
    key: "enabled" | "provider" | "trackerId" | "installationDate" | "lastCheckIn" | "status" | "notes",
    value: string | boolean,
  ) {
    if (key === "enabled") {
      updateDraft("trackerEnabled", value as boolean);
      return;
    }
    if (key === "provider") {
      updateDraft("trackerProvider", value as string);
      return;
    }
    if (key === "trackerId") {
      updateDraft("trackerIdentifier", value as string);
      return;
    }
    if (key === "installationDate") {
      updateDraft("trackerInstallationDate", value as string);
      return;
    }
    if (key === "lastCheckIn") {
      updateDraft("trackerLastCheckIn", value as string);
      return;
    }
    if (key === "status") {
      updateDraft("trackerStatus", value as FleetEquipmentRecord["trackerStatus"]);
      return;
    }
    updateDraft("trackerNotes", value as string);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
          <span>{draft.equipmentType === "truck" ? "Truck" : "Trailer"}</span>
          <span className="text-slate-300" aria-hidden="true">|</span>
          <span>{formatEnumLabel(draft.status)}</span>
          <span className="text-slate-300" aria-hidden="true">|</span>
          <span>{draft.licensePlate || "No plate yet"}</span>
      </div>

      {panelError ? (
        <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {panelError}
        </div>
      ) : null}

      <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Equipment type" error={errors.equipmentType}>
            <select
              value={draft.equipmentType}
              disabled={isPending}
              onChange={(event) => updateDraft("equipmentType", event.target.value as FleetEquipmentRecord["equipmentType"])}
              className="h-11 w-full rounded-[14px] border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {fleetEquipmentTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "truck" ? "Truck" : "Trailer"}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status" error={errors.status}>
            <select
              value={draft.status}
              disabled={isPending}
              onChange={(event) => updateDraft("status", event.target.value as FleetEquipmentRecord["status"])}
              className="h-11 w-full rounded-[14px] border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {fleetEquipmentStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {formatEnumLabel(option)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Name" error={errors.name}>
            <input
              value={draft.name}
              disabled={isPending}
              onChange={(event) => updateDraft("name", event.target.value)}
              className="h-11 w-full rounded-[14px] border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </Field>

          <Field label="License plate" error={errors.licensePlate}>
            <input
              value={draft.licensePlate}
              disabled={isPending}
              onChange={(event) => updateDraft("licensePlate", event.target.value.toUpperCase())}
              className="h-11 w-full rounded-[14px] border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </Field>

          <Field label="VIN" error={errors.vin}>
            <input
              value={draft.vin}
              disabled={isPending}
              onChange={(event) => updateDraft("vin", event.target.value.toUpperCase())}
              className="h-11 w-full rounded-[14px] border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </Field>

        </div>
        <div className="mt-6">
          <Field label="Notes" error={errors.notes}>
            <textarea
              value={draft.notes}
              disabled={isPending}
              onChange={(event) => updateDraft("notes", event.target.value)}
              rows={5}
              className="w-full rounded-[14px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2 pt-6">
          {!isCreateMode ? (
            <button
              type="button"
              onClick={resetDraft}
              disabled={isPending}
              className="admin-btn admin-btn-secondary h-11 px-5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={saveDraft}
            disabled={isPending}
            className="admin-btn admin-btn-primary h-11 px-5"
          >
            {isPending ? "Saving..." : isCreateMode ? "Create truck or trailer" : "Save changes"}
          </button>
        </div>
      </section>

      {canManageServiceDates ? (
        <ServiceDatesSection
          description="Track inspections, maintenance, repairs, and other service events for this unit."
          records={serviceDates}
          editor={serviceDateEditor}
          serviceDateError={serviceDateError}
          serviceTypeOptions={fleetEquipmentServiceDateTypeOptions}
          onAdd={beginAddServiceDate}
          onEdit={beginEditServiceDate}
          onDelete={deleteServiceDate}
          onEditorChange={updateServiceDateEditor}
          onEditorCancel={() => {
            setServiceDateEditor(null);
            setServiceDateError(null);
          }}
          onEditorSave={saveServiceDate}
          formatDate={formatDate}
          isSaving={isSavingServiceDate}
          emptyMessage="No service dates have been logged yet."
          addDisabled={isDeletingServiceDate}
        />
      ) : null}

      <TrackerConfigurationSection
        mode="edit"
        tracker={{
          enabled: draft.trackerEnabled,
          provider: draft.trackerProvider,
          trackerId: draft.trackerIdentifier,
          installationDate: draft.trackerInstallationDate,
          lastCheckIn: draft.trackerLastCheckIn,
          status: draft.trackerStatus,
          notes: draft.trackerNotes,
        }}
        onChange={updateTrackerField}
        error={errors.trackerIdentifier}
        errorId="fleet-tracker-error"
        onSave={saveDraft}
        isSaving={isPending}
        saveLabel={isCreateMode ? "Create truck or trailer" : "Save changes"}
        showCancel={false}
      />
    </div>
  );
}
