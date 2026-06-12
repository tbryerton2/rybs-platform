import "server-only";

import { getFleetEquipmentServiceDateStatus } from "@/lib/admin/fleet-equipment-service-dates";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { listFleetEquipment, mapFleetEquipmentRowToRecord, FLEET_EQUIPMENT_SELECT, type FleetEquipmentRow } from "@/lib/admin/fleet-equipment";
import {
  FLEET_EQUIPMENT_SERVICE_DATE_SELECT,
  mapFleetEquipmentServiceDateRowToRecord,
  type FleetEquipmentServiceDateRow,
} from "@/lib/admin/fleet-equipment-service-dates";
import { formatInputDateET } from "@/lib/time";

function isMissingServiceDateTableError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("fleet_equipment_service_dates") && normalized.includes("does not exist");
}

export { listFleetEquipment };

type FleetEquipmentServiceDateIdRow = {
  fleet_equipment_id: string;
};

type FleetEquipmentServiceDateAttentionRow = {
  fleet_equipment_id: string;
  service_date: string;
};

type FleetEquipmentInspectionDateRow = {
  fleet_equipment_id: string;
  service_date: string;
};

export type FleetEquipmentInspectionStatus = "Current" | "Due soon" | "Expired" | "Not set";

export async function getFleetEquipmentDetailById(id: string, businessId: string) {
  const { data, error } = await supabaseAdmin
    .from("fleet_equipment")
    .select(FLEET_EQUIPMENT_SELECT)
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapFleetEquipmentRowToRecord(data as FleetEquipmentRow);
}

export async function getFleetEquipmentServiceDates(fleetEquipmentId: string, businessId: string) {
  const { data, error } = await supabaseAdmin
    .from("fleet_equipment_service_dates")
    .select(FLEET_EQUIPMENT_SERVICE_DATE_SELECT)
    .eq("fleet_equipment_id", fleetEquipmentId)
    .eq("business_id", businessId)
    .order("service_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingServiceDateTableError(error.message)) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as FleetEquipmentServiceDateRow[]).map(mapFleetEquipmentServiceDateRowToRecord);
}

export async function getFleetEquipmentDueSoonIds(businessId: string, windowDays = 45) {
  const today = new Date();
  const dueSoonEnd = new Date(today);
  dueSoonEnd.setDate(dueSoonEnd.getDate() + windowDays);

  const { data, error } = await supabaseAdmin
    .from("fleet_equipment_service_dates")
    .select("fleet_equipment_id")
    .eq("business_id", businessId)
    .gte("service_date", formatInputDateET(today))
    .lte("service_date", formatInputDateET(dueSoonEnd));

  if (error) {
    if (isMissingServiceDateTableError(error.message)) return [];
    throw new Error(error.message);
  }

  return [...new Set(((data ?? []) as FleetEquipmentServiceDateIdRow[]).map((row) => row.fleet_equipment_id))];
}

export async function getFleetEquipmentMaintenanceAttentionIds(businessId: string, windowDays = 45) {
  const today = new Date();
  const dueSoonEnd = new Date(today);
  dueSoonEnd.setDate(dueSoonEnd.getDate() + windowDays);

  const { data, error } = await supabaseAdmin
    .from("fleet_equipment_service_dates")
    .select("fleet_equipment_id, service_date")
    .eq("business_id", businessId)
    .lte("service_date", formatInputDateET(dueSoonEnd));

  if (error) {
    if (isMissingServiceDateTableError(error.message)) return [];
    throw new Error(error.message);
  }

  const attentionIds = new Set<string>();
  for (const row of (data ?? []) as FleetEquipmentServiceDateAttentionRow[]) {
    const serviceDateStatus = getFleetEquipmentServiceDateStatus(row.service_date, windowDays);
    if (serviceDateStatus === "Due soon" || serviceDateStatus === "Overdue") {
      attentionIds.add(row.fleet_equipment_id);
    }
  }

  return [...attentionIds];
}

export async function getFleetEquipmentInspectionStatusMap(businessId: string, windowDays = 45) {
  const today = new Date();
  const todayYmd = formatInputDateET(today);
  const dueSoonEnd = new Date(today);
  dueSoonEnd.setDate(dueSoonEnd.getDate() + windowDays);
  const dueSoonEndYmd = formatInputDateET(dueSoonEnd);

  const { data, error } = await supabaseAdmin
    .from("fleet_equipment_service_dates")
    .select("fleet_equipment_id, service_date")
    .eq("business_id", businessId)
    .eq("service_type", "Inspection")
    .order("service_date", { ascending: true });

  if (error) {
    if (isMissingServiceDateTableError(error.message)) return {};
    throw new Error(error.message);
  }

  const groupedDates = new Map<string, string[]>();

  for (const row of (data ?? []) as FleetEquipmentInspectionDateRow[]) {
    const nextDates = groupedDates.get(row.fleet_equipment_id) ?? [];
    nextDates.push(row.service_date);
    groupedDates.set(row.fleet_equipment_id, nextDates);
  }

  const statusById: Record<string, FleetEquipmentInspectionStatus> = {};

  for (const [fleetEquipmentId, dates] of groupedDates.entries()) {
    const sortedDates = [...dates].sort((left, right) => left.localeCompare(right));
    const upcomingDate = sortedDates.find((date) => date >= todayYmd);

    if (upcomingDate) {
      statusById[fleetEquipmentId] = upcomingDate <= dueSoonEndYmd ? "Due soon" : "Current";
      continue;
    }

    statusById[fleetEquipmentId] = "Expired";
  }

  return statusById;
}
