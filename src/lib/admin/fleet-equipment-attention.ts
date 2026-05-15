import { getFleetEquipmentServiceDateStatus } from "@/lib/admin/fleet-equipment-service-dates";
import type { FleetEquipmentRecord } from "@/lib/admin/fleet-equipment-shared";

export type FleetEquipmentInspectionStatus = "Current" | "Due soon" | "Expired" | "Not set";

function getDateAttentionStatus(value: string, windowDays = 45) {
  if (!value) return "Current" as const;
  return getFleetEquipmentServiceDateStatus(value, windowDays) === "Overdue"
    ? "Expired"
    : getFleetEquipmentServiceDateStatus(value, windowDays);
}

export function shouldCountFleetEquipmentForMaintenanceAttention(
  record: FleetEquipmentRecord,
  options?: {
    serviceDateAttentionIds?: ReadonlySet<string>;
    inspectionStatusById?: Record<string, FleetEquipmentInspectionStatus>;
    windowDays?: number;
    includeInactive?: boolean;
  },
) {
  const windowDays = options?.windowDays ?? 45;
  const includeInactive = options?.includeInactive ?? false;

  if (!includeInactive && (record.status === "inactive" || record.status === "retired")) {
    return false;
  }

  if (record.maintenanceStatus === "due soon" || record.maintenanceStatus === "needs service") {
    return true;
  }

  if (record.status === "maintenance") {
    return true;
  }

  if (options?.serviceDateAttentionIds?.has(record.id)) {
    return true;
  }

  const inspectionStatus = options?.inspectionStatusById?.[record.id];
  if (inspectionStatus === "Due soon" || inspectionStatus === "Expired") {
    return true;
  }

  return [
    record.maintenanceDueDate,
    record.registrationExpirationDate,
    record.insuranceExpirationDate,
  ].some((value) => {
    const status = getDateAttentionStatus(value, windowDays);
    return status === "Due soon" || status === "Expired";
  });
}
