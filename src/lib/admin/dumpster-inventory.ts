import "server-only";

import { DUMPSTER_SELECT, type DumpsterRow } from "@/lib/admin/dumpster-inventory-shared";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

export type OfferedDumpsterProduct = {
  dumpsterSize: string;
  dumpsterProductId: string;
  displayLabel: string;
  activeCount: number;
};

function parseDumpsterSizeOrder(size: string) {
  const match = size.trim().match(/^(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function formatDumpsterProductLabel(size: string) {
  return `${size.trim()} dumpster`;
}

function getDumpsterProductIdForSize(size: string) {
  const normalized = size.trim().toLowerCase();
  if (normalized === "14 yard") return "default";
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "default";
}

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

export async function getOfferedDumpsterProducts(): Promise<OfferedDumpsterProduct[]> {
  const summary = await getDumpsterInventorySummary();

  return summary.countsBySize
    .filter((entry) => entry.activeCount > 0)
    .sort((left, right) => {
      const sizeDelta = parseDumpsterSizeOrder(left.size) - parseDumpsterSizeOrder(right.size);
      if (sizeDelta !== 0) return sizeDelta;
      return left.size.localeCompare(right.size);
    })
    .map((entry) => ({
      dumpsterSize: entry.size,
      dumpsterProductId: getDumpsterProductIdForSize(entry.size),
      displayLabel: formatDumpsterProductLabel(entry.size),
      activeCount: entry.activeCount,
    }));
}
