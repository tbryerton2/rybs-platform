import {
  DUMPSTER_SELECT,
  getNextDumpsterEquipmentIdFromValues,
  mapDumpsterRowToRecord,
  type DumpsterRow,
} from "@/lib/admin/dumpster-inventory-shared";
import {
  DUMPSTER_SERVICE_DATE_SELECT,
  mapDumpsterServiceDateRowToRecord,
  type DumpsterServiceDateRow,
} from "@/lib/admin/dumpster-service-dates";
import { decorateDumpstersWithOperationalStatus } from "@/lib/admin/dumpster-operational-status";
import { getServiceWarningState } from "@/lib/admin/dumpster-service-warning";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatInputDateET } from "@/lib/time";

function isMissingServiceDateTableError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("dumpster_service_dates") && normalized.includes("does not exist");
}

export async function getDumpsters() {
  const { data, error } = await supabaseAdmin
    .from("dumpsters")
    .select(DUMPSTER_SELECT)
    .order("active", { ascending: false })
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const dumpsters = await decorateDumpstersWithOperationalStatus(
    ((data ?? []) as DumpsterRow[]).map(mapDumpsterRowToRecord),
  );
  const todayYmd = formatInputDateET(new Date());

  try {
    const { data: serviceDateData, error: serviceDateError } = await supabaseAdmin
      .from("dumpster_service_dates")
      .select(DUMPSTER_SERVICE_DATE_SELECT);

    if (serviceDateError) {
      if (isMissingServiceDateTableError(serviceDateError.message)) {
        return dumpsters;
      }
      throw new Error(serviceDateError.message);
    }

    const serviceDatesByDumpster = new Map<string, ReturnType<typeof mapDumpsterServiceDateRowToRecord>[]>();
    for (const row of (serviceDateData ?? []) as DumpsterServiceDateRow[]) {
      const mapped = mapDumpsterServiceDateRowToRecord(row);
      const current = serviceDatesByDumpster.get(mapped.dumpsterId) ?? [];
      current.push(mapped);
      serviceDatesByDumpster.set(mapped.dumpsterId, current);
    }

    return dumpsters.map((dumpster) => ({
      ...dumpster,
      serviceWarning: getServiceWarningState(serviceDatesByDumpster.get(dumpster.id) ?? [], todayYmd),
    }));
  } catch (error) {
    if (error instanceof Error && isMissingServiceDateTableError(error.message)) {
      return dumpsters;
    }
    throw error;
  }
}

export async function getDumpsterById(id: string) {
  const { data, error } = await supabaseAdmin
    .from("dumpsters")
    .select(DUMPSTER_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const [record] = await decorateDumpstersWithOperationalStatus([
    mapDumpsterRowToRecord(data as DumpsterRow),
  ]);

  return record ?? null;
}

export async function getNextDumpsterEquipmentId() {
  const { data, error } = await supabaseAdmin.from("dumpsters").select("equipment_id");

  if (error) {
    throw new Error(error.message);
  }

  const values = ((data ?? []) as Array<{ equipment_id: string | null }>).map((row) => row.equipment_id ?? "");
  return getNextDumpsterEquipmentIdFromValues(values);
}

export async function getDumpsterServiceDates(dumpsterId: string) {
  const { data, error } = await supabaseAdmin
    .from("dumpster_service_dates")
    .select(DUMPSTER_SERVICE_DATE_SELECT)
    .eq("dumpster_id", dumpsterId)
    .order("service_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingServiceDateTableError(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }

  return ((data ?? []) as DumpsterServiceDateRow[]).map(mapDumpsterServiceDateRowToRecord);
}
