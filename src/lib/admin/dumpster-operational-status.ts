import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { DumpsterDerivedOperationalStatus, DumpsterRecord } from "@/lib/admin/equipment";
import { getCurrentTenant } from "@/lib/tenant/server";

type DumpsterBookingStatusRow = {
  dumpster_id: string | null;
  delivery_date: string | null;
  status: string | null;
};

const SCHEDULED_BOOKING_STATUSES = new Set(["confirmed", "scheduled", "paid"]);
const ON_RENT_BOOKING_STATUSES = new Set(["delivered"]);

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function isLegacyMaintenanceFallback(record: DumpsterRecord) {
  // TODO: replace this fallback with first-class maintenance scheduling/unavailability data.
  return (
    record.serviceStatus === "Out of service" ||
    record.operationalStatus === "Maintenance hold" ||
    record.maintenanceStatus === "Needs service"
  );
}

export function deriveDumpsterOperationalStatus(
  record: DumpsterRecord,
  bookingRows: DumpsterBookingStatusRow[],
): DumpsterDerivedOperationalStatus {
  if (!record.active) {
    return "Maintenance / unavailable";
  }

  if (bookingRows.some((row) => ON_RENT_BOOKING_STATUSES.has(normalizeStatus(row.status)))) {
    return "On rent";
  }

  if (
    bookingRows.some(
      (row) =>
        SCHEDULED_BOOKING_STATUSES.has(normalizeStatus(row.status)) &&
        Boolean(String(row.delivery_date ?? "").trim()),
    )
  ) {
    return "Scheduled";
  }

  if (isLegacyMaintenanceFallback(record)) {
    return "Maintenance / unavailable";
  }

  return "Available";
}

export async function decorateDumpstersWithOperationalStatus(records: DumpsterRecord[]) {
  if (records.length === 0) return records;
  const tenant = await getCurrentTenant();

  const dumpsterIds = Array.from(new Set(records.map((record) => record.id).filter(Boolean)));
  if (dumpsterIds.length === 0) return records;

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("dumpster_id, delivery_date, status")
    .eq("business_id", tenant.id)
    .in("dumpster_id", dumpsterIds)
    .not("dumpster_id", "is", null)
    .order("delivery_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const bookingsByDumpster = new Map<string, DumpsterBookingStatusRow[]>();
  for (const row of (data ?? []) as DumpsterBookingStatusRow[]) {
    if (!row.dumpster_id) continue;
    const current = bookingsByDumpster.get(row.dumpster_id) ?? [];
    current.push(row);
    bookingsByDumpster.set(row.dumpster_id, current);
  }

  return records.map((record) => ({
    ...record,
    derivedOperationalStatus: deriveDumpsterOperationalStatus(
      record,
      bookingsByDumpster.get(record.id) ?? [],
    ),
  }));
}
