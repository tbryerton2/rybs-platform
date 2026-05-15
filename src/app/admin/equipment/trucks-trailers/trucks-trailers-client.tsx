"use client";

import { useMemo, useState } from "react";
import { ExclamationTriangleIcon, MagnifyingGlassIcon, ShieldCheckIcon, SignalIcon, TruckIcon } from "@heroicons/react/24/outline";
import { AdminSummaryCard } from "@/app/admin/_components/AdminSummaryCard";
import type { VehicleRecord } from "@/lib/admin/equipment";

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(`${value}T12:00:00`));
}

function formatTimestamp(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function formatStatusTone(value: string) {
  if (value === "Current" || value === "Online" || value === "Active") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }
  if (value === "Due soon" || value === "Needs attention") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }
  if (value === "Expired" || value === "Offline" || value === "Inactive" || value === "Needs service") {
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  }
  return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
}

export function TrucksTrailersClient({
  initialRecords,
  loadError,
}: {
  initialRecords: VehicleRecord[];
  loadError: string | null;
}) {
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const records = initialRecords;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records
      .filter((item) => includeInactive || item.active)
      .filter((item) => {
        if (!q) return true;
        return [item.unitName, item.equipmentType, item.vin, item.plateNumber, item.tracker.trackerId, item.equipmentId]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.unitName.localeCompare(b.unitName);
      });
  }, [includeInactive, records, search]);

  const selected = filtered.find((item) => item.id === selectedId) ?? records.find((item) => item.id === selectedId) ?? null;
  const activeCount = records.filter((item) => item.active).length;
  const dueSoonCount = records.filter((item) => item.inspectionStatus !== "Current" || item.registrationExpiration).filter((item) => {
    const dates = [item.registrationExpiration, item.inspectionExpiration, item.insuranceRenewalDate, item.nextServiceDue].filter(Boolean);
    const now = new Date();
    return dates.some((value) => {
      const date = new Date(`${value}T00:00:00`);
      const diff = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 45;
    });
  }).length;
  const trackerEnabled = records.filter((item) => item.tracker.enabled).length;

  function openReview(id: string) {
    setSelectedId(id);
  }

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
        />
        <AdminSummaryCard
          label="Trackers enabled"
          value={trackerEnabled}
          icon={SignalIcon}
          tone="blue"
          layout="pricing"
          stretch
        />
        <AdminSummaryCard
          label="Maintenance due soon"
          value={dueSoonCount}
          icon={ExclamationTriangleIcon}
          tone="rose"
          layout="pricing"
          stretch
        />
      </section>

      <section className="rounded-[32px] bg-white px-6 pb-6 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-8 sm:pt-7">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Search trucks & trailers</h2>
        </div>
        <div className="mt-5 flex flex-col gap-3 lg:flex-row">
          <label className="relative block flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search unit, type, VIN, plate, or tracker ID" className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none focus:border-[#F97316]" />
          </label>
          <label className="inline-flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]" />
            Include inactive
          </label>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)]">
        <div className="overflow-hidden rounded-[32px] bg-white shadow-xl ring-1 ring-slate-200/70">
          <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
            <div className="text-lg font-semibold tracking-tight text-slate-900">Trucks & trailers</div>
            <div className="mt-1 text-sm text-slate-500">{filtered.length} {filtered.length === 1 ? "record" : "records"}</div>
          </div>
          {loadError ? (
            <div className="px-6 py-10 sm:px-8">
              <div className="rounded-[24px] border border-rose-200 bg-rose-50/80 p-5">
                <div className="flex items-start gap-3">
                  <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 text-rose-600" />
                  <div>
                    <div className="text-sm font-semibold text-rose-900">Unable to load trucks and trailers</div>
                    <p className="mt-1 text-sm leading-6 text-rose-800">{loadError}</p>
                  </div>
                </div>
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
                    <th className="px-6 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-8">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((item) => (
                    <tr key={item.id} className={selectedId === item.id ? "bg-orange-50/40" : "bg-white"}>
                      <td className="px-6 py-4 sm:px-8">
                        <button type="button" onClick={() => openReview(item.id)} className="text-left font-semibold text-slate-900 underline-offset-4 hover:underline">{item.unitName}</button>
                        <div className="mt-1 text-xs text-slate-500">{item.equipmentId} • {[item.make, item.model, item.year].filter(Boolean).join(" ") || "No make/model details"}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{item.equipmentType}</td>
                      <td className="px-4 py-4 text-slate-600">{item.plateNumber || "—"}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${formatStatusTone(item.inspectionStatus)}`}>
                          {item.inspectionStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${formatStatusTone(item.insuranceStatus)}`}>
                          {item.insuranceStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{item.tracker.enabled ? item.tracker.status : "Not installed"}</td>
                      <td className="px-6 py-4 sm:px-8">
                        <button type="button" onClick={() => openReview(item.id)} className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50">Review</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <div className="text-lg font-semibold text-slate-900">Unit details</div>
              <p className="mt-1 text-sm text-slate-500">
                Select a truck or trailer to review its compliance, maintenance, and tracker details.
              </p>
            </div>

            {selected ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="text-xl font-semibold text-slate-900">{selected.unitName}</div>
                  <div className="mt-1 text-sm text-slate-500">{selected.equipmentType} • {selected.equipmentId}</div>
                  <div className="mt-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${formatStatusTone(selected.active ? "Active" : "Inactive")}`}>
                      {selected.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <dl className="grid gap-4 sm:grid-cols-2">
                  {[
                    ["Registration", `${selected.plateNumber} • ${formatDate(selected.registrationExpiration)}`],
                    ["Inspection", `${selected.inspectionStatus} • ${formatDate(selected.inspectionExpiration)}`],
                    ["Insurance", `${selected.insuranceStatus} • ${formatDate(selected.insuranceRenewalDate)}`],
                    ["Service due", formatDate(selected.nextServiceDue)],
                    ["Tracker", selected.tracker.enabled ? `${selected.tracker.status} • ${selected.tracker.trackerId || "No ID"}` : "Not installed"],
                    ["Last updated", formatTimestamp(selected.updatedAt)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
                      <dd className="mt-2 text-sm font-medium text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheckIcon className="h-4 w-4" /> Fleet notes</div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">VIN</div>
                      <div className="mt-2 text-sm font-medium text-slate-900">{selected.vin || "—"}</div>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Default location</div>
                      <div className="mt-2 text-sm font-medium text-slate-900">{selected.defaultLocation || "—"}</div>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Assigned team</div>
                      <div className="mt-2 text-sm font-medium text-slate-900">{selected.assignedTeam || "—"}</div>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Maintenance status</div>
                      <div className="mt-2 text-sm font-medium text-slate-900">{selected.maintenanceStatus}</div>
                    </div>
                  </div>
                  {(selected.conditionNotes || selected.notes || selected.tracker.notes) ? (
                    <div className="mt-4 space-y-3">
                      {selected.conditionNotes ? (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Condition notes</div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{selected.conditionNotes}</p>
                        </div>
                      ) : null}
                      {selected.notes ? (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Operations notes</div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{selected.notes}</p>
                        </div>
                      ) : null}
                      {selected.tracker.notes ? (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Tracker notes</div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{selected.tracker.notes}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : loadError ? (
              <div className="mt-6 rounded-[24px] border border-dashed border-rose-200 bg-rose-50 px-5 py-8 text-center text-sm text-rose-700">
                Resolve the Supabase load error to review unit details.
              </div>
            ) : records.length === 0 ? (
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">
                Trucks and trailers will appear here once `fleet_equipment` has hosted Supabase rows.
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">
                Select a truck or trailer to review details.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
