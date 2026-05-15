export type EquipmentTrackerStatus = "Online" | "Offline" | "Needs attention" | "Not installed";
export type DumpsterOperationalStatus = "Available" | "On rent" | "In yard" | "Maintenance hold";
export type DumpsterMaintenanceStatus = "Current" | "Due soon" | "Needs service";
export type ServiceStatus = "Ready" | "Inspection due" | "Out of service";
export type DumpsterDerivedOperationalStatus =
  | "Available"
  | "Scheduled"
  | "On rent"
  | "Maintenance / unavailable";
export type DumpsterServiceWarning = {
  label: "Service due soon" | "Service date soon";
  tone: "urgent" | "soon";
};
export type DumpsterServiceDateType = "Inspection" | "Maintenance" | "Repair" | "Cleaning" | "Other";
export type FleetEquipmentServiceDateType =
  | "Inspection"
  | "Registration"
  | "Insurance"
  | "Maintenance"
  | "Repair"
  | "Cleaning"
  | "Other";
export type ServiceDateType = DumpsterServiceDateType | FleetEquipmentServiceDateType;
export type VehicleEquipmentType = "Truck" | "Trailer";
export type ComplianceStatus = "Current" | "Due soon" | "Expired";
export type VehicleMaintenanceStatus = "Current" | "Due soon" | "Needs service";

export type TrackerConfig = {
  enabled: boolean;
  provider: string;
  trackerId: string;
  installationDate: string;
  lastCheckIn: string;
  status: EquipmentTrackerStatus;
  notes: string;
};

export type DumpsterRecord = {
  id: string;
  equipmentId: string;
  displayName: string;
  size: string;
  dimensions: string;
  capacityNotes: string;
  active: boolean;
  operationalStatus: DumpsterOperationalStatus;
  conditionNotes: string;
  inServiceDate: string;
  maintenanceStatus: DumpsterMaintenanceStatus;
  notes: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  yardLocation: string;
  serviceStatus: ServiceStatus;
  lastInspectionDate: string;
  nextInspectionDue: string;
  assetTag: string;
  updatedAt: string;
  derivedOperationalStatus: DumpsterDerivedOperationalStatus;
  serviceWarning: DumpsterServiceWarning | null;
  tracker: TrackerConfig;
};

export type DumpsterServiceDateRecord = {
  id: string;
  dumpsterId: string;
  serviceDate: string;
  serviceType: DumpsterServiceDateType;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type VehicleRecord = {
  id: string;
  equipmentId: string;
  unitName: string;
  equipmentType: VehicleEquipmentType;
  make: string;
  model: string;
  year: string;
  vin: string;
  plateNumber: string;
  registrationExpiration: string;
  inspectionStatus: ComplianceStatus;
  inspectionExpiration: string;
  insuranceStatus: ComplianceStatus;
  insuranceRenewalDate: string;
  mileage: string;
  gvwr: string;
  assignedTeam: string;
  inServiceDate: string;
  maintenanceStatus: VehicleMaintenanceStatus;
  lastServiceDate: string;
  nextServiceDue: string;
  conditionNotes: string;
  titleStatus: string;
  defaultLocation: string;
  active: boolean;
  notes: string;
  updatedAt: string;
  tracker: TrackerConfig;
};

export const dumpsterSizeOptions = ["10 yard", "14 yard", "20 yard", "30 yard", "40 yard"] as const;
export const dumpsterOperationalStatusOptions: DumpsterOperationalStatus[] = [
  "Available",
  "On rent",
  "In yard",
  "Maintenance hold",
];
export const dumpsterMaintenanceStatusOptions: DumpsterMaintenanceStatus[] = ["Current", "Due soon", "Needs service"];
export const serviceStatusOptions: ServiceStatus[] = ["Ready", "Inspection due", "Out of service"];
export const dumpsterServiceDateTypeOptions: DumpsterServiceDateType[] = [
  "Inspection",
  "Maintenance",
  "Repair",
  "Cleaning",
  "Other",
];
export const fleetEquipmentServiceDateTypeOptions: FleetEquipmentServiceDateType[] = [
  "Inspection",
  "Registration",
  "Insurance",
  "Maintenance",
  "Repair",
  "Cleaning",
  "Other",
];
export const trackerStatusOptions: EquipmentTrackerStatus[] = [
  "Online",
  "Offline",
  "Needs attention",
  "Not installed",
];
export const vehicleEquipmentTypeOptions: VehicleEquipmentType[] = ["Truck", "Trailer"];
export const complianceStatusOptions: ComplianceStatus[] = ["Current", "Due soon", "Expired"];
export const vehicleMaintenanceStatusOptions: VehicleMaintenanceStatus[] = ["Current", "Due soon", "Needs service"];

function emptyTracker(): TrackerConfig {
  return {
    enabled: false,
    provider: "",
    trackerId: "",
    installationDate: "",
    lastCheckIn: "",
    status: "Not installed",
    notes: "",
  };
}

export function createEmptyDumpster(): DumpsterRecord {
  return {
    id: "",
    equipmentId: "",
    displayName: "",
    size: "20 yard",
    dimensions: "",
    capacityNotes: "",
    active: true,
    operationalStatus: "Available",
    conditionNotes: "",
    inServiceDate: "",
    maintenanceStatus: "Current",
    notes: "",
    serialNumber: "",
    manufacturer: "",
    model: "",
    yardLocation: "",
    serviceStatus: "Ready",
    lastInspectionDate: "",
    nextInspectionDue: "",
    assetTag: "",
    updatedAt: "",
    derivedOperationalStatus: "Available",
    serviceWarning: null,
    tracker: emptyTracker(),
  };
}

export function createMockDumpsters(): DumpsterRecord[] {
  return [
    {
      id: "dumpster_1",
      equipmentId: "DST-101",
      displayName: "Roll-Off 101",
      size: "20 yard",
      dimensions: "22' x 8' x 4.5'",
      capacityNotes: "General debris and construction cleanout",
      active: true,
      operationalStatus: "Available",
      conditionNotes: "Fresh paint touch-up completed in March.",
      inServiceDate: "2023-04-11",
      maintenanceStatus: "Current",
      notes: "Preferred for high-turn same-week routes.",
      serialNumber: "SER-20101",
      manufacturer: "Galbreath",
      model: "RO20",
      yardLocation: "North Yard",
      serviceStatus: "Ready",
      lastInspectionDate: "2026-03-14",
      nextInspectionDue: "2026-06-14",
      assetTag: "TAG-101",
      updatedAt: "2026-04-08T12:10:00.000Z",
      derivedOperationalStatus: "Available",
      serviceWarning: null,
      tracker: {
        enabled: true,
        provider: "Samsara",
        trackerId: "TRK-D101",
        installationDate: "2025-08-10",
        lastCheckIn: "2026-04-11T08:45:00.000Z",
        status: "Online",
        notes: "Battery replaced Q1.",
      },
    },
    {
      id: "dumpster_2",
      equipmentId: "DST-102",
      displayName: "Roll-Off 102",
      size: "14 yard",
      dimensions: "14' x 8' x 4'",
      capacityNotes: "Tight-driveway residential jobs",
      active: true,
      operationalStatus: "On rent",
      conditionNotes: "Door latch adjusted on last service.",
      inServiceDate: "2024-01-15",
      maintenanceStatus: "Due soon",
      notes: "Next inspection should include wheel rail weld review.",
      serialNumber: "SER-20102",
      manufacturer: "Galbreath",
      model: "RO14",
      yardLocation: "On customer site",
      serviceStatus: "Inspection due",
      lastInspectionDate: "2026-01-20",
      nextInspectionDue: "2026-04-20",
      assetTag: "TAG-102",
      updatedAt: "2026-04-09T15:20:00.000Z",
      derivedOperationalStatus: "On rent",
      serviceWarning: null,
      tracker: {
        enabled: true,
        provider: "Samsara",
        trackerId: "TRK-D102",
        installationDate: "2025-07-22",
        lastCheckIn: "2026-04-11T07:12:00.000Z",
        status: "Online",
        notes: "",
      },
    },
    {
      id: "dumpster_3",
      equipmentId: "DST-103",
      displayName: "Roll-Off 103",
      size: "20 yard",
      dimensions: "22' x 8' x 4.5'",
      capacityNotes: "Standard mixed-debris unit",
      active: true,
      operationalStatus: "In yard",
      conditionNotes: "Ready after washout.",
      inServiceDate: "2022-09-09",
      maintenanceStatus: "Current",
      notes: "",
      serialNumber: "SER-20103",
      manufacturer: "Wastequip",
      model: "RK20",
      yardLocation: "South Yard",
      serviceStatus: "Ready",
      lastInspectionDate: "2026-02-18",
      nextInspectionDue: "2026-05-18",
      assetTag: "TAG-103",
      updatedAt: "2026-04-10T09:15:00.000Z",
      derivedOperationalStatus: "Available",
      serviceWarning: null,
      tracker: {
        enabled: false,
        provider: "",
        trackerId: "",
        installationDate: "",
        lastCheckIn: "",
        status: "Not installed",
        notes: "Queued for next tracker install batch.",
      },
    },
    {
      id: "dumpster_4",
      equipmentId: "DST-104",
      displayName: "Roll-Off 104",
      size: "30 yard",
      dimensions: "22' x 8' x 6'",
      capacityNotes: "Large commercial cleanouts",
      active: false,
      operationalStatus: "Maintenance hold",
      conditionNotes: "Floor plate repair pending.",
      inServiceDate: "2021-06-01",
      maintenanceStatus: "Needs service",
      notes: "Keep inactive until welding repair is signed off.",
      serialNumber: "SER-20104",
      manufacturer: "Wastequip",
      model: "RK30",
      yardLocation: "Repair bay",
      serviceStatus: "Out of service",
      lastInspectionDate: "2025-12-05",
      nextInspectionDue: "2026-04-30",
      assetTag: "TAG-104",
      updatedAt: "2026-04-04T11:40:00.000Z",
      derivedOperationalStatus: "Maintenance / unavailable",
      serviceWarning: null,
      tracker: {
        enabled: true,
        provider: "Azuga",
        trackerId: "TRK-D104",
        installationDate: "2025-05-03",
        lastCheckIn: "2026-04-03T18:02:00.000Z",
        status: "Needs attention",
        notes: "Intermittent check-ins during repair bay work.",
      },
    },
  ];
}

export function getManagedDumpsterFleetSize() {
  return createMockDumpsters().filter((dumpster) => dumpster.active).length;
}
