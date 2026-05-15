import type { EquipmentTrackerStatus } from "@/lib/admin/equipment";

export type FleetEquipmentType = "truck" | "trailer";
export type FleetEquipmentStatus = "active" | "inactive" | "maintenance" | "retired";
export type FleetEquipmentMaintenanceStatus = "current" | "due soon" | "needs service" | "";

export type FleetEquipmentRecord = {
  id: string;
  equipmentType: FleetEquipmentType;
  name: string;
  status: FleetEquipmentStatus;
  licensePlate: string;
  vin: string;
  trackerEnabled: boolean;
  trackerProvider: string;
  trackerIdentifier: string;
  trackerInstallationDate: string;
  trackerLastCheckIn: string;
  trackerStatus: EquipmentTrackerStatus | "";
  trackerNotes: string;
  maintenanceStatus: FleetEquipmentMaintenanceStatus;
  maintenanceDueDate: string;
  registrationExpirationDate: string;
  inspectionExpirationDate: string;
  insuranceExpirationDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type FleetEquipmentMutationInput = Omit<FleetEquipmentRecord, "id" | "createdAt" | "updatedAt">;

export type FleetEquipmentFormErrors = Partial<Record<keyof FleetEquipmentMutationInput, string>>;

export type FleetEquipmentMutationResult =
  | {
      ok: true;
      record: FleetEquipmentRecord;
      message: string;
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: FleetEquipmentFormErrors;
    };

export const fleetEquipmentTypeOptions: FleetEquipmentType[] = ["truck", "trailer"];
export const fleetEquipmentStatusOptions: FleetEquipmentStatus[] = [
  "active",
  "inactive",
  "maintenance",
  "retired",
];
export const fleetEquipmentMaintenanceStatusOptions: Exclude<FleetEquipmentMaintenanceStatus, "">[] = [
  "current",
  "due soon",
  "needs service",
];

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function normalizeMaintenanceStatus(value: string | null | undefined): FleetEquipmentMaintenanceStatus {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === "current") return "current";
  if (normalized === "due soon") return "due soon";
  if (normalized === "needs service") return "needs service";
  return "";
}

export function normalizeStatus(value: string | null | undefined): FleetEquipmentStatus {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === "inactive") return "inactive";
  if (normalized === "maintenance") return "maintenance";
  if (normalized === "retired") return "retired";
  return "active";
}

export function normalizeEquipmentType(value: string | null | undefined): FleetEquipmentType {
  return cleanText(value).toLowerCase() === "trailer" ? "trailer" : "truck";
}

export function createEmptyFleetEquipment(): FleetEquipmentRecord {
  return {
    id: "",
    equipmentType: "truck",
    name: "",
    status: "active",
    licensePlate: "",
    vin: "",
    trackerEnabled: false,
    trackerProvider: "",
    trackerIdentifier: "",
    trackerInstallationDate: "",
    trackerLastCheckIn: "",
    trackerStatus: "Not installed",
    trackerNotes: "",
    maintenanceStatus: "",
    maintenanceDueDate: "",
    registrationExpirationDate: "",
    inspectionExpirationDate: "",
    insuranceExpirationDate: "",
    notes: "",
    createdAt: "",
    updatedAt: "",
  };
}

export function toFleetEquipmentMutationInput(record: FleetEquipmentRecord): FleetEquipmentMutationInput {
  return {
    equipmentType: record.equipmentType,
    name: record.name,
    status: record.status,
    licensePlate: record.licensePlate,
    vin: record.vin,
    trackerEnabled: record.trackerEnabled,
    trackerProvider: record.trackerProvider,
    trackerIdentifier: record.trackerIdentifier,
    trackerInstallationDate: record.trackerInstallationDate,
    trackerLastCheckIn: record.trackerLastCheckIn,
    trackerStatus: record.trackerStatus,
    trackerNotes: record.trackerNotes,
    maintenanceStatus: record.maintenanceStatus,
    maintenanceDueDate: record.maintenanceDueDate,
    registrationExpirationDate: record.registrationExpirationDate,
    inspectionExpirationDate: record.inspectionExpirationDate,
    insuranceExpirationDate: record.insuranceExpirationDate,
    notes: record.notes,
  };
}

export function normalizeFleetEquipmentMutationInput(
  input: FleetEquipmentMutationInput,
): FleetEquipmentMutationInput {
  return {
    equipmentType: normalizeEquipmentType(input.equipmentType),
    name: cleanText(input.name),
    status: normalizeStatus(input.status),
    licensePlate: cleanText(input.licensePlate),
    vin: cleanText(input.vin).toUpperCase(),
    trackerEnabled: Boolean(input.trackerEnabled),
    trackerProvider: cleanText(input.trackerProvider),
    trackerIdentifier: cleanText(input.trackerIdentifier),
    trackerInstallationDate: cleanText(input.trackerInstallationDate),
    trackerLastCheckIn: cleanText(input.trackerLastCheckIn),
    trackerStatus: cleanText(input.trackerStatus) as EquipmentTrackerStatus | "",
    trackerNotes: cleanText(input.trackerNotes),
    maintenanceStatus: normalizeMaintenanceStatus(input.maintenanceStatus),
    maintenanceDueDate: cleanText(input.maintenanceDueDate),
    registrationExpirationDate: cleanText(input.registrationExpirationDate),
    inspectionExpirationDate: cleanText(input.inspectionExpirationDate),
    insuranceExpirationDate: cleanText(input.insuranceExpirationDate),
    notes: cleanText(input.notes),
  };
}

export function validateFleetEquipment(input: FleetEquipmentMutationInput): FleetEquipmentFormErrors {
  const normalized = normalizeFleetEquipmentMutationInput(input);
  const errors: FleetEquipmentFormErrors = {};

  if (!normalized.name) {
    errors.name = "Name is required.";
  }

  if (!fleetEquipmentTypeOptions.includes(normalized.equipmentType)) {
    errors.equipmentType = "Choose truck or trailer.";
  }

  if (!fleetEquipmentStatusOptions.includes(normalized.status)) {
    errors.status = "Choose a valid status.";
  }

  if (
    normalized.maintenanceStatus &&
    !fleetEquipmentMaintenanceStatusOptions.includes(
      normalized.maintenanceStatus as Exclude<FleetEquipmentMaintenanceStatus, "">,
    )
  ) {
    errors.maintenanceStatus = "Choose a valid maintenance status.";
  }

  if (normalized.trackerEnabled && !normalized.trackerIdentifier) {
    errors.trackerIdentifier = "Tracker identifier is required when tracker is enabled.";
  }

  return errors;
}
