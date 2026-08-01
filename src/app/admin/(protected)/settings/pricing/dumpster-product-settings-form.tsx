"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
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
    includedWeightTons:
      setting.includedWeightTons == null ? "" : String(setting.includedWeightTons),
    includedRentalDays:
      setting.includedRentalDays == null ? "" : String(setting.includedRentalDays),
    extraDayPrice: setting.extraDayPrice == null ? "" : String(setting.extraDayPrice),
    basePrice: setting.basePrice == null ? "" : String(setting.basePrice),
    isPublic: setting.isPublic,
    sortOrder: String(setting.sortOrder),
  };
}

function Field({
  label,
  tooltip,
  name,
  value,
  onChange,
  error,
  type = "text",
  prefix,
  suffix,
}: {
  label: string;
  tooltip?: string;
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
      <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-900">
        <span>{label}</span>
        {tooltip ? (
          <button
            type="button"
            aria-label={`${label} details`}
            className="group relative rounded-full p-0.5 text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2"
          >
            <InformationCircleIcon className="h-4 w-4" aria-hidden="true" />
            <span
              role="tooltip"
              className="pointer-events-none absolute left-0 top-7 z-50 w-64 translate-y-1 rounded-[14px] border border-slate-200/90 bg-white px-3.5 py-2.5 text-left text-xs font-medium leading-5 text-slate-600 opacity-0 shadow-[0_16px_36px_rgba(15,23,42,0.14)] transition duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
            >
              {tooltip}
            </span>
          </button>
        ) : null}
      </div>
      <div className="relative">
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
}: {
  label: string;
  name: "shortDescription" | "customerBulletPoints" | "dimensions";
  value: string;
  onChange: (name: "shortDescription" | "customerBulletPoints" | "dimensions", value: string) => void;
  error?: string;
  helpText?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium text-slate-900">{label}</div>
      <textarea
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        rows={name === "customerBulletPoints" ? 4 : name === "shortDescription" ? 3 : 2}
        className={[
          "w-full rounded-[14px] border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition",
          "focus:border-[#F97316] focus:ring-4 focus:ring-orange-100",
          error ? "border-red-300" : "border-slate-300",
        ].join(" ")}
      />
      {helpText ? <div className="mt-1 text-xs text-slate-500">{helpText}</div> : null}
      {error ? <div className="mt-1 text-sm text-red-700">{error}</div> : null}
    </label>
  );
}

function DumpsterProductSettingCard({ setting }: { setting: DumpsterProductSetting }) {
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
  const [state, formAction] = useActionState(updateDumpsterProductSettingAction, initialState);
  const [values, setValues] = useState(initialValues);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  useEffect(() => {
    setValues(state.values);
  }, [state.values]);

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
    <form action={formAction} className="rounded-[14px] border border-slate-200 bg-white p-6 shadow-sm">
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

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Field
          label="Display name"
          name="displayName"
          value={values.displayName}
          onChange={updateTextValue}
          error={errors.displayName}
        />
        <Field
          label="Display order"
          tooltip="Controls the order this dumpster appears to customers. Lower numbers show first."
          name="sortOrder"
          value={values.sortOrder}
          onChange={updateTextValue}
          error={errors.sortOrder}
          type="number"
        />
        <TextareaField
          label="Short description"
          name="shortDescription"
          value={values.shortDescription}
          onChange={updateTextValue}
          error={errors.shortDescription}
        />
        <TextareaField
          label="Customer-facing bullet points"
          name="customerBulletPoints"
          value={values.customerBulletPoints}
          onChange={updateTextValue}
          error={errors.customerBulletPoints}
          helpText="Enter one bullet point per line."
        />
        <TextareaField
          label="Dimensions"
          name="dimensions"
          value={values.dimensions}
          onChange={updateTextValue}
          error={errors.dimensions}
        />
        <Field
          label="Base price"
          name="basePrice"
          value={values.basePrice}
          onChange={updateTextValue}
          error={errors.basePrice}
          prefix="$"
        />
        <Field
          label="Extra day price"
          name="extraDayPrice"
          value={values.extraDayPrice}
          onChange={updateTextValue}
          error={errors.extraDayPrice}
          prefix="$"
        />
        <Field
          label="Included weight"
          name="includedWeightTons"
          value={values.includedWeightTons}
          onChange={updateTextValue}
          error={errors.includedWeightTons}
          suffix="tons"
        />
        <Field
          label="Included rental days"
          name="includedRentalDays"
          value={values.includedRentalDays}
          onChange={updateTextValue}
          error={errors.includedRentalDays}
          suffix="days"
          type="number"
        />
      </div>

      {!state.success && state.error ? (
        <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 text-sm leading-6 text-slate-500">
          To override the base price for any zip code{" "}
          <Link
            href="/admin/settings/zips"
            className="font-medium text-[#F97316] transition hover:text-orange-600"
          >
            click here
          </Link>{" "}
          and select the zip code(s) you wish to override.
        </div>

        <div className="shrink-0">
          <FormSubmitButton>Save product settings</FormSubmitButton>
        </div>
      </div>
    </form>
  );
}

function getDumpsterProductSettingKey(setting: DumpsterProductSetting) {
  if (setting.id.trim()) return setting.id;

  const productId = setting.dumpsterProductId.trim();
  const size = setting.dumpsterSize.trim();

  if (productId && size) return `draft:${productId}:${size}`;
  if (productId) return `draft:${productId}`;
  if (size) return `draft-size:${size}`;

  return `draft-display:${setting.sortOrder}:${setting.displayName.length}`;
}

function parseDumpsterSize(value: string) {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function DumpsterProductSettingsForm({
  settings,
}: {
  settings: DumpsterProductSetting[];
}) {
  const sortedSettings = [...settings].sort((left, right) => {
    const leftSize = parseDumpsterSize(left.dumpsterSize) ?? parseDumpsterSize(left.displayName);
    const rightSize = parseDumpsterSize(right.dumpsterSize) ?? parseDumpsterSize(right.displayName);

    if (leftSize !== null && rightSize !== null && leftSize !== rightSize) {
      return leftSize - rightSize;
    }

    if (leftSize !== null && rightSize === null) return -1;
    if (leftSize === null && rightSize !== null) return 1;

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.displayName.localeCompare(right.displayName);
  });

  return (
    <div className="space-y-4">
      {sortedSettings.map((setting) => (
        <DumpsterProductSettingCard key={getDumpsterProductSettingKey(setting)} setting={setting} />
      ))}
    </div>
  );
}
