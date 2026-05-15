import type {
  FleetEquipmentServiceDateType,
} from "@/lib/admin/equipment";
import { fleetEquipmentServiceDateTypeOptions } from "@/lib/admin/equipment";

export const FLEET_EQUIPMENT_SERVICE_DATE_SELECT = `
  id,
  fleet_equipment_id,
  service_date,
  service_type,
  notes,
  created_at,
  updated_at
`;

export type FleetEquipmentServiceDateRow = {
  id: string;
  fleet_equipment_id: string;
  service_date: string;
  service_type: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FleetEquipmentServiceDateInput = {
  serviceDate: string;
  serviceType: FleetEquipmentServiceDateType;
  notes: string;
};

export type FleetEquipmentServiceDateRecord = {
  id: string;
  fleetEquipmentId: string;
  serviceDate: string;
  serviceType: FleetEquipmentServiceDateType;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const allowedTypes = new Set<string>(fleetEquipmentServiceDateTypeOptions);

export type FleetEquipmentServiceDateStatus = "Current" | "Due soon" | "Overdue";

function asString(value: string | null | undefined) {
  return value ?? "";
}

export function mapFleetEquipmentServiceDateRowToRecord(
  row: FleetEquipmentServiceDateRow,
): FleetEquipmentServiceDateRecord {
  return {
    id: row.id,
    fleetEquipmentId: row.fleet_equipment_id,
    serviceDate: row.service_date,
    serviceType: allowedTypes.has(row.service_type)
      ? (row.service_type as FleetEquipmentServiceDateType)
      : "Other",
    notes: asString(row.notes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function validateFleetEquipmentServiceDateInput(input: FleetEquipmentServiceDateInput) {
  if (!String(input.serviceDate ?? "").trim()) {
    return "Date is required.";
  }

  if (!allowedTypes.has(String(input.serviceType ?? ""))) {
    return "Select a valid service type.";
  }

  return null;
}

export function buildFleetEquipmentServiceDateInsert(
  fleetEquipmentId: string,
  input: FleetEquipmentServiceDateInput,
) {
  return {
    fleet_equipment_id: fleetEquipmentId,
    service_date: input.serviceDate,
    service_type: input.serviceType,
    notes: input.notes.trim() || null,
  };
}

export function getFleetEquipmentServiceDateStatus(
  serviceDate: string,
  windowDays = 45,
): FleetEquipmentServiceDateStatus {
  if (!serviceDate) return "Current";

  const target = new Date(`${serviceDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return "Current";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return "Overdue";
  if (diff <= windowDays) return "Due soon";
  return "Current";
}

export function getFleetEquipmentDueSoonIndicator(
  records: Array<{ serviceDate: string; serviceType: FleetEquipmentServiceDateType }>,
  windowDays = 45,
) {
  const dueSoonRecords = records.filter(
    (record) => getFleetEquipmentServiceDateStatus(record.serviceDate, windowDays) === "Due soon",
  );

  if (dueSoonRecords.length === 0) return null;
  if (dueSoonRecords.length === 1) {
    return `${dueSoonRecords[0].serviceType} due soon`;
  }

  return `${dueSoonRecords.length} service dates due soon`;
}
