"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
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
    maxRentalDays: number | null;
    allowExtendedRentalAtBooking: boolean;
    includedServicesBlurb: string | null;
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
    maxRentalDays: pricing.maxRentalDays == null ? "" : String(pricing.maxRentalDays),
    allowExtendedRentalAtBooking: pricing.allowExtendedRentalAtBooking,
    includedServicesBlurb: pricing.includedServicesBlurb ?? "",
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
  const maxRentalDays = values.maxRentalDays.trim() ? parseInteger(values.maxRentalDays) : null;
  const tonOveragePrice = parseCurrency(values.tonOveragePrice);

  if (values.maxRentalDays.trim()) {
    if (maxRentalDays === null) {
      fieldErrors.maxRentalDays = "Use a whole number of days.";
    } else if (maxRentalDays < 1) {
      fieldErrors.maxRentalDays = "Use a whole number of at least 1 day.";
    }
  }

  if (tonOveragePrice === null || tonOveragePrice < 0) {
    fieldErrors.tonOveragePrice = "Enter a valid amount of $0 or more.";
  }

  if (values.includedServicesBlurb.trim().length > 300) {
    fieldErrors.includedServicesBlurb = "What’s included must be 300 characters or fewer.";
  }

  return fieldErrors;
}

function Field({
  label,
  helper,
  labelTone = "slate",
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
  helper?: string;
  labelTone?: "blue" | "green" | "amber" | "violet" | "slate";
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
  const bulletClasses =
    labelTone === "blue"
      ? "bg-sky-100"
      : labelTone === "green"
        ? "bg-emerald-100"
        : labelTone === "amber"
          ? "bg-amber-100"
          : labelTone === "violet"
            ? "bg-violet-100"
            : "bg-slate-200";

  return (
    <label className="block">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <span className={`h-3 w-3 shrink-0 rounded-full ${bulletClasses}`} />
        <span>{label}</span>
      </div>
      {helper ? <p className="mt-1 text-sm text-slate-600">{helper}</p> : null}

      <div
        className={
          helper
            ? "relative mt-3 w-full max-w-full sm:max-w-[16rem]"
            : "relative mt-2 w-full max-w-full sm:max-w-[16rem]"
        }
      >
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

function TextareaField({
  label,
  helper,
  name,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  helper?: string;
  name: "includedServicesBlurb";
  value: string;
  onChange: (name: "includedServicesBlurb", value: string) => void;
  error?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <span className="h-3 w-3 shrink-0 rounded-full bg-orange-400" />
        <span>{label}</span>
      </div>
      {helper ? <p className="mt-1 text-sm text-slate-600">{helper}</p> : null}

      <textarea
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={300}
        className={[
          "mt-3 w-full max-w-2xl resize-y rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition",
          "focus:border-[#F97316] focus:ring-4 focus:ring-orange-100",
          error ? "border-red-300" : "border-slate-300",
        ].join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
      />

      {error ? (
        <p id={`${name}-error`} className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </label>
  );
}

function FormSectionHeading({
  title,
  tooltip,
}: {
  title: string;
  tooltip?: string;
}) {
  return (
    <div className="flex min-h-7 items-center gap-2">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      {tooltip ? (
        <button
          type="button"
          aria-label={`${title} details`}
          className="group relative rounded-full p-0.5 text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2"
        >
          <InformationCircleIcon className="h-4.5 w-4.5" aria-hidden="true" />
          <span
            role="tooltip"
            className="pointer-events-none absolute left-0 top-7 z-50 w-72 translate-y-1 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-left text-xs font-medium leading-5 text-slate-600 opacity-0 shadow-[0_16px_36px_rgba(15,23,42,0.14)] transition duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
          >
            {tooltip}
          </span>
        </button>
      ) : null}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      {title || description ? (
        <div className="mb-6">
          {title ? <h2 className="text-lg font-semibold text-slate-950">{title}</h2> : null}
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
      ) : null}
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

  const parsedMaxRentalDays = values.maxRentalDays.trim()
    ? parseInteger(values.maxRentalDays)
    : null;

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
        title="Global booking behavior"
      >
        <div className="space-y-8">
          <FadingFormMessage
            key={`pricing-form-success-${state.messageKey}`}
            type="success"
            message={state.success ? state.message : ""}
          />

          <div className="space-y-5">
            <div className="grid gap-y-5 xl:grid-cols-[16rem_1px_16rem_20rem] xl:items-start xl:justify-start xl:gap-x-12">
              <div className="space-y-5">
                <FormSectionHeading
                  title="Booking rules"
                  tooltip="These settings apply across the booking flow. Size-specific price, included days, and included weight are managed in the dumpster product settings below."
                />
                <Field
                  label="Max rental length"
                  labelTone="violet"
                  name="maxRentalDays"
                  value={values.maxRentalDays}
                  onChange={updateTextValue}
                  error={mergedErrors.maxRentalDays}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  suffix="days"
                  placeholder="No hard cap"
                />
              </div>

              <div className="hidden w-px self-stretch bg-slate-300 xl:block" />

              <div className="space-y-5 xl:pl-3">
                <FormSectionHeading title="Weight overages" />
                <Field
                  label="Price per ton over"
                  labelTone="slate"
                  name="tonOveragePrice"
                  value={values.tonOveragePrice}
                  onChange={updateTextValue}
                  error={mergedErrors.tonOveragePrice}
                  prefix="$"
                  inputMode="decimal"
                  suffix="per ton"
                />
              </div>

              <div className="rounded-3xl border border-orange-200 bg-orange-50/60 p-5">
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-400" />
                    <span>
                      {parsedMaxRentalDays !== null && parsedMaxRentalDays >= 1
                        ? `Customers can keep the dumpster for up to ${parsedMaxRentalDays} days.`
                        : "No maximum rental length is set."}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-400" />
                    <span>
                      {values.allowExtendedRentalAtBooking
                        ? "Customers can request extra days during online booking."
                        : "Customers can only book the standard rental period online."}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-400" />
                    <span>
                      Weight overages above a product&apos;s included tons are billed at{" "}
                      {moneyFormatter.format(
                        parseCurrency(values.tonOveragePrice) ?? pricing.tonOveragePrice,
                      )}{" "}
                      per ton.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8">
              <TextareaField
                label="What’s included"
                helper="Shown to customers when explaining what is included in the base rental price."
                name="includedServicesBlurb"
                value={values.includedServicesBlurb}
                onChange={updateTextValue}
                error={mergedErrors.includedServicesBlurb}
                placeholder="Includes delivery, pickup, and the standard weight allowance."
              />
            </div>

            <div className="w-full mt-10">
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
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <InlineActionMessage
                success={false}
                message={!state.success && !isSubmitting ? state.error ?? "" : ""}
              />
            </div>
            <FormSubmitButton>Save</FormSubmitButton>
          </div>
        </div>
      </Section>
    </form>
  );
}
