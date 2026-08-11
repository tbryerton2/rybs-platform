"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ServiceDatesSection,
  type ServiceDateEditorState,
  type ServiceDateRowRecord,
} from "@/app/admin/_components/admin/service-dates-section";
import { TrackerConfigurationSection } from "@/app/admin/_components/admin/tracker-configuration-section";
import { adminToast } from "@/app/admin/_components/admin/admin-toast";
import { formatEnumLabel } from "@/lib/admin/enum-label";
import { fleetEquipmentServiceDateTypeOptions } from "@/lib/admin/equipment";
import {
  getFleetEquipmentServiceDateStatus,
  type FleetEquipmentServiceDateStatus,
} from "@/lib/admin/fleet-equipment-service-dates";
import type { FleetEquipmentRecord } from "@/lib/admin/fleet-equipment-shared";
import { formatDateTimeLabelET } from "@/lib/time";

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(`${value}T12:00:00`));
}

function formatEquipmentType(value: FleetEquipmentRecord["equipmentType"]) {
  return value === "truck" ? "Truck" : "Trailer";
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

export function FleetEquipmentView({
  record,
  serviceDates: initialServiceDates,
}: {
  record: FleetEquipmentRecord;
  serviceDates: ServiceDateRowRecord[];
}) {
  const router = useRouter();
  const [serviceDates, setServiceDates] = useState<ServiceDateRowRecord[]>(
    sortServiceDates(initialServiceDates),
  );
  const [serviceDateEditor, setServiceDateEditor] = useState<ServiceDateEditorState | null>(null);
  const [serviceDateError, setServiceDateError] = useState<string | null>(null);
  const [isSavingServiceDate, setIsSavingServiceDate] = useState(false);

  function getServiceDateStatus(record: ServiceDateRowRecord): FleetEquipmentServiceDateStatus {
    return getFleetEquipmentServiceDateStatus(record.serviceDate);
  }

  async function saveServiceDate() {
    if (!record.id || !serviceDateEditor) return;

    if (!serviceDateEditor.serviceDate) {
      setServiceDateError("Date is required.");
      return;
    }

    setIsSavingServiceDate(true);

    try {
      const response = await fetch(`/api/admin/fleet-equipment/${encodeURIComponent(record.id)}/service-dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceDate: {
            serviceDate: serviceDateEditor.serviceDate,
            serviceType: serviceDateEditor.serviceType,
            notes: serviceDateEditor.notes,
          },
        }),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok || !json?.serviceDate) {
        setServiceDateError(json?.error || "Could not save service date.");
        return;
      }

      const saved = json.serviceDate as ServiceDateRowRecord;
      setServiceDates((current) => sortServiceDates([...current, saved]));
      setServiceDateEditor(null);
      setServiceDateError(null);
      router.refresh();
      adminToast.success("Service date added.");
    } catch (error) {
      setServiceDateError(error instanceof Error ? error.message : "Could not save service date.");
    } finally {
      setIsSavingServiceDate(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900">Truck or trailer details</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/trucks-trailers/${record.id}/edit`}
              className="admin-btn admin-btn-secondary h-10 px-4"
            >
              Edit truck or trailer
            </Link>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Equipment type", formatEquipmentType(record.equipmentType)],
              ["Status", formatEnumLabel(record.status)],
              ["Name", record.name || "—"],
              ["License plate", record.licensePlate || "—"],
              ["VIN", record.vin || "—"],
              ["Created", formatDateTimeLabelET(record.createdAt)],
              ["Last updated", formatDateTimeLabelET(record.updatedAt)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[14px] border border-slate-200 bg-white p-4">
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
                <dd className="mt-2 text-sm font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="rounded-[14px] border border-slate-200 bg-white p-5">
            <div className="text-sm font-semibold text-slate-900">Notes</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{record.notes || "No notes added yet."}</p>
          </div>
        </div>
      </section>

      <ServiceDatesSection
        description="Track inspections, maintenance, repairs, and other service events for this unit."
        records={serviceDates}
        editor={serviceDateEditor}
        serviceDateError={serviceDateError}
        serviceTypeOptions={fleetEquipmentServiceDateTypeOptions}
        onAdd={() => {
          setServiceDateEditor(emptyServiceDateEditor());
          setServiceDateError(null);
        }}
        onEditorChange={(key, value) =>
          setServiceDateEditor((current) => (current ? { ...current, [key]: value } : current))
        }
        onEditorCancel={() => {
          setServiceDateEditor(null);
          setServiceDateError(null);
        }}
        onEditorSave={saveServiceDate}
        formatDate={formatDate}
        isSaving={isSavingServiceDate}
        emptyMessage="No service dates have been logged yet."
        getStatusLabel={getServiceDateStatus}
      />

      <TrackerConfigurationSection
        mode="view"
        tracker={{
          enabled: record.trackerEnabled,
          provider: record.trackerProvider,
          trackerId: record.trackerIdentifier,
          installationDate: record.trackerInstallationDate ? formatDate(record.trackerInstallationDate) : "",
          lastCheckIn: record.trackerLastCheckIn ? formatDateTimeLabelET(record.trackerLastCheckIn) : "",
          status: record.trackerStatus,
          notes: record.trackerNotes,
        }}
      />
    </div>
  );
}
