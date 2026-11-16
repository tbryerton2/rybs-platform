"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/outline";
import { reorderDumpsterProductsAction } from "./actions";
import { adminToast } from "@/app/admin/_components/admin/admin-toast";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import type { DumpsterProductSetting } from "@/lib/dumpster-product-settings";
import {
  updateDumpsterProductSettingAction,
  type DumpsterProductSettingsFieldErrors,
  type DumpsterProductSettingsFormState,
  type DumpsterProductSettingsFormValues,
} from "./actions";

function toFormValues(setting: DumpsterProductSetting): DumpsterProductSettingsFormValues {
  return {
    dumpsterSize: setting.dumpsterSize,
    dumpsterProductId: setting.dumpsterProductId,
    displayName: setting.displayName,
    shortDescription: setting.shortDescription,
    customerBulletPoints: setting.customerBulletPoints,
    dimensions: setting.dimensions,
    truckLoadEstimate: setting.truckLoadEstimate,
    sizeGuideExamples: setting.sizeGuideExamples,
    includedWeightTons:
      setting.includedWeightTons == null ? "" : String(setting.includedWeightTons),
    includedRentalDays:
      setting.includedRentalDays == null ? "" : String(setting.includedRentalDays),
    extraDayPrice: setting.extraDayPrice == null ? "" : String(setting.extraDayPrice),
    basePrice: setting.basePrice == null ? "" : String(setting.basePrice),
    isPublic: setting.isPublic,
  };
}

function Field({
  label,
  caption,
  name,
  value,
  onChange,
  error,
  type = "text",
  prefix,
  suffix,
}: {
  label: string;
  caption?: string;
  name: Exclude<keyof DumpsterProductSettingsFormValues, "isPublic">;
  value: string;
  onChange: (name: Exclude<keyof DumpsterProductSettingsFormValues, "isPublic">, value: string) => void;
  error?: string;
  type?: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <span>{label}</span>
      </div>
      {caption ? <div className="mt-1 text-xs leading-5 text-slate-500">{caption}</div> : null}
      <div className={caption ? "relative mt-2" : "relative mt-1.5"}>
        {prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm text-slate-500">
            {prefix}
          </span>
        ) : null}
        <input
          type={type}
          name={name}
          value={value}
          onChange={(event) => onChange(name, event.target.value)}
          className={[
            "h-12 w-full rounded-[14px] border bg-white text-sm text-slate-900 outline-none transition",
            "focus:border-[#F97316] focus:ring-4 focus:ring-orange-100",
            prefix ? "pl-8 pr-4" : "px-4",
            suffix ? "pr-20" : "",
            error ? "border-red-300" : "border-slate-300",
          ].join(" ")}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-sm text-slate-500">
            {suffix}
          </span>
        ) : null}
      </div>
      {error ? <div className="mt-1 text-sm text-red-700">{error}</div> : null}
    </label>
  );
}

function TextareaField({
  label,
  name,
  value,
  onChange,
  error,
  helpText,
  placeholder,
}: {
  label: string;
  name: "shortDescription" | "customerBulletPoints" | "dimensions" | "sizeGuideExamples";
  value: string;
  onChange: (name: "shortDescription" | "customerBulletPoints" | "dimensions" | "sizeGuideExamples", value: string) => void;
  error?: string;
  helpText?: string;
  placeholder?: string;
}) {
  const fixedTallTextarea = name === "shortDescription" || name === "customerBulletPoints";

  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-900">{label}</div>
      {helpText ? <div className="mt-1 text-xs leading-5 text-slate-500">{helpText}</div> : null}
      <textarea
        placeholder={placeholder}
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        rows={fixedTallTextarea ? 4 : 2}
        className={[
          `${helpText ? "mt-2" : "mt-1.5"} w-full rounded-[14px] border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition`,
          fixedTallTextarea ? "h-32 resize-none" : "",
          "focus:border-[#F97316] focus:ring-4 focus:ring-orange-100",
          error ? "border-red-300" : "border-slate-300",
        ].join(" ")}
      />
      {error ? <div className="mt-1 text-sm text-red-700">{error}</div> : null}
    </label>
  );
}

function DumpsterProductSettingCard({ setting, index, count, saving, indicator, onMove }: {
  setting: DumpsterProductSetting; index: number; count: number; saving: boolean;
  indicator: "before" | "after" | null; onMove: (from: number, to: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: setting.id, disabled: saving });
  const initialValues = useMemo(() => toFormValues(setting), [setting]);
  const initialState: DumpsterProductSettingsFormState = useMemo(
    () => ({
      success: false,
      message: "",
      fieldErrors: {},
      values: initialValues,
      messageKey: 0,
    }),
    [initialValues],
  );
  const [values, setValues] = useState(initialValues);
  const [state, formAction] = useActionState(async (previous: DumpsterProductSettingsFormState, formData: FormData) => {
    const next = await updateDumpsterProductSettingAction(previous, formData);
    setValues(next.values);
    return next;
  }, initialState);

  useEffect(() => {
    if (state.success && state.message) {
      adminToast.success(state.message);
    }
  }, [state.message, state.messageKey, state.success]);

  function updateTextValue(
    name: Exclude<keyof DumpsterProductSettingsFormValues, "isPublic">,
    value: string,
  ) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function updateBooleanValue(value: boolean) {
    setValues((current) => ({ ...current, isPublic: value }));
  }

  const errors: DumpsterProductSettingsFieldErrors = state.fieldErrors;

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative rounded-lg border border-slate-200 bg-white ${isDragging ? "z-10 shadow-lg" : "shadow-sm"}`}>
      {indicator ? <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 h-0.5 bg-[#F97316] ${indicator === "before" ? "-top-2" : "-bottom-2"}`} /> : null}
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners}
          aria-label={`Reorder ${values.displayName}`} aria-disabled={saving}
          className="admin-btn admin-btn-secondary cursor-grab touch-none active:cursor-grabbing">
          <svg width="16" height="20" viewBox="0 0 16 20" fill="currentColor" aria-hidden="true">
            {[4, 10, 16].map((y) => <g key={y}><circle cx="5" cy={y} r="1.5" /><circle cx="11" cy={y} r="1.5" /></g>)}
          </svg>
        </button>
        <button type="button" className="admin-btn admin-btn-secondary" disabled={saving || index === 0}
          aria-label={`Move ${values.displayName} up`} onClick={() => onMove(index, index - 1)}><ArrowUpIcon className="h-4 w-4" /></button>
        <button type="button" className="admin-btn admin-btn-secondary" disabled={saving || index === count - 1}
          aria-label={`Move ${values.displayName} down`} onClick={() => onMove(index, index + 1)}><ArrowDownIcon className="h-4 w-4" /></button>
        <span className="min-w-0 flex-1 text-sm font-semibold text-slate-950">{values.displayName}</span>
        <span className="text-sm font-medium text-slate-700">{values.basePrice.trim() && Number.isFinite(Number(values.basePrice))
          ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(values.basePrice)) : "—"}</span>
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          {values.isPublic ? "Public" : "Hidden from booking site"}
        </span>
        <button type="button" className="admin-btn admin-btn-secondary" aria-expanded={expanded}
          aria-controls={`product-edit-${setting.id}`} onClick={() => setExpanded((open) => !open)}>{expanded ? "Close" : "Edit"}</button>
      </div>
      <div id={`product-edit-${setting.id}`} hidden={!expanded}>
    <form action={formAction} className="border-t border-slate-200 p-6">
      <input type="hidden" name="id" value={setting.id} />
      <input type="hidden" name="dumpsterSize" value={setting.dumpsterSize} />
      <input type="hidden" name="dumpsterProductId" value={setting.dumpsterProductId} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold text-slate-950">{setting.displayName}</div>
            {setting.isDraft ? (
              <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                Draft defaults
              </span>
            ) : null}
            {!setting.isActiveSize ? (
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                No active inventory
              </span>
            ) : null}
          </div>
        </div>
        <label className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            name="isPublic"
            checked={values.isPublic}
            onChange={(event) => updateBooleanValue(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-orange-200"
          />
          Public
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-semibold text-slate-900">Customer-facing content</legend>
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
        <Field
          label="Display name"
          caption="Shown as the product name on the booking site."
          name="displayName"
          value={values.displayName}
          onChange={updateTextValue}
          error={errors.displayName}
        />
        <TextareaField
          label="Short description"
          placeholder="Describe this dumpster for customers."
          name="shortDescription"
          value={values.shortDescription}
          onChange={updateTextValue}
          error={errors.shortDescription}
          helpText="Optional. Shown as a line of text below the pricing details on the booking site."
        />
        <TextareaField
          label="Customer-facing bullet points"
          name="customerBulletPoints"
          value={values.customerBulletPoints}
          onChange={updateTextValue}
          error={errors.customerBulletPoints}
          helpText="Optional. Shown as a bullet list below the short description on the booking site. Enter one bullet point per line."
        />
        <TextareaField
          label="Dimensions"
          name="dimensions"
          value={values.dimensions}
          onChange={updateTextValue}
          error={errors.dimensions}
          helpText="Shown under the product name to help customers judge size."
        />
        <Field
          label="Truck-load estimate"
          caption="Shown in the 'Which size is right for me?' guide on the booking site."
          name="truckLoadEstimate"
          value={values.truckLoadEstimate}
          onChange={updateTextValue}
          error={errors.truckLoadEstimate}
        />
        <TextareaField
          label="Good for (examples)"
          helpText="Shown in the size guide. Example: small garbage dumpster."
          name="sizeGuideExamples"
          value={values.sizeGuideExamples}
          onChange={updateTextValue}
          error={errors.sizeGuideExamples}
        />
        </div>
      </fieldset>
      <fieldset className="mt-6 border-t border-slate-200 pt-5">
        <legend className="text-sm font-semibold text-slate-900">Pricing &amp; allowances</legend>
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
        <Field
          label="Base price"
          caption="Shown as the price to customers on the booking site."
          name="basePrice"
          value={values.basePrice}
          onChange={updateTextValue}
          error={errors.basePrice}
          prefix="$"
        />
        <Field
          label="Extra day price"
          caption="Shown in the included rental duration details as the per-day charge after the included days."
          name="extraDayPrice"
          value={values.extraDayPrice}
          onChange={updateTextValue}
          error={errors.extraDayPrice}
          prefix="$"
        />
        <Field
          label="Included weight"
          caption="Shown in the included weight allowance details on the booking site."
          name="includedWeightTons"
          value={values.includedWeightTons}
          onChange={updateTextValue}
          error={errors.includedWeightTons}
          suffix="tons"
        />
        <Field
          label="Included rental days"
          caption="Shown as the included rental duration on the booking site."
          name="includedRentalDays"
          value={values.includedRentalDays}
          onChange={updateTextValue}
          error={errors.includedRentalDays}
          suffix="days"
          type="number"
        />
        </div>
      </fieldset>

      {!state.success && state.error ? (
        <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </div>
      ) : null}

      <p className="mt-5 text-sm text-slate-500">Changes go live on the booking site when saved.</p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 text-sm leading-6 text-slate-500">
          Need different pricing in some areas?{" "}
          <Link
            href="/admin/settings/zips"
            className="font-medium text-[#F97316] transition hover:text-orange-600"
          >
            Override pricing by ZIP code
          </Link>
          .
        </div>

        <div className="shrink-0">
          <FormSubmitButton>Save product settings</FormSubmitButton>
        </div>
      </div>
    </form>
      </div>
    </div>
  );
}

export function DumpsterProductSettingsForm({ settings }: { settings: DumpsterProductSetting[] }) {
  const [order, setOrder] = useState(() => [...settings].sort((a, b) => a.position - b.position).map((item) => item.id));
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const [announcement, setAnnouncement] = useState("");
  const [drag, setDrag] = useState<{ active: string; over: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const byId = new Map(settings.map((item) => [item.id, item]));
  // Keep local order and mounted form state across other products' saves; append new IDs only.
  const ids = [...order.filter((id) => byId.has(id)), ...settings.filter((item) => !order.includes(item.id)).map((item) => item.id)];
  const label = (id: string | number) => byId.get(String(id))?.displayName ?? "Dumpster";
  async function move(from: number, to: number) {
    if (pending.current || from === to || from < 0 || to < 0 || to >= ids.length) return;
    const previous = ids;
    const next = arrayMove(ids, from, to);
    pending.current = true;
    setSaving(true);
    setOrder(next);
    try {
      const result = await reorderDumpsterProductsAction(next);
      if (!result.success) throw new Error(result.message);
      adminToast.success("Order updated");
      setAnnouncement(`${label(ids[from])} moved to position ${to + 1} of ${ids.length}.`);
    } catch {
      setOrder(previous);
      adminToast.error("Couldn't update order. Previous order restored. Refresh and try again.");
      setAnnouncement("Couldn't update order. Previous order restored.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  return (
    <div>
      <p className="mb-3 text-xs leading-5 text-slate-500">Drag to set the order dumpsters appear on your booking site.</p>
      <div role="status" aria-live="polite" className="sr-only">{announcement}</div>
      <DndContext id="dumpster-products" sensors={sensors} collisionDetection={closestCenter}
        accessibility={{ screenReaderInstructions: { draggable: "Press Space or Enter to lift. Use arrow keys to move. Press Space or Enter to drop, or Escape to cancel." },
          announcements: {
            onDragStart: ({ active }) => `${label(active.id)} lifted. Position ${ids.indexOf(String(active.id)) + 1} of ${ids.length}.`,
            onDragOver: ({ active, over }) => over ? `${label(active.id)} moved to position ${ids.indexOf(String(over.id)) + 1} of ${ids.length}.` : undefined,
            onDragEnd: ({ active }) => `${label(active.id)} dropped.`,
            onDragCancel: ({ active }) => `${label(active.id)} reorder cancelled.`,
          } }}
        onDragStart={({ active }) => setDrag({ active: String(active.id), over: String(active.id) })}
        onDragOver={({ active, over }) => setDrag(over ? { active: String(active.id), over: String(over.id) } : null)}
        onDragCancel={() => setDrag(null)}
        onDragEnd={({ active, over }) => { setDrag(null); if (over) void move(ids.indexOf(String(active.id)), ids.indexOf(String(over.id))); }}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {ids.map((id, index) => <DumpsterProductSettingCard key={id} setting={byId.get(id)!} index={index}
              count={ids.length} saving={saving} onMove={(from, to) => void move(from, to)}
              indicator={drag && drag.active !== id && drag.over === id ? (ids.indexOf(drag.active) < index ? "after" : "before") : null} />)}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
