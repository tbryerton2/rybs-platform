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
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
  if (!operationalStatuses.has(record.operationalStatus)) {
    errors.operationalStatus = "Select a valid operational status.";
  }
  if (!maintenanceStatuses.has(record.maintenanceStatus)) {
    errors.maintenanceStatus = "Select a valid maintenance status.";
  }
  if (!serviceStatuses.has(record.serviceStatus)) {
    errors.serviceStatus = "Select a valid service status.";
  }
  if (record.tracker.enabled && !record.tracker.trackerId.trim()) {
    errors.tracker = "Tracker ID is required when tracker support is enabled.";
  }
  if (record.tracker.enabled && !trackerStatuses.has(record.tracker.status)) {
    errors.tracker = "Select a valid tracker status.";
  }

  return errors;
}

export type DumpsterInventorySummary = {
  totalCount: number;
  activeCount: number;
  bookableCount: number;
  inactiveCount: number;
  maintenanceOrOutOfServiceCount: number;
  countsBySize: Array<{
    size: string;
    totalCount: number;
    activeCount: number;
    bookableCount: number;
  }>;
};

export type DumpsterFilterOption = {
  id: string;
  label: string;
  size: string;
  equipmentId: string;
};

function isBookableRow(row: DumpsterRow) {
  return (
    row.active &&
    row.service_status === "Ready" &&
    row.operational_status !== "Maintenance hold"
  );
}

export async function getDumpsterInventorySummary(): Promise<DumpsterInventorySummary> {
  const { data, error } = await supabaseAdmin
    .from("dumpsters")
    .select(DUMPSTER_SELECT)
    .order("size", { ascending: true })
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as DumpsterRow[];
  const countsBySizeMap = new Map<
    string,
    { size: string; totalCount: number; activeCount: number; bookableCount: number }
  >();

  let activeCount = 0;
  let bookableCount = 0;
  let inactiveCount = 0;
  let maintenanceOrOutOfServiceCount = 0;

  for (const row of rows) {
    const key = row.size.trim() || "Unknown";
    const current = countsBySizeMap.get(key) ?? {
      size: key,
      totalCount: 0,
      activeCount: 0,
      bookableCount: 0,
    };

    current.totalCount += 1;

    if (row.active) {
      activeCount += 1;
      current.activeCount += 1;
    } else {
      inactiveCount += 1;
    }

    if (
      !row.active ||
      row.service_status === "Out of service" ||
      row.operational_status === "Maintenance hold" ||
      row.maintenance_status === "Needs service"
    ) {
      maintenanceOrOutOfServiceCount += 1;
    }

    if (isBookableRow(row)) {
      bookableCount += 1;
      current.bookableCount += 1;
    }

    countsBySizeMap.set(key, current);
  }

  return {
    totalCount: rows.length,
    activeCount,
    bookableCount,
    inactiveCount,
    maintenanceOrOutOfServiceCount,
    countsBySize: Array.from(countsBySizeMap.values()).sort((left, right) =>
      left.size.localeCompare(right.size),
    ),
  };
}

export async function getActiveDumpsterFilterOptions(): Promise<DumpsterFilterOption[]> {
  const { data, error } = await supabaseAdmin
    .from("dumpsters")
    .select("id, display_name, equipment_id, size")
    .eq("active", true)
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{
    id: string;
    display_name: string;
    equipment_id: string;
    size: string;
  }>).map((row) => ({
    id: row.id,
    label: `${row.display_name} • ${row.equipment_id}`,
    size: row.size,
    equipmentId: row.equipment_id,
  }));
}
