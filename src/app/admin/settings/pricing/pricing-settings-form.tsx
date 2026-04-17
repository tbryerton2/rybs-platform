"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { adminToast } from "@/app/admin/_components/admin/admin-toast";
import { FadingFormMessage } from "@/app/admin/_components/admin/fading-form-message";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import {
  updatePricingSettingsAction,
  type PricingSettingsFieldErrors,
  type PricingSettingsFormState,
  type PricingSettingsFormValues,
} from "./actions";

type PricingSettingsFormProps = {
  pricing: {
    id: string;
    basePrice: number;
    standardRentalDays: number;
    dailyOveragePrice: number;
    maxRentalDays: number | null;
    allowExtendedRentalAtBooking: boolean;
    includedTons: number;
    tonOveragePrice: number;
  };
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function toFormValues(pricing: PricingSettingsFormProps["pricing"]): PricingSettingsFormValues {
  return {
    basePrice: String(pricing.basePrice),
    standardRentalDays: String(pricing.standardRentalDays),
    dailyOveragePrice: String(pricing.dailyOveragePrice),
    maxRentalDays: pricing.maxRentalDays == null ? "" : String(pricing.maxRentalDays),
    allowExtendedRentalAtBooking: pricing.allowExtendedRentalAtBooking,
    includedTons: String(pricing.includedTons),
    tonOveragePrice: String(pricing.tonOveragePrice),
  };
}

function parseCurrency(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function validate(values: PricingSettingsFormValues): PricingSettingsFieldErrors {
  const fieldErrors: PricingSettingsFieldErrors = {};
  const standardRentalDays = parseInteger(values.standardRentalDays);
  const basePrice = parseCurrency(values.basePrice);
  const dailyOveragePrice = parseCurrency(values.dailyOveragePrice);
  const maxRentalDays = values.maxRentalDays.trim() ? parseInteger(values.maxRentalDays) : null;
  const includedTons = parseCurrency(values.includedTons);
  const tonOveragePrice = parseCurrency(values.tonOveragePrice);

  if (standardRentalDays === null || standardRentalDays < 1) {
    fieldErrors.standardRentalDays = "Enter at least 1 day.";
  }

  if (basePrice === null || basePrice < 0) {
    fieldErrors.basePrice = "Enter a valid amount of $0 or more.";
  }

  if (dailyOveragePrice === null || dailyOveragePrice < 0) {
    fieldErrors.dailyOveragePrice = "Enter a valid amount of $0 or more.";
  }

  if (values.maxRentalDays.trim()) {
    if (maxRentalDays === null) {
      fieldErrors.maxRentalDays = "Use a whole number of days.";
    } else if (standardRentalDays !== null && maxRentalDays < standardRentalDays) {
      fieldErrors.maxRentalDays = "Must be at least the standard rental period.";
    }
  }

  if (includedTons === null || includedTons < 0) {
    fieldErrors.includedTons = "Enter 0 or more tons.";
  }

  if (tonOveragePrice === null || tonOveragePrice < 0) {
    fieldErrors.tonOveragePrice = "Enter a valid amount of $0 or more.";
  }

  return fieldErrors;
}

function previewDurations(standardRentalDays: number, maxRentalDays: number | null) {
  const candidates = [standardRentalDays, standardRentalDays + 2, standardRentalDays + 5];

  if (maxRentalDays !== null && maxRentalDays > standardRentalDays) {
    candidates.push(maxRentalDays);
  }

  return [...new Set(candidates)]
    .filter((days) => days >= standardRentalDays && (maxRentalDays == null || days <= maxRentalDays))
    .sort((left, right) => left - right);
}

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function Field({
  label,
  helper,
  name,
  value,
  onChange,
  error,
  prefix,
  suffix,
  type = "text",
  inputMode,
  min,
  step,
  placeholder,
}: {
  label: string;
  helper: string;
  name: Exclude<keyof PricingSettingsFormValues, "allowExtendedRentalAtBooking">;
  value: string;
  onChange: (
    name: Exclude<keyof PricingSettingsFormValues, "allowExtendedRentalAtBooking">,
    value: string,
  ) => void;
  error?: string;
  prefix?: string;
  suffix?: string;
  type?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  min?: string;
  step?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-900">{label}</div>
      <p className="mt-1 text-sm text-slate-600">{helper}</p>

      <div className="relative mt-3">
        {prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm text-slate-500">
            {prefix}
          </span>
        ) : null}

        <input
          name={name}
          type={type}
          inputMode={inputMode}
          min={min}
          step={step}
          value={value}
          onChange={(event) => onChange(name, event.target.value)}
          placeholder={placeholder}
          className={[
            "h-12 w-full rounded-2xl border bg-white text-sm text-slate-900 outline-none transition",
            "focus:border-[#F97316] focus:ring-4 focus:ring-orange-100",
            prefix ? "pl-8 pr-4" : "px-4",
            suffix ? "pr-28" : "",
            error ? "border-red-300" : "border-slate-300",
          ].join(" ")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
        />

        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-sm text-slate-500">
            {suffix}
          </span>
        ) : null}
      </div>

      {error ? (
        <p id={`${name}-error`} className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </label>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Subsection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

function InlineActionMessage({
  success,
  message,
}: {
  success: boolean;
  message: string;
}) {
  if (!message) return null;

  return (
    <div
      className={[
        "rounded-2xl border px-4 py-3 text-sm",
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-800",
      ].join(" ")}
      role={success ? "status" : "alert"}
    >
      {message}
    </div>
  );
}

export function PricingSettingsForm({ pricing }: PricingSettingsFormProps) {
  const initialValues = useMemo(() => toFormValues(pricing), [pricing]);
  const initialState: PricingSettingsFormState = useMemo(
    () => ({
      success: false,
      message: "",
      fieldErrors: {},
      values: initialValues,
      messageKey: 0,
    }),
    [initialValues],
  );
  const [state, formAction] = useActionState(updatePricingSettingsAction, initialState);
  const [values, setValues] = useState<PricingSettingsFormValues>(initialValues);
  const [touched, setTouched] = useState<Partial<Record<keyof PricingSettingsFormValues, boolean>>>(
    {},
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  useEffect(() => {
    if (state.values) {
      setValues(state.values);
    }
  }, [state.values]);

  useEffect(() => {
    setIsSubmitting(false);
  }, [state.messageKey]);

  useEffect(() => {
    if (state.success && state.message) {
      adminToast.success(state.message);
    }
  }, [state.success, state.message, state.messageKey]);

  const clientErrors = useMemo(() => validate(values), [values]);
  const mergedErrors = useMemo(() => {
    const next: PricingSettingsFieldErrors = { ...state.fieldErrors };

    (
      Object.keys(clientErrors) as Array<keyof Omit<PricingSettingsFormValues, "allowExtendedRentalAtBooking">>
    ).forEach((fieldName) => {
      const key = fieldName as keyof PricingSettingsFieldErrors;
      if (touched[fieldName]) {
        next[key] = clientErrors[key];
      }
    });

    return next;
  }, [clientErrors, state.fieldErrors, touched]);

  const parsedStandardRentalDays = parseInteger(values.standardRentalDays) ?? pricing.standardRentalDays;
  const parsedBasePrice = parseCurrency(values.basePrice) ?? pricing.basePrice;
  const parsedDailyOveragePrice =
    parseCurrency(values.dailyOveragePrice) ?? pricing.dailyOveragePrice;
  const parsedMaxRentalDays = values.maxRentalDays.trim()
    ? parseInteger(values.maxRentalDays)
    : null;
  const previewLines = previewDurations(
    Math.max(1, parsedStandardRentalDays),
    parsedMaxRentalDays !== null && parsedMaxRentalDays >= 1 ? parsedMaxRentalDays : null,
  );

  function updateTextValue(
    name: Exclude<keyof PricingSettingsFormValues, "allowExtendedRentalAtBooking">,
    nextValue: string,
  ) {
    setTouched((current) => ({ ...current, [name]: true }));
    setValues((current) => ({
      ...current,
      [name]: nextValue,
    }));
  }

  function updateBooleanValue(name: "allowExtendedRentalAtBooking", nextValue: boolean) {
    setTouched((current) => ({ ...current, [name]: true }));
    setValues((current) => ({
      ...current,
      [name]: nextValue,
    }));
  }

  return (
    <form
      action={formAction}
      className="space-y-6"
      onSubmit={() => {
        setIsSubmitting(true);
      }}
    >
      <input type="hidden" name="id" value={pricing.id} />

      <Section
        title="Pricing settings"
        description="Set the default rental period, overage pricing, and weight policy customers will see during booking."
      >
        <div className="space-y-8">
          <FadingFormMessage
            key={`pricing-form-success-${state.messageKey}`}
            type="success"
            message={state.success ? state.message : ""}
          />

          <Subsection
            title="Rental pricing"
            description="Set the included rental period, base price, and what happens if a customer needs more time."
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <Field
                label="Standard rental period"
                helper="How many days are included in the base rental price."
                name="standardRentalDays"
                value={values.standardRentalDays}
                onChange={updateTextValue}
                error={mergedErrors.standardRentalDays}
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                suffix="days"
              />
              <Field
                label="Base price"
                helper="Flat price for the standard rental period."
                name="basePrice"
                value={values.basePrice}
                onChange={updateTextValue}
                error={mergedErrors.basePrice}
                prefix="$"
                inputMode="decimal"
              />
              <Field
                label="Daily overage rate"
                helper="Extra charge per day after the included rental period."
                name="dailyOveragePrice"
                value={values.dailyOveragePrice}
                onChange={updateTextValue}
                error={mergedErrors.dailyOveragePrice}
                prefix="$"
                inputMode="decimal"
                suffix="per day"
              />
              <Field
                label="Maximum rental length"
                helper="Optional limit on how long a customer can keep the dumpster. Leave blank for no hard cap."
                name="maxRentalDays"
                value={values.maxRentalDays}
                onChange={updateTextValue}
                error={mergedErrors.maxRentalDays}
                type="number"
                inputMode="numeric"
                min={values.standardRentalDays || "1"}
                step="1"
                suffix="days"
                placeholder="No hard cap"
              />
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <input
                type="checkbox"
                name="allowExtendedRentalAtBooking"
                checked={values.allowExtendedRentalAtBooking}
                onChange={(event) =>
                  updateBooleanValue("allowExtendedRentalAtBooking", event.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-orange-200"
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">
                  Allow customers to request extra days during booking
                </span>
                <span className="mt-1 block text-sm text-slate-600">
                  Let customers choose a longer rental during online booking.
                </span>
              </span>
            </label>
          </Subsection>

          <div className="h-px bg-slate-200" />

          <Subsection
            title="Weight overages"
            description="These settings stay separate from the rental-period pricing and continue to apply to overweight loads."
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <Field
                label="Included tons"
                helper="How much weight is included before overage charges apply."
                name="includedTons"
                value={values.includedTons}
                onChange={updateTextValue}
                error={mergedErrors.includedTons}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                suffix="tons"
              />
              <Field
                label="Price per ton over"
                helper="Extra charge for each additional ton above the included weight."
                name="tonOveragePrice"
                value={values.tonOveragePrice}
                onChange={updateTextValue}
                error={mergedErrors.tonOveragePrice}
                prefix="$"
                inputMode="decimal"
                suffix="per ton"
              />
            </div>
          </Subsection>

          <div className="h-px bg-slate-200" />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <div className="text-sm text-slate-600">
                Save these settings to update the default rental pricing used across booking.
              </div>
              <InlineActionMessage
                success={false}
                message={!state.success && !isSubmitting ? state.error ?? "" : ""}
              />
            </div>
            <FormSubmitButton>Save pricing settings</FormSubmitButton>
          </div>
        </div>
      </Section>

      <Section
        title="Live pricing preview"
        description="This preview updates as you edit the settings so you can see what customers will be quoted."
      >
        <div className="rounded-3xl border border-orange-200 bg-orange-50/60 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">
            Example quotes
          </div>

          <div className="mt-4 space-y-3">
            {previewLines.map((days) => {
              const overageDays = Math.max(0, days - parsedStandardRentalDays);
              const total = parsedBasePrice + overageDays * parsedDailyOveragePrice;

              return (
                <div
                  key={days}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700"
                >
                  <span>
                    {days}-day rental
                    {overageDays > 0 ? ` (${overageDays} extra)` : ""}
                  </span>
                  <span className="text-base font-semibold text-slate-950">
                    {formatMoney(total)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 space-y-2 text-sm text-slate-700">
            {parsedMaxRentalDays !== null && parsedMaxRentalDays >= parsedStandardRentalDays ? (
              <p>Customers can keep the dumpster for up to {parsedMaxRentalDays} days.</p>
            ) : (
              <p>No maximum rental length is set.</p>
            )}

            {values.allowExtendedRentalAtBooking ? (
              <p>Customers can request extra days during online booking.</p>
            ) : (
              <p>Customers can only book the standard rental period online.</p>
            )}
          </div>
        </div>
      </Section>
    </form>
  );
}
