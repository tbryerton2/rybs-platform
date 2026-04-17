"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlassIcon, PencilSquareIcon, PlusIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import {
  createEmptyDumpster,
  createMockDumpsters,
  dumpsterMaintenanceStatusOptions,
  dumpsterOperationalStatusOptions,
  serviceStatusOptions,
  trackerStatusOptions,
  type DumpsterRecord,
} from "@/lib/admin/equipment";

type DumpsterErrors = Partial<Record<keyof DumpsterRecord, string>>;

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

function validateDumpster(dumpster: DumpsterRecord) {
  const errors: DumpsterErrors = {};
  if (!dumpster.equipmentId.trim()) errors.equipmentId = "Equipment ID is required.";
  if (!dumpster.displayName.trim()) errors.displayName = "Display name is required.";
  if (!dumpster.size.trim()) errors.size = "Size is required.";
  if (dumpster.tracker.enabled && !dumpster.tracker.trackerId.trim()) {
    errors.tracker = "Tracker ID is required when tracker support is enabled.";
  }
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

export function DumpstersClient() {
  const [dumpsters, setDumpsters] = useState<DumpsterRecord[]>(() => createMockDumpsters());
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [draft, setDraft] = useState<DumpsterRecord | null>(null);
  const [draftMode, setDraftMode] = useState<"create" | "edit">("create");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<DumpsterErrors>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dumpsters
      .filter((item) => includeInactive || item.active)
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
  }, [dumpsters, includeInactive, search]);

  const selected = filtered.find((item) => item.id === selectedId) ?? dumpsters.find((item) => item.id === selectedId) ?? null;
  const activeCount = dumpsters.filter((item) => item.active).length;
  const trackerEnabledCount = dumpsters.filter((item) => item.tracker.enabled).length;
  const maintenanceAttention = dumpsters.filter((item) => item.maintenanceStatus !== "Current").length;

  function openCreate() {
    setDraft(createEmptyDumpster());
    setDraftMode("create");
    setSelectedId(null);
    setErrors({});
  }

  function openEdit(item: DumpsterRecord) {
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

  function updateDraft<K extends keyof DumpsterRecord>(key: K, value: DumpsterRecord[K]) {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function updateTracker<K extends keyof DumpsterRecord["tracker"]>(key: K, value: DumpsterRecord["tracker"][K]) {
    if (!draft) return;
    setDraft({ ...draft, tracker: { ...draft.tracker, [key]: value } });
    setErrors((current) => ({ ...current, tracker: undefined }));
  }

  function saveDraft() {
    if (!draft) return;
    const nextErrors = validateDumpster(draft);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    const now = new Date().toISOString();
    if (draftMode === "create") {
      const created = { ...draft, id: `dumpster_${crypto.randomUUID()}`, updatedAt: now };
      setDumpsters((current) => [created, ...current]);
      setDraft({ ...created, tracker: { ...created.tracker } });
      setDraftMode("edit");
      setSelectedId(created.id);
      return;
    }
    const saved = { ...draft, updatedAt: now };
    setDumpsters((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    setDraft({ ...saved, tracker: { ...saved.tracker } });
  }

  function toggleActive(id: string) {
    setDumpsters((current) =>
      current.map((item) => (item.id === id ? { ...item, active: !item.active, updatedAt: new Date().toISOString() } : item)),
    );
    setDraft((current) =>
      current && current.id === id ? { ...current, active: !current.active, updatedAt: new Date().toISOString() } : current,
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active dumpsters", value: activeCount, hint: "Managed inventory in service" },
          { label: "Trackers enabled", value: trackerEnabledCount, hint: "Units with tracker configuration" },
          { label: "Maintenance attention", value: maintenanceAttention, hint: "Units due soon or needing service" },
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
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Dumpster fleet</h2>
            <p className="mt-1 text-sm text-slate-500">Manage container inventory, readiness, inspections, and tracker status from a single operational roster.</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <PlusIcon className="h-4 w-4" />
            Add dumpster
          </button>
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

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)]">
        <div className="overflow-hidden rounded-[32px] bg-white shadow-xl ring-1 ring-slate-200/70">
          <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
            <div className="text-lg font-semibold tracking-tight text-slate-900">Dumpster records</div>
            <div className="mt-1 text-sm text-slate-500">{filtered.length} {filtered.length === 1 ? "record" : "records"}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50/80">
                <tr className="text-left">
                  <th className="px-6 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-8">Unit</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Size</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Location</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Operational</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Tracker</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Status</th>
                  <th className="px-6 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-8">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((item) => (
                  <tr key={item.id} className={selectedId === item.id ? "bg-orange-50/40" : "bg-white"}>
                    <td className="px-6 py-4 sm:px-8">
                      <button type="button" onClick={() => openReview(item.id)} className="text-left font-semibold text-slate-900 underline-offset-4 hover:underline">
                        {item.displayName}
                      </button>
                      <div className="mt-1 text-xs text-slate-500">{item.equipmentId} • {item.assetTag || "No asset tag"}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{item.size}</td>
                    <td className="px-4 py-4 text-slate-600">{item.yardLocation || "—"}</td>
                    <td className="px-4 py-4 text-slate-600">{item.operationalStatus}</td>
                    <td className="px-4 py-4 text-slate-600">{item.tracker.enabled ? item.tracker.status : "Not installed"}</td>
                    <td className="px-4 py-4">
                      <span className={["inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", item.active ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"].join(" ")}>
                        {item.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 sm:px-8">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => openReview(item.id)} className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50">Review</button>
                        <button type="button" onClick={() => openEdit(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50">
                          <PencilSquareIcon className="h-4 w-4" />
                          Edit
                        </button>
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
                <div className="text-lg font-semibold text-slate-900">{draft ? (draftMode === "create" ? "Add dumpster" : "Edit dumpster") : "Dumpster details"}</div>
                <p className="mt-1 text-sm text-slate-500">{draft ? "Capture operational status, inspection timing, and tracker configuration." : "Select a dumpster to review details, or add a new managed unit."}</p>
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
                  <Field label="Display name / label" error={errors.displayName}>
                    <input value={draft.displayName} onChange={(event) => updateDraft("displayName", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Size" error={errors.size}>
                    <input value={draft.size} onChange={(event) => updateDraft("size", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Dimensions">
                    <input value={draft.dimensions} onChange={(event) => updateDraft("dimensions", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Yard / default location">
                    <input value={draft.yardLocation} onChange={(event) => updateDraft("yardLocation", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="In-service date">
                    <input type="date" value={draft.inServiceDate} onChange={(event) => updateDraft("inServiceDate", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Operational status">
                    <select value={draft.operationalStatus} onChange={(event) => updateDraft("operationalStatus", event.target.value as DumpsterRecord["operationalStatus"])} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]">
                      {dumpsterOperationalStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                  <Field label="Maintenance status">
                    <select value={draft.maintenanceStatus} onChange={(event) => updateDraft("maintenanceStatus", event.target.value as DumpsterRecord["maintenanceStatus"])} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]">
                      {dumpsterMaintenanceStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                  <Field label="Service status">
                    <select value={draft.serviceStatus} onChange={(event) => updateDraft("serviceStatus", event.target.value as DumpsterRecord["serviceStatus"])} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]">
                      {serviceStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                  <Field label="Next inspection / maintenance due">
                    <input type="date" value={draft.nextInspectionDue} onChange={(event) => updateDraft("nextInspectionDue", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Serial number">
                    <input value={draft.serialNumber} onChange={(event) => updateDraft("serialNumber", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Manufacturer">
                    <input value={draft.manufacturer} onChange={(event) => updateDraft("manufacturer", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <Field label="Model">
                    <input value={draft.model} onChange={(event) => updateDraft("model", event.target.value)} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]" />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Condition / notes">
                      <textarea value={draft.conditionNotes} onChange={(event) => updateDraft("conditionNotes", event.target.value)} rows={3} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#F97316]" />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Operational notes">
                      <textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} rows={3} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#F97316]" />
                    </Field>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><WrenchScrewdriverIcon className="h-4 w-4" /> Tracker configuration</div>
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
                      <select value={draft.tracker.status} onChange={(event) => updateTracker("status", event.target.value as DumpsterRecord["tracker"]["status"])} className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#F97316]">
                        {trackerStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Tracker notes / troubleshooting">
                        <textarea value={draft.tracker.notes} onChange={(event) => updateTracker("notes", event.target.value)} rows={3} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#F97316]" />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
                  <div className="text-xs text-slate-500">Last updated {draft.updatedAt ? formatTimestamp(draft.updatedAt) : "not yet saved"}</div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDraft(null)} className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button>
                    <button type="button" onClick={saveDraft} className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800">
                      {draftMode === "create" ? "Create dumpster" : "Save changes"}
                    </button>
                  </div>
                </div>
              </div>
            ) : selected ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="text-xl font-semibold text-slate-900">{selected.displayName}</div>
                  <div className="mt-1 text-sm text-slate-500">{selected.size} • {selected.equipmentId}</div>
                </div>
                <dl className="grid gap-4 sm:grid-cols-2">
                  {[
                    ["Operational status", selected.operationalStatus],
                    ["Maintenance status", selected.maintenanceStatus],
                    ["Location", selected.yardLocation || "—"],
                    ["Next due", formatDate(selected.nextInspectionDue)],
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
                  <div className="text-sm font-semibold text-slate-900">Notes</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selected.notes || selected.conditionNotes || "No notes added yet."}</p>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">
                Select a dumpster to review details, or add a new managed unit.
              </div>
            )}
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-slate-50/80 p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Inventory direction</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">This page treats managed dumpster records as the intended inventory source of truth. App-level fallback fleet counts now read from this managed roster, while database availability still needs to be wired to persistent equipment records.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
