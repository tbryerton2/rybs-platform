import {
  createEmptyDumpster,
  dumpsterMaintenanceStatusOptions,
  dumpsterOperationalStatusOptions,
  serviceStatusOptions,
  trackerStatusOptions,
  type DumpsterMaintenanceStatus,
  type DumpsterOperationalStatus,
  type DumpsterRecord,
  type ServiceStatus,
} from "@/lib/admin/equipment";

export const DUMPSTER_SELECT = `
  id,
  equipment_id,
  display_name,
  size,
  dimensions,
  capacity_notes,
  active,
  operational_status,
  maintenance_status,
  condition_notes,
  in_service_date,
  notes,
  serial_number,
  manufacturer,
  model,
  yard_location,
  service_status,
  last_service_date,
  next_service_date,
  last_inspection_date,
  next_inspection_due,
  asset_tag,
  tracker_label,
  tracker_enabled,
  tracker_provider,
  tracker_id,
  tracker_installation_date,
  tracker_last_check_in,
  tracker_status,
  tracker_notes,
  created_at,
  updated_at
`;

export type DumpsterRow = {
  id: string;
  equipment_id: string;
  display_name: string;
  size: string;
  dimensions: string | null;
  capacity_notes: string | null;
  active: boolean;
  operational_status: string;
  maintenance_status: string;
  condition_notes: string | null;
  in_service_date: string | null;
  notes: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  yard_location: string | null;
  service_status: string;
  last_service_date: string | null;
  next_service_date: string | null;
  last_inspection_date: string | null;
  next_inspection_due: string | null;
  asset_tag: string | null;
  tracker_label: string | null;
  tracker_enabled: boolean;
  tracker_provider: string | null;
  tracker_id: string | null;
  tracker_installation_date: string | null;
  tracker_last_check_in: string | null;
  tracker_status: string;
  tracker_notes: string | null;
  created_at: string;
  updated_at: string;
};

const operationalStatuses = new Set<string>(dumpsterOperationalStatusOptions);
const maintenanceStatuses = new Set<string>(dumpsterMaintenanceStatusOptions);
const serviceStatuses = new Set<string>(serviceStatusOptions);
const trackerStatuses = new Set<string>(trackerStatusOptions);

function asStatus<T extends string>(value: string | null | undefined, allowed: Set<string>, fallback: T) {
  return allowed.has(String(value ?? "")) ? (value as T) : fallback;
}

function asString(value: string | null | undefined) {
  return value ?? "";
}

export function getNextDumpsterEquipmentIdFromValues(values: string[]) {
  const maxSequence = values.reduce((max, value) => {
    const match = value.trim().toUpperCase().match(/^DST-(\d+)$/);
    if (!match) return max;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 100);

  return `DST-${String(maxSequence + 1).padStart(3, "0")}`;
}

export function mapDumpsterRowToRecord(row: DumpsterRow): DumpsterRecord {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    displayName: row.display_name,
    size: row.size,
    dimensions: asString(row.dimensions),
    capacityNotes: asString(row.capacity_notes),
    active: Boolean(row.active),
    operationalStatus: asStatus<DumpsterOperationalStatus>(
      row.operational_status,
      operationalStatuses,
      "Available",
    ),
    conditionNotes: asString(row.condition_notes),
    inServiceDate: asString(row.in_service_date),
    maintenanceStatus: asStatus<DumpsterMaintenanceStatus>(
      row.maintenance_status,
      maintenanceStatuses,
      "Current",
    ),
    notes: asString(row.notes),
    serialNumber: asString(row.serial_number),
    manufacturer: asString(row.manufacturer),
    model: asString(row.model),
    yardLocation: asString(row.yard_location),
    serviceStatus: asStatus<ServiceStatus>(row.service_status, serviceStatuses, "Ready"),
    lastInspectionDate: asString(row.last_inspection_date ?? row.last_service_date),
    nextInspectionDue: asString(row.next_inspection_due ?? row.next_service_date),
    assetTag: asString(row.asset_tag),
    updatedAt: row.updated_at,
    derivedOperationalStatus: "Available",
    tracker: {
      enabled: Boolean(row.tracker_enabled),
      provider: asString(row.tracker_provider),
      trackerId: asString(row.tracker_id ?? row.tracker_label),
      installationDate: asString(row.tracker_installation_date),
      lastCheckIn: asString(row.tracker_last_check_in),
      status: asStatus(row.tracker_status, trackerStatuses, "Not installed"),
      notes: asString(row.tracker_notes),
    },
  };
}

export function buildDumpsterInsert(record: DumpsterRecord) {
  const empty = createEmptyDumpster();
  const trackerId = record.tracker.trackerId.trim();

  return {
    equipment_id: record.equipmentId.trim(),
    display_name: record.displayName.trim(),
    size: record.size.trim(),
    dimensions: record.dimensions.trim() || null,
    capacity_notes: record.capacityNotes.trim() || null,
    active: record.active,
    operational_status: record.operationalStatus,
    maintenance_status: record.maintenanceStatus,
    condition_notes: record.conditionNotes.trim() || null,
    in_service_date: record.inServiceDate || null,
    notes: record.notes.trim() || null,
    serial_number: record.serialNumber.trim() || null,
    manufacturer: record.manufacturer.trim() || null,
    model: record.model.trim() || null,
    yard_location: record.yardLocation.trim() || null,
    service_status: record.serviceStatus,
    last_service_date: record.lastInspectionDate || null,
    next_service_date: record.nextInspectionDue || null,
    last_inspection_date: record.lastInspectionDate || null,
    next_inspection_due: record.nextInspectionDue || null,
    asset_tag: record.assetTag.trim() || null,
    tracker_label: trackerId || null,
    tracker_enabled: record.tracker.enabled,
    tracker_provider: record.tracker.provider.trim() || null,
    tracker_id: trackerId || null,
    tracker_installation_date: record.tracker.installationDate || null,
    tracker_last_check_in: record.tracker.lastCheckIn || null,
    tracker_status: record.tracker.enabled ? record.tracker.status : empty.tracker.status,
    tracker_notes: record.tracker.notes.trim() || null,
  };
}

export function validateDumpsterRecord(record: DumpsterRecord) {
  const errors: Partial<Record<keyof DumpsterRecord, string>> = {};

  if (!record.equipmentId.trim()) errors.equipmentId = "Equipment ID is required.";
  if (!record.displayName.trim()) errors.displayName = "Display name is required.";
  if (!record.size.trim()) errors.size = "Size is required.";
  if (record.tracker.enabled && !record.tracker.trackerId.trim()) {
    errors.tracker = "Tracker ID is required when tracker support is enabled.";
  }
  if (record.tracker.enabled && !trackerStatuses.has(record.tracker.status)) {
    errors.tracker = "Select a valid tracker status.";
  }

  return errors;
}
