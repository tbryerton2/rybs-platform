import type {
  DumpsterServiceDateRecord,
  DumpsterServiceDateType,
} from "@/lib/admin/equipment";
import { dumpsterServiceDateTypeOptions } from "@/lib/admin/equipment";

export const DUMPSTER_SERVICE_DATE_SELECT = `
  id,
  dumpster_id,
  service_date,
  service_type,
  notes,
  created_at,
  updated_at
`;

export type DumpsterServiceDateRow = {
  id: string;
  dumpster_id: string;
  service_date: string;
  service_type: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DumpsterServiceDateInput = {
  serviceDate: string;
  serviceType: DumpsterServiceDateType;
  notes: string;
};

const allowedTypes = new Set<string>(dumpsterServiceDateTypeOptions);

function asString(value: string | null | undefined) {
  return value ?? "";
}

export function mapDumpsterServiceDateRowToRecord(
  row: DumpsterServiceDateRow,
): DumpsterServiceDateRecord {
  return {
    id: row.id,
    dumpsterId: row.dumpster_id,
    serviceDate: row.service_date,
    serviceType: allowedTypes.has(row.service_type)
      ? (row.service_type as DumpsterServiceDateType)
      : "Other",
    notes: asString(row.notes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function validateDumpsterServiceDateInput(input: DumpsterServiceDateInput) {
  if (!String(input.serviceDate ?? "").trim()) {
    return "Date is required.";
  }

  if (!allowedTypes.has(String(input.serviceType ?? ""))) {
    return "Select a valid service type.";
  }

  return null;
}

export function buildDumpsterServiceDateInsert(
  dumpsterId: string,
  input: DumpsterServiceDateInput,
) {
  return {
    dumpster_id: dumpsterId,
    service_date: input.serviceDate,
    service_type: input.serviceType,
    notes: input.notes.trim() || null,
  };
}
