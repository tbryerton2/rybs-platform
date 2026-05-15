import "server-only";

import {
  normalizeEquipmentType,
  normalizeFleetEquipmentMutationInput,
  normalizeMaintenanceStatus,
  normalizeStatus,
  validateFleetEquipment,
  type FleetEquipmentMutationInput,
  type FleetEquipmentMutationResult,
  type FleetEquipmentRecord,
} from "@/lib/admin/fleet-equipment-shared";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const FLEET_EQUIPMENT_SELECT = `
  id,
  equipment_type,
  name,
  status,
  license_plate,
  vin,
  tracker_enabled,
  tracker_provider,
  tracker_identifier,
  tracker_installation_date,
  tracker_last_check_in,
  tracker_status,
  tracker_notes,
  maintenance_status,
  maintenance_due_date,
  registration_expiration_date,
  inspection_expiration_date,
  insurance_expiration_date,
  notes,
  created_at,
  updated_at
`;

export type FleetEquipmentRow = {
  id: string;
  equipment_type: string;
  name: string;
  status: string;
  license_plate: string | null;
  vin: string | null;
  tracker_enabled: boolean;
  tracker_provider: string | null;
  tracker_identifier: string | null;
  tracker_installation_date: string | null;
  tracker_last_check_in: string | null;
  tracker_status: string | null;
  tracker_notes: string | null;
  maintenance_status: string | null;
  maintenance_due_date: string | null;
  registration_expiration_date: string | null;
  inspection_expiration_date: string | null;
  insurance_expiration_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function nullableText(value: string | null | undefined) {
  const normalized = cleanText(value);
  return normalized ? normalized : null;
}

export function mapFleetEquipmentRowToRecord(row: FleetEquipmentRow): FleetEquipmentRecord {
  return {
    id: row.id,
    equipmentType: normalizeEquipmentType(row.equipment_type),
    name: cleanText(row.name),
    status: normalizeStatus(row.status),
    licensePlate: cleanText(row.license_plate),
    vin: cleanText(row.vin),
    trackerEnabled: Boolean(row.tracker_enabled),
    trackerProvider: cleanText(row.tracker_provider),
    trackerIdentifier: cleanText(row.tracker_identifier),
    trackerInstallationDate: cleanText(row.tracker_installation_date),
    trackerLastCheckIn: cleanText(row.tracker_last_check_in),
    trackerStatus: (cleanText(row.tracker_status) || "Not installed") as FleetEquipmentRecord["trackerStatus"],
    trackerNotes: cleanText(row.tracker_notes),
    maintenanceStatus: normalizeMaintenanceStatus(row.maintenance_status),
    maintenanceDueDate: cleanText(row.maintenance_due_date),
    registrationExpirationDate: cleanText(row.registration_expiration_date),
    inspectionExpirationDate: cleanText(row.inspection_expiration_date),
    insuranceExpirationDate: cleanText(row.insurance_expiration_date),
    notes: cleanText(row.notes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildFleetEquipmentWriteValues(input: FleetEquipmentMutationInput) {
  const normalized = normalizeFleetEquipmentMutationInput(input);

  return {
    equipment_type: normalized.equipmentType,
    name: normalized.name,
    status: normalized.status,
    license_plate: nullableText(normalized.licensePlate),
    vin: nullableText(normalized.vin),
    tracker_enabled: normalized.trackerEnabled,
    tracker_provider: nullableText(normalized.trackerProvider),
    tracker_identifier: nullableText(normalized.trackerIdentifier),
    tracker_installation_date: normalized.trackerInstallationDate || null,
    tracker_last_check_in: normalized.trackerLastCheckIn || null,
    tracker_status: normalized.trackerEnabled ? (normalized.trackerStatus || "Online") : "Not installed",
    tracker_notes: nullableText(normalized.trackerNotes),
    maintenance_status: nullableText(normalized.maintenanceStatus),
    maintenance_due_date: normalized.maintenanceDueDate || null,
    registration_expiration_date: normalized.registrationExpirationDate || null,
    inspection_expiration_date: normalized.inspectionExpirationDate || null,
    insurance_expiration_date: normalized.insuranceExpirationDate || null,
    notes: nullableText(normalized.notes),
  };
}

export async function listFleetEquipment() {
  const { data, error } = await supabaseAdmin
    .from("fleet_equipment")
    .select(FLEET_EQUIPMENT_SELECT)
    .order("status", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as FleetEquipmentRow[]).map(mapFleetEquipmentRowToRecord);
}

export async function getFleetEquipmentById(id: string) {
  const { data, error } = await supabaseAdmin
    .from("fleet_equipment")
    .select(FLEET_EQUIPMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapFleetEquipmentRowToRecord(data as FleetEquipmentRow);
}

export async function createFleetEquipment(
  input: FleetEquipmentMutationInput,
): Promise<FleetEquipmentMutationResult> {
  const fieldErrors = validateFleetEquipment(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Please review the highlighted fleet equipment fields.",
      fieldErrors,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("fleet_equipment")
    .insert(buildFleetEquipmentWriteValues(input))
    .select(FLEET_EQUIPMENT_SELECT)
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Unable to create this truck or trailer right now.",
    };
  }

  return {
    ok: true,
    record: mapFleetEquipmentRowToRecord(data as FleetEquipmentRow),
    message: "Truck or trailer created.",
  };
}

export async function updateFleetEquipment(
  id: string,
  input: FleetEquipmentMutationInput,
): Promise<FleetEquipmentMutationResult> {
  const fieldErrors = validateFleetEquipment(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Please review the highlighted fleet equipment fields.",
      fieldErrors,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("fleet_equipment")
    .update(buildFleetEquipmentWriteValues(input))
    .eq("id", id)
    .select(FLEET_EQUIPMENT_SELECT)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  if (!data) {
    return {
      ok: false,
      error: "This truck or trailer could not be found.",
    };
  }

  return {
    ok: true,
    record: mapFleetEquipmentRowToRecord(data as FleetEquipmentRow),
    message: "Truck or trailer updated.",
  };
}
