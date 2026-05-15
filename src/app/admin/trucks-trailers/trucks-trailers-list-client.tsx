"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ChevronRightIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  SignalIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { AdminSummaryCard } from "@/app/admin/_components/AdminSummaryCard";
import { shouldCountFleetEquipmentForMaintenanceAttention } from "@/lib/admin/fleet-equipment-attention";
import type { FleetEquipmentRecord } from "@/lib/admin/fleet-equipment-shared";
import type { FleetEquipmentInspectionStatus } from "./data";

type SummaryFilter = "all" | "active" | "tracker" | "maintenance";

function formatDueStatus(value: string) {
  if (!value) return "Current";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Current";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return "Expired";
  if (diff <= 45) return "Due soon";
  return "Current";
}

function formatStatusTone(value: string) {
  if (value === "Current" || value === "Online" || value === "Active") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }
  if (value === "Due soon" || value === "Needs attention" || value === "Maintenance") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }
  if (value === "Expired" || value === "Offline" || value === "Inactive" || value === "Retired") {
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  }
  return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
}

function hasMaintenanceAttention(
  item: FleetEquipmentRecord,
  maintenanceAttentionIdSet: ReadonlySet<string>,
  inspectionStatusById: Record<string, FleetEquipmentInspectionStatus>,
) {
  return shouldCountFleetEquipmentForMaintenanceAttention(item, {
    serviceDateAttentionIds: maintenanceAttentionIdSet,
    inspectionStatusById,
  });
}

export function TrucksTrailersListClient({
  initialRecords,
  initialMaintenanceAttentionIds,
  initialInspectionStatusById,
  initialSummaryFilter = "all",
  loadError,
}: {
  initialRecords: FleetEquipmentRecord[];
  initialMaintenanceAttentionIds: string[];
  initialInspectionStatusById: Record<string, FleetEquipmentInspectionStatus>;
  initialSummaryFilter?: SummaryFilter;
  loadError: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>(initialSummaryFilter);
  const records = initialRecords;
  const maintenanceAttentionIdSet = useMemo(
    () => new Set(initialMaintenanceAttentionIds),
    [initialMaintenanceAttentionIds],
  );
  const inspectionStatusById = initialInspectionStatusById;

  function setSummaryFilterWithUrl(nextFilter: SummaryFilter) {
    setSummaryFilter(nextFilter);
    const params = new URLSearchParams(searchParams.toString());
    if (nextFilter === "all") {
      params.delete("filter");
    } else {
      params.set("filter", nextFilter);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records
      .filter((item) => {
        if (summaryFilter === "active") return item.status === "active";
        return includeInactive || item.status === "active";
      })
      .filter((item) => {
        if (summaryFilter === "tracker") return item.trackerEnabled;
        if (summaryFilter === "maintenance") return hasMaintenanceAttention(item, maintenanceAttentionIdSet, inspectionStatusById);
        return true;
      })
      .filter((item) => {
        if (!q) return true;
        return [
          item.name,
          item.equipmentType,
          item.vin,
          item.licensePlate,
          item.trackerIdentifier,
          item.id,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        if ((a.status === "active") !== (b.status === "active")) {
          return a.status === "active" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  }, [includeInactive, inspectionStatusById, maintenanceAttentionIdSet, records, search, summaryFilter]);

  const activeCount = records.filter((item) => item.status === "active").length;
  const dueSoonCount = records.filter((item) => hasMaintenanceAttention(item, maintenanceAttentionIdSet, inspectionStatusById)).length;
  const trackerEnabled = records.filter((item) => item.trackerEnabled).length;
  const hasActiveFilters = summaryFilter !== "all" || includeInactive || search.trim().length > 0;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <AdminSummaryCard
          label="Active units"
          value={activeCount}
          icon={TruckIcon}
          tone="amber"
          layout="pricing"
          stretch
          active={summaryFilter === "active"}
          onClick={() => setSummaryFilterWithUrl("active")}
        />
        <AdminSummaryCard
          label="Trackers enabled"
          value={trackerEnabled}
          icon={SignalIcon}
          tone="blue"
          layout="pricing"
          stretch
          active={summaryFilter === "tracker"}
          onClick={() => setSummaryFilterWithUrl("tracker")}
        />
        <AdminSummaryCard
          label="Maintenance due soon"
          value={dueSoonCount}
          icon={ExclamationTriangleIcon}
          tone="rose"
          layout="pricing"
          stretch
          active={summaryFilter === "maintenance"}
          onClick={() => setSummaryFilterWithUrl("maintenance")}
        />
      </section>

      <section className="rounded-[32px] bg-white px-6 pb-6 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-8 sm:pt-7">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Search trucks & trailers</h2>
        </div>
        <div className="mt-5 flex flex-col gap-3 lg:flex-row">
          <label className="relative block flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, type, VIN, plate, or tracker ID"
              className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none focus:border-[#F97316]"
            />
          </label>
          <label className="inline-flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
            />
            Include inactive
          </label>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setIncludeInactive(false);
              setSummaryFilterWithUrl("all");
            }}
            disabled={!hasActiveFilters}
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear filters
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[32px] bg-white shadow-xl ring-1 ring-slate-200/70">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="text-lg font-semibold tracking-tight text-slate-900">Trucks & trailers</div>
            <div className="text-sm text-slate-500">
              {filtered.length} {filtered.length === 1 ? "record" : "records"}
            </div>
          </div>
        </div>

        {loadError ? (
          <div className="px-6 py-10 sm:px-8">
            <div className="rounded-[24px] border border-rose-200 bg-rose-50/80 p-5">
              <div className="text-sm font-semibold text-rose-900">Unable to load trucks and trailers</div>
              <p className="mt-1 text-sm leading-6 text-rose-800">{loadError}</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 sm:px-8">
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">
              {records.length === 0
                ? "No trucks or trailers have been added yet."
                : "No trucks or trailers match the current filters."}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50/80">
                <tr className="text-left">
                  <th className="px-6 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-8">Unit</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Type</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Plate</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Inspection</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Insurance</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Tracker</th>
                  <th className="px-6 py-3.5 sm:px-8" aria-label="Open equipment details" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Open ${item.name}`}
                    onClick={() => router.push(`/admin/trucks-trailers/${item.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/admin/trucks-trailers/${item.id}`);
                      }
                    }}
                    className="group cursor-pointer bg-white transition hover:bg-slate-50/70 focus-visible:bg-slate-50/70 focus-visible:outline-none"
                  >
                    <td className="px-6 py-4 sm:px-8">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.id} • {item.status}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {item.equipmentType === "truck" ? "Truck" : "Trailer"}
                    </td>
                    <td className="px-4 py-4 text-slate-600">{item.licensePlate || "—"}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${formatStatusTone(inspectionStatusById[item.id] ?? "Not set")}`}>
                        {inspectionStatusById[item.id] ?? "Not set"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${formatStatusTone(formatDueStatus(item.insuranceExpirationDate))}`}>
                        {formatDueStatus(item.insuranceExpirationDate)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {item.trackerEnabled ? item.trackerProvider || item.trackerIdentifier || "Enabled" : "Not installed"}
                    </td>
                    <td className="px-6 py-4 sm:px-8">
                      <div className="flex justify-end">
                        <span
                          aria-hidden="true"
                          className="inline-flex items-center justify-center rounded-full p-2 text-slate-400 transition group-hover:translate-x-0.5 group-hover:scale-110 group-hover:text-slate-700 group-focus-visible:translate-x-0.5 group-focus-visible:scale-110 group-focus-visible:text-slate-700"
                        >
                          <ChevronRightIcon className="h-5 w-5" />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
