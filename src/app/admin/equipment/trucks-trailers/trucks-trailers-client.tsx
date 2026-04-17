"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlassIcon, PencilSquareIcon, PlusIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import {
  complianceStatusOptions,
  createEmptyVehicle,
  createMockVehicles,
  trackerStatusOptions,
  vehicleEquipmentTypeOptions,
  vehicleMaintenanceStatusOptions,
  type VehicleRecord,
} from "@/lib/admin/equipment";

type VehicleErrors = Partial<Record<keyof VehicleRecord, string>>;

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

function validateVehicle(vehicle: VehicleRecord) {
  const errors: VehicleErrors = {};
  if (!vehicle.equipmentId.trim()) errors.equipmentId = "Equipment ID is required.";
  if (!vehicle.unitName.trim()) errors.unitName = "Unit name is required.";
  if (!vehicle.equipmentType.trim()) errors.equipmentType = "Equipment type is required.";
  if (!vehicle.vin.trim()) errors.vin = "VIN is required.";
  if (!vehicle.plateNumber.trim()) errors.plateNumber = "Plate or registration number is required.";
  if (vehicle.tracker.enabled && !vehicle.tracker.trackerId.trim()) errors.tracker = "Tracker ID is required when tracker support is enabled.";
  return errors;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium text-slate-700">{label}</div>
      {children}
      {error ? <div className="mt-1 text-xs font-medium text-rose-600">{error}</div> : null}
    </label>
  );
}

export function TrucksTrailersClient() {
  const [records, setRecords] = useState<VehicleRecord[]>(() => createMockVehicles());
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [draft, setDraft] = useState<VehicleRecord | null>(null);
  const [draftMode, setDraftMode] = useState<"create" | "edit">("create");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<VehicleErrors>({});

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
  }, [records, includeInactive, search]);

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

  function openCreate() {
    setDraft(createEmptyVehicle());
    setDraftMode("create");
    setSelectedId(null);
    setErrors({});
  }

  function openEdit(item: VehicleRecord) {
    setDraft({ ...item, tracker: { ...item.tracker } });
    setDraftMode("edit");
    setSelectedId(item.id);
    setErrors({});
  }

  function openReview(id: string) {
    setSelectedId(id);
    setDraft(null);
    setErrors({});
  }

  function updateDraft<K extends keyof VehicleRecord>(key: K, value: VehicleRecord[K]) {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function updateTracker<K extends keyof VehicleRecord["tracker"]>(key: K, value: VehicleRecord["tracker"][K]) {
    if (!draft) return;
    setDraft({ ...draft, tracker: { ...draft.tracker, [key]: value } });
    setErrors((current) => ({ ...current, tracker: undefined }));
  }

  function saveDraft() {
    if (!draft) return;
    const nextErrors = validateVehicle(draft);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    const now = new Date().toISOString();
    if (draftMode === "create") {
      const created = { ...draft, id: `vehicle_${crypto.randomUUID()}`, updatedAt: now };
      setRecords((current) => [created, ...current]);
      setDraft({ ...created, tracker: { ...created.tracker } });
      setDraftMode("edit");
      setSelectedId(created.id);
      return;
    }
    const saved = { ...draft, updatedAt: now };
    setRecords((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    setDraft({ ...saved, tracker: { ...saved.tracker } });
  }

  function toggleActive(id: string) {
    setRecords((current) => current.map((item) => (item.id === id ? { ...item, active: !item.active, updatedAt: new Date().toISOString() } : item)));
    setDraft((current) => current && current.id === id ? { ...current, active: !current.active, updatedAt: new Date().toISOString() } : current);
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active units", value: activeCount, hint: "Current trucks and trailers in the roster" },
          { label: "Compliance due soon", value: dueSoonCount, hint: "Registration, inspection, insurance, or service within 45 days" },
          { label: "Trackers enabled", value: trackerEnabled, hint: "Units with tracker configuration turned on" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
            <div className="text-sm font-medium text-slate-500">{stat.label}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{stat.value}</div>
            <div className="mt-2 text-xs text-slate-500">{stat.hint}</div>
          </div>
        ))}
      </section>

      <section className="rounded-[32px] bg-white px-6 pb-6 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-8 sm:pt-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Fleet units</h2>
            <p className="mt-1 text-sm text-slate-500">Track trucks and trailers with a unified operational roster for compliance, maintenance, and tracker status.</p>
          </div>
          <button type="button" onClick={openCreate} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-orange-600">
            <PlusIcon className="h-4 w-4" />
            Add unit
          </button>
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
                      <div className="mt-1 text-xs text-slate-500">{item.equipmentId} • {item.make} {item.model} {item.year}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{item.equipmentType}</td>
                    <td className="px-4 py-4 text-slate-600">{item.plateNumber}</td>
                    <td className="px-4 py-4 text-slate-600">{item.inspectionStatus}</td>
                    <td className="px-4 py-4 text-slate-600">{item.insuranceStatus}</td>
                    <td className="px-4 py-4 text-slate-600">{item.tracker.enabled ? item.tracker.status : "Not installed"}</td>
                    <td className="px-6 py-4 sm:px-8">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => openReview(item.id)} className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50">Review</button>
                        <button type="button" onClick={() => openEdit(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"><PencilSquareIcon className="h-4 w-4" />Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">{draft ? (draftMode === "create" ? "Add unit" : "Edit unit") : "Unit details"}</div>
                <p className="mt-1 text-sm text-slate-500">{draft ? "Capture compliance, maintenance, ownership, and tracker details." : "Select a truck or trailer to review it, or add a new unit."}</p>
              </div>
              {draft && draftMode === "edit" && draft.id ? (
                <button type="button" onClick={() => toggleActive(draft.id)} className="inline-flex h-10 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  {draft.active ? "Deactivate" : "Reactivate"}
                </button>
              ) : null}
            </div>

            {draft ? (
              <div className="mt-6 space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Internal equipment ID" error={errors.equipmentId}>
                    <input value={draft.equipmentId} onChange={(event) => updateDraft("equipmentId", event.target.value.toUpperCase())} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Unit name / label" error={errors.unitName}>
                    <input value={draft.unitName} onChange={(event) => updateDraft("unitName", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Equipment type">
                    <select value={draft.equipmentType} onChange={(event) => updateDraft("equipmentType", event.target.value as VehicleRecord["equipmentType"])} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]">
                      {vehicleEquipmentTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                  <Field label="Make">
                    <input value={draft.make} onChange={(event) => updateDraft("make", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Model">
                    <input value={draft.model} onChange={(event) => updateDraft("model", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Year">
                    <input value={draft.year} onChange={(event) => updateDraft("year", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="VIN" error={errors.vin}>
                    <input value={draft.vin} onChange={(event) => updateDraft("vin", event.target.value.toUpperCase())} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Plate / registration number" error={errors.plateNumber}>
                    <input value={draft.plateNumber} onChange={(event) => updateDraft("plateNumber", event.target.value.toUpperCase())} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Registration expiration">
                    <input type="date" value={draft.registrationExpiration} onChange={(event) => updateDraft("registrationExpiration", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Inspection expiration">
                    <input type="date" value={draft.inspectionExpiration} onChange={(event) => updateDraft("inspectionExpiration", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Inspection status">
                    <select value={draft.inspectionStatus} onChange={(event) => updateDraft("inspectionStatus", event.target.value as VehicleRecord["inspectionStatus"])} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]">
                      {complianceStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                  <Field label="Insurance renewal date">
                    <input type="date" value={draft.insuranceRenewalDate} onChange={(event) => updateDraft("insuranceRenewalDate", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Insurance status">
                    <select value={draft.insuranceStatus} onChange={(event) => updateDraft("insuranceStatus", event.target.value as VehicleRecord["insuranceStatus"])} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]">
                      {complianceStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                  <Field label="Mileage / odometer">
                    <input value={draft.mileage} onChange={(event) => updateDraft("mileage", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="GVWR / capacity">
                    <input value={draft.gvwr} onChange={(event) => updateDraft("gvwr", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Assigned driver / team">
                    <input value={draft.assignedTeam} onChange={(event) => updateDraft("assignedTeam", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Default location">
                    <input value={draft.defaultLocation} onChange={(event) => updateDraft("defaultLocation", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Maintenance status">
                    <select value={draft.maintenanceStatus} onChange={(event) => updateDraft("maintenanceStatus", event.target.value as VehicleRecord["maintenanceStatus"])} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]">
                      {vehicleMaintenanceStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                  <Field label="Next service due">
                    <input type="date" value={draft.nextServiceDue} onChange={(event) => updateDraft("nextServiceDue", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Maintenance / condition notes">
                      <textarea value={draft.conditionNotes} onChange={(event) => updateDraft("conditionNotes", event.target.value)} rows={3} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#F97316]" />
                    </Field>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheckIcon className="h-4 w-4" /> Tracker and compliance notes</div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                      <input type="checkbox" checked={draft.tracker.enabled} onChange={(event) => updateTracker("enabled", event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]" />
                      Tracker enabled
                    </label>
                    <Field label="Tracker provider">
                      <input value={draft.tracker.provider} onChange={(event) => updateTracker("provider", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                    </Field>
                    <Field label="Tracker ID / device ID" error={errors.tracker}>
                      <input value={draft.tracker.trackerId} onChange={(event) => updateTracker("trackerId", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                    </Field>
                    <Field label="Installation date">
                      <input type="date" value={draft.tracker.installationDate} onChange={(event) => updateTracker("installationDate", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                    </Field>
                    <Field label="Last check-in / last seen">
                      <input type="datetime-local" value={draft.tracker.lastCheckIn ? draft.tracker.lastCheckIn.slice(0, 16) : ""} onChange={(event) => updateTracker("lastCheckIn", event.target.value ? new Date(event.target.value).toISOString() : "")} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                    </Field>
                    <Field label="Tracker status">
                      <select value={draft.tracker.status} onChange={(event) => updateTracker("status", event.target.value as VehicleRecord["tracker"]["status"])} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]">
                        {trackerStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Compliance / troubleshooting notes">
                        <textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} rows={3} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#F97316]" />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
                  <div className="text-xs text-slate-500">Last updated {draft.updatedAt ? formatTimestamp(draft.updatedAt) : "not yet saved"}</div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDraft(null)} className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button>
                    <button type="button" onClick={saveDraft} className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800">{draftMode === "create" ? "Create unit" : "Save changes"}</button>
                  </div>
                </div>
              </div>
            ) : selected ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="text-xl font-semibold text-slate-900">{selected.unitName}</div>
                  <div className="mt-1 text-sm text-slate-500">{selected.equipmentType} • {selected.equipmentId}</div>
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
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">
                Select a truck or trailer to review details, or add a new unit.
              </div>
            )}
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-slate-50/80 p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Data status</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">This page uses typed local mock state designed for a future shared equipment table or fleet module, with maintenance, compliance, and tracker fields ready to persist.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
