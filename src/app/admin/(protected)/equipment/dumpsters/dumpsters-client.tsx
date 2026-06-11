"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ChevronRightIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SignalIcon,
} from "@heroicons/react/24/outline";
import { AdminSummaryCard } from "@/app/admin/_components/AdminSummaryCard";
import type { DumpsterRecord } from "@/lib/admin/equipment";
import { ServiceWarningPill } from "./operational-status-pill";

type SummaryFilter = "active" | "tracker" | "maintenance" | null;

export function DumpstersClient({
  initialDumpsters,
  initialSummaryFilter = null,
}: {
  initialDumpsters: DumpsterRecord[];
  initialSummaryFilter?: SummaryFilter;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>(initialSummaryFilter);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const forceIncludeInactive =
      summaryFilter === "tracker" || summaryFilter === "maintenance";

    return initialDumpsters
      .filter((item) => forceIncludeInactive || includeInactive || item.active)
      .filter((item) => {
        if (summaryFilter === "active") return item.active;
        if (summaryFilter === "tracker") return item.tracker.enabled;
        if (summaryFilter === "maintenance") return Boolean(item.serviceWarning);
        return true;
      })
      .filter((item) => {
        if (!q) return true;
        return [
          item.displayName,
          item.size,
          item.equipmentId,
          item.tracker.trackerId,
          item.assetTag,
          item.serialNumber,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [includeInactive, initialDumpsters, search, summaryFilter]);

  const activeCount = initialDumpsters.filter((item) => item.active).length;
  const trackerEnabledCount = initialDumpsters.filter((item) => item.tracker.enabled).length;
  const maintenanceAttention = initialDumpsters.filter((item) => Boolean(item.serviceWarning)).length;

  function updateFilterParam(nextFilter: SummaryFilter) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextFilter) {
      params.set("filter", nextFilter);
    } else {
      params.delete("filter");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function selectSummaryFilter(nextFilter: Exclude<SummaryFilter, null>) {
    setSummaryFilter(nextFilter);
    updateFilterParam(nextFilter);
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Dumpsters
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Link
            href="/admin/equipment/dumpsters/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <PlusIcon className="h-4 w-4" />
            Add dumpster
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <AdminSummaryCard
          label="Active dumpsters"
          value={activeCount}
          icon={CubeIcon}
          tone="amber"
          onClick={() => selectSummaryFilter("active")}
          active={summaryFilter === "active"}
          layout="pricing"
          stretch
        />
        <AdminSummaryCard
          label="Trackers enabled"
          value={trackerEnabledCount}
          icon={SignalIcon}
          tone="blue"
          onClick={() => selectSummaryFilter("tracker")}
          active={summaryFilter === "tracker"}
          layout="pricing"
          stretch
        />
        <AdminSummaryCard
          label="Maintenance due soon"
          value={maintenanceAttention}
          icon={ExclamationTriangleIcon}
          tone="rose"
          onClick={() => selectSummaryFilter("maintenance")}
          active={summaryFilter === "maintenance"}
          layout="pricing"
          stretch
        />
      </section>

      <section className="rounded-[32px] bg-white px-6 pb-6 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-8 sm:pt-7">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Search Dumpsters</h2>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row">
          <label className="relative block flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, size, internal ID, or tracker ID"
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
        </div>
      </section>

      <section className="overflow-hidden rounded-[32px] bg-white shadow-xl ring-1 ring-slate-200/70">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="text-lg font-semibold tracking-tight text-slate-900">Dumpster records</div>
            <div className="text-sm text-slate-500">
              {filtered.length} {filtered.length === 1 ? "dumpster" : "dumpsters"}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/80">
              <tr className="text-left">
                <th className="px-6 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-8">Unit</th>
                <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Size</th>
                <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Location</th>
                <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Tracker</th>
                <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Status</th>
                <th className="px-6 py-3.5 sm:px-8" aria-label="Open dumpster details" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open dumpster ${item.displayName}`}
                  onClick={() => router.push(`/admin/equipment/dumpsters/${item.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/admin/equipment/dumpsters/${item.id}`);
                    }
                  }}
                  className="group cursor-pointer bg-white transition hover:bg-slate-50/70 focus-visible:bg-slate-50/70 focus-visible:outline-none"
                >
                  <td className="px-6 py-4 sm:px-8">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 transition group-hover:text-slate-950 group-focus-visible:text-slate-950">
                        {item.displayName}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.assetTag ? `${item.equipmentId} • ${item.assetTag}` : item.equipmentId}
                      </div>
                      {item.serviceWarning ? (
                        <div className="mt-2">
                          <ServiceWarningPill warning={item.serviceWarning} />
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{item.size}</td>
                  <td className="px-4 py-4 text-slate-600">{item.yardLocation || "—"}</td>
                  <td className="px-4 py-4 text-slate-600">
                    {item.tracker.enabled ? item.tracker.status : "Not installed"}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={[
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                        item.active
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
                      ].join(" ")}
                    >
                      {item.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 sm:px-8">
                    <div className="flex justify-end">
                      <span
                        aria-hidden="true"
                        className="inline-flex items-center justify-center rounded-full p-2 text-slate-400 transition group-hover:translate-x-0.5 group-hover:scale-110 group-hover:text-slate-700 group-focus-visible:translate-x-0.5 group-focus-visible:scale-110 group-focus-visible:text-slate-700"
                      >
                        <ChevronRightIcon className="h-6 w-6" />
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
