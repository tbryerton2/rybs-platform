"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { SavedServiceLocation } from "@/lib/service-locations";

type LocationFormValues = {
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  deliveryNotes: string;
  accessNotes: string;
  onsiteContactName: string;
  onsiteContactPhone: string;
  isDefault: boolean;
};

type FieldErrors = Partial<Record<keyof LocationFormValues, string>>;

const emptyForm: LocationFormValues = {
  label: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  deliveryNotes: "",
  accessNotes: "",
  onsiteContactName: "",
  onsiteContactPhone: "",
  isDefault: false,
};

function formatServiceLocationAddress(location: Pick<SavedServiceLocation, "street" | "city" | "state" | "zip">) {
  return [location.street, [location.city, location.state].filter(Boolean).join(", "), location.zip]
    .filter(Boolean)
    .join(" ");
}

function getServiceLocationNotePreview(value: string | null | undefined, maxLength = 120) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return null;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function asFormValues(location?: SavedServiceLocation | null): LocationFormValues {
  if (!location) return emptyForm;

  return {
    label: location.label,
    street: location.street,
    city: location.city,
    state: location.state,
    zip: location.zip,
    deliveryNotes: location.delivery_notes ?? "",
    accessNotes: location.access_notes ?? "",
    onsiteContactName: location.onsite_contact_name ?? "",
    onsiteContactPhone: location.onsite_contact_phone ?? "",
    isDefault: location.is_default,
  };
}

function fieldClass(error?: string) {
  return [
    "w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition",
    error ? "border-red-300 focus:border-red-400" : "border-slate-300 focus:border-[#F97316]",
  ].join(" ");
}

async function parseJson(response: Response) {
  return response.json().catch(() => ({}));
}

export function SavedLocationsManager({
  initialLocations,
}: {
  initialLocations: SavedServiceLocation[];
}) {
  const [locations, setLocations] = useState(initialLocations);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(initialLocations.length === 0);
  const [formValues, setFormValues] = useState<LocationFormValues>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedServiceLocation | null>(null);

  const sortedLocations = useMemo(
    () =>
      [...locations].sort((a, b) => {
        if (a.is_default === b.is_default) {
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }
        return a.is_default ? -1 : 1;
      }),
    [locations],
  );

  async function refreshLocations() {
    const response = await fetch("/api/portal/locations", { cache: "no-store" });
    const json = await parseJson(response);

    if (response.ok && json?.ok) {
      setLocations((json.locations ?? []) as SavedServiceLocation[]);
    }
  }

  function resetForm(next?: SavedServiceLocation | null) {
    setFieldErrors({});
    setFormError(null);
    setFormValues(asFormValues(next));
  }

  function openAddForm() {
    setEditingId(null);
    setSuccessMessage(null);
    resetForm();
    setShowForm(true);
  }

  function openEditForm(location: SavedServiceLocation) {
    setEditingId(location.id);
    setSuccessMessage(null);
    resetForm(location);
    setShowForm(true);
  }

  function closeForm() {
    setEditingId(null);
    resetForm();
    setShowForm(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPendingAction("save");
    setSuccessMessage(null);
    setFormError(null);
    setFieldErrors({});

    const endpoint = editingId ? `/api/portal/locations/${editingId}` : "/api/portal/locations";
    const method = editingId ? "PATCH" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formValues),
    });

    const json = await parseJson(response);

    if (!response.ok || !json?.ok || !json.location) {
      setPendingAction(null);
      setFormError(json?.error || "We couldn’t save that location right now.");
      setFieldErrors((json?.fieldErrors ?? {}) as FieldErrors);
      return;
    }

    await refreshLocations();
    setPendingAction(null);
    setSuccessMessage(editingId ? "Location updated." : "Location added.");
    closeForm();
  }

  async function handleSetDefault(location: SavedServiceLocation) {
    setPendingAction(`default:${location.id}`);
    setSuccessMessage(null);

    const response = await fetch(`/api/portal/locations/${location.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-default" }),
    });
    const json = await parseJson(response);

    if (!response.ok || !json?.ok || !json.location) {
      setPendingAction(null);
      setFormError(json?.error || "We couldn’t update the default location.");
      return;
    }

    await refreshLocations();
    setPendingAction(null);
    setFormError(null);
    setSuccessMessage("Default location updated.");
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    setPendingAction(`delete:${deleteTarget.id}`);
    setSuccessMessage(null);

    const response = await fetch(`/api/portal/locations/${deleteTarget.id}`, {
      method: "DELETE",
    });
    const json = await parseJson(response);

    if (!response.ok || !json?.ok) {
      setPendingAction(null);
      setFormError(json?.error || "We couldn’t delete that location.");
      return;
    }

    await refreshLocations();
    setDeleteTarget(null);
    setPendingAction(null);
    setFormError(null);
    setSuccessMessage("Location removed from saved locations. Past bookings were not changed.");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex rounded-full bg-[#F97316]/10 px-3 py-1 text-xs font-semibold text-[#F97316]">
              Save time on repeat bookings
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Reuse common delivery addresses
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              Save your most common service locations once, then pick them during future bookings
              instead of retyping the same address and notes every time.
            </p>
          </div>
          {!showForm ? (
            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Add location
            </button>
          ) : null}
        </div>

        {successMessage ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {successMessage}
          </div>
        ) : null}

        {formError && !showForm ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {formError}
          </div>
        ) : null}
      </section>

      {showForm ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">
              {editingId ? "Edit saved location" : "Add saved location"}
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Keep this simple. Save the address and any details that help avoid repeat delivery
              mistakes.
            </p>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            {formError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                {formError}
              </div>
            ) : null}

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Nickname</span>
                <input
                  value={formValues.label}
                  onChange={(event) => setFormValues((current) => ({ ...current, label: event.target.value }))}
                  className={fieldClass(fieldErrors.label)}
                  placeholder="Home, Main job site, Rental property"
                />
                {fieldErrors.label ? <div className="mt-2 text-sm text-red-700">{fieldErrors.label}</div> : null}
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Street address</span>
                <input
                  value={formValues.street}
                  onChange={(event) => setFormValues((current) => ({ ...current, street: event.target.value }))}
                  className={fieldClass(fieldErrors.street)}
                  autoComplete="street-address"
                />
                {fieldErrors.street ? <div className="mt-2 text-sm text-red-700">{fieldErrors.street}</div> : null}
              </label>

              <div className="grid gap-5 md:col-span-2 md:grid-cols-[minmax(0,1.45fr)_minmax(128px,0.75fr)_minmax(0,1fr)]">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">City</span>
                  <input
                    value={formValues.city}
                    onChange={(event) => setFormValues((current) => ({ ...current, city: event.target.value }))}
                    className={fieldClass(fieldErrors.city)}
                    autoComplete="address-level2"
                  />
                  {fieldErrors.city ? <div className="mt-2 text-sm text-red-700">{fieldErrors.city}</div> : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">State</span>
                  <input
                    value={formValues.state}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, state: event.target.value.toUpperCase() }))
                    }
                    className={fieldClass(fieldErrors.state)}
                    autoComplete="address-level1"
                    maxLength={2}
                  />
                  {fieldErrors.state ? <div className="mt-2 text-sm text-red-700">{fieldErrors.state}</div> : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">ZIP code</span>
                  <input
                    value={formValues.zip}
                    onChange={(event) => setFormValues((current) => ({ ...current, zip: event.target.value }))}
                    className={fieldClass(fieldErrors.zip)}
                    autoComplete="postal-code"
                  />
                  {fieldErrors.zip ? <div className="mt-2 text-sm text-red-700">{fieldErrors.zip}</div> : null}
                </label>
              </div>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Placement notes</span>
                <textarea
                  value={formValues.deliveryNotes}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, deliveryNotes: event.target.value }))
                  }
                  className={fieldClass(fieldErrors.deliveryNotes)}
                  rows={4}
                  placeholder="Example: Place on the left side of the driveway and avoid the basketball hoop."
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Access instructions</span>
                <input
                  value={formValues.accessNotes}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, accessNotes: event.target.value }))
                  }
                  className={fieldClass(fieldErrors.accessNotes)}
                  placeholder="Gate code, locked fence, tight driveway, or similar"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">On-site contact name</span>
                <input
                  value={formValues.onsiteContactName}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, onsiteContactName: event.target.value }))
                  }
                  className={fieldClass(fieldErrors.onsiteContactName)}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">On-site contact phone</span>
                <input
                  value={formValues.onsiteContactPhone}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, onsiteContactPhone: event.target.value }))
                  }
                  className={fieldClass(fieldErrors.onsiteContactPhone)}
                  inputMode="tel"
                />
                {fieldErrors.onsiteContactPhone ? (
                  <div className="mt-2 text-sm text-red-700">{fieldErrors.onsiteContactPhone}</div>
                ) : null}
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/85 px-4 py-3.5">
              <input
                type="checkbox"
                checked={formValues.isDefault}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, isDefault: event.target.checked }))
                }
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
              />
              <span className="text-sm leading-6 text-slate-600">
                <span className="block text-sm font-semibold text-slate-900">Make this my default location</span>
                <span className="mt-1 block text-sm leading-5 text-slate-500">
                  This location will be shown first the next time you start a booking.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={pendingAction === "save"}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingAction === "save" ? "Saving..." : editingId ? "Save changes" : "Save location"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {sortedLocations.length === 0 && !showForm ? (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <h3 className="text-xl font-semibold text-slate-900">No saved service locations yet</h3>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
            Save a job site, home, or rental property here so future bookings start faster and your
            placement notes stay consistent.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {sortedLocations.map((location) => (
            <article
              key={location.id}
              className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{location.label}</h3>
                    {location.is_default ? (
                      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-200">
                        Default location
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {formatServiceLocationAddress(location)}
                  </p>
                </div>
              </div>

              {location.delivery_notes ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                  {getServiceLocationNotePreview(location.delivery_notes, 180)}
                </div>
              ) : null}

              {(location.access_notes || location.onsite_contact_name || location.onsite_contact_phone) ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {location.access_notes ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Access instructions
                      </div>
                      <div className="mt-1 text-sm leading-6 text-slate-700">{location.access_notes}</div>
                    </div>
                  ) : null}
                  {(location.onsite_contact_name || location.onsite_contact_phone) ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        On-site contact
                      </div>
                      <div className="mt-1 text-sm leading-6 text-slate-700">
                        {[location.onsite_contact_name, location.onsite_contact_phone].filter(Boolean).join(" • ")}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => openEditForm(location)}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Edit
                </button>
                {!location.is_default ? (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(location)}
                    disabled={pendingAction === `default:${location.id}`}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingAction === `default:${location.id}` ? "Saving..." : "Set default"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setDeleteTarget(location)}
                  className="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {deleteTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-900">Delete saved location?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This only removes <span className="font-semibold text-slate-900">{deleteTarget.label}</span> from your
              saved locations. Past bookings will keep their original address details.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={pendingAction === `delete:${deleteTarget.id}`}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingAction === `delete:${deleteTarget.id}` ? "Deleting..." : "Delete location"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
