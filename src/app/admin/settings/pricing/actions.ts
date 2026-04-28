"use server";

import { revalidatePath } from "next/cache";
import { isMissingPricingSettingsRentalPeriodColumnsError } from "@/lib/pricing-settings";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PricingSettingsFormValues = {
  basePrice: string;
  standardRentalDays: string;
  dailyOveragePrice: string;
  maxRentalDays: string;
  allowExtendedRentalAtBooking: boolean;
  includedTons: string;
  tonOveragePrice: string;
};

export type PricingSettingsFieldErrors = Partial<
  Record<
    | "basePrice"
    | "standardRentalDays"
    | "dailyOveragePrice"
    | "maxRentalDays"
    | "allowExtendedRentalAtBooking"
    | "includedTons"
    | "tonOveragePrice",
    string
  >
>;

export type PricingSettingsFormState = {
  success: boolean;
  message: string;
  error?: string;
  fieldErrors: PricingSettingsFieldErrors;
  values: PricingSettingsFormValues;
  messageKey: number;
};

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function asBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function normalizeCurrency(value: string) {
  return value.trim();
}

function buildValues(formData: FormData): PricingSettingsFormValues {
  return {
    basePrice: normalizeCurrency(asString(formData.get("basePrice"))),
    standardRentalDays: asString(formData.get("standardRentalDays")).trim(),
    dailyOveragePrice: normalizeCurrency(asString(formData.get("dailyOveragePrice"))),
    maxRentalDays: asString(formData.get("maxRentalDays")).trim(),
    allowExtendedRentalAtBooking: asBoolean(formData.get("allowExtendedRentalAtBooking")),
    includedTons: asString(formData.get("includedTons")).trim(),
    tonOveragePrice: normalizeCurrency(asString(formData.get("tonOveragePrice"))),
  };
}

function invalidState(
  values: PricingSettingsFormValues,
  fieldErrors: PricingSettingsFieldErrors,
  error = "Please fix the highlighted pricing fields."
): PricingSettingsFormState {
  return {
    success: false,
    message: "",
    error,
    fieldErrors,
    values,
    messageKey: Date.now(),
  };
}

function parseCurrency(
  rawValue: string,
  fieldName: keyof PricingSettingsFieldErrors,
  fieldLabel: string,
  fieldErrors: PricingSettingsFieldErrors,
) {
  if (!rawValue) {
    fieldErrors[fieldName] = `${fieldLabel} is required.`;
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    fieldErrors[fieldName] = `${fieldLabel} must be 0 or more.`;
    return null;
  }

  return Number(parsed.toFixed(2));
}

function parseRequiredInteger(
  rawValue: string,
  fieldName: keyof PricingSettingsFieldErrors,
  fieldLabel: string,
  fieldErrors: PricingSettingsFieldErrors,
) {
  if (!rawValue) {
    fieldErrors[fieldName] = `${fieldLabel} is required.`;
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 1) {
    fieldErrors[fieldName] = `${fieldLabel} must be a whole number of at least 1.`;
    return null;
  }

  return parsed;
}

function parseOptionalInteger(
  rawValue: string,
  fieldName: keyof PricingSettingsFieldErrors,
  fieldLabel: string,
  fieldErrors: PricingSettingsFieldErrors,
) {
  if (!rawValue) return null;

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed)) {
    fieldErrors[fieldName] = `${fieldLabel} must be a whole number.`;
    return null;
  }

  return parsed;
}

function parseDecimal(
  rawValue: string,
  fieldName: keyof PricingSettingsFieldErrors,
  fieldLabel: string,
  fieldErrors: PricingSettingsFieldErrors,
) {
  if (!rawValue) {
    fieldErrors[fieldName] = `${fieldLabel} is required.`;
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    fieldErrors[fieldName] = `${fieldLabel} must be 0 or more.`;
    return null;
  }

  return Number(parsed.toFixed(2));
}

export async function updatePricingSettingsAction(
  prevState: PricingSettingsFormState,
  formData: FormData
): Promise<PricingSettingsFormState> {
  const id = asString(formData.get("id")).trim();
  const values = buildValues(formData);

  if (!id) {
    return {
      ...prevState,
      success: false,
      error: "Missing pricing settings record.",
      message: "",
      messageKey: Date.now(),
    };
  }

  const fieldErrors: PricingSettingsFieldErrors = {};

  const basePrice = parseCurrency(values.basePrice, "basePrice", "Base price", fieldErrors);
  const standardRentalDays = parseRequiredInteger(
    values.standardRentalDays,
    "standardRentalDays",
    "Standard rental period",
    fieldErrors,
  );
  const dailyOveragePrice = parseCurrency(
    values.dailyOveragePrice,
    "dailyOveragePrice",
    "Extra day rate",
    fieldErrors,
  );
  const maxRentalDays = parseOptionalInteger(
    values.maxRentalDays,
    "maxRentalDays",
    "Max rental length",
    fieldErrors,
  );
  const includedTons = parseDecimal(values.includedTons, "includedTons", "Included tons", fieldErrors);
  const tonOveragePrice = parseCurrency(
    values.tonOveragePrice,
    "tonOveragePrice",
    "Price per ton over",
    fieldErrors,
  );

  if (
    maxRentalDays !== null &&
    standardRentalDays !== null &&
    maxRentalDays < standardRentalDays
  ) {
    fieldErrors.maxRentalDays =
      "Max rental length must be at least as long as the standard rental period.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return invalidState(values, fieldErrors);
  }

  const { error } = await supabaseAdmin
    .from("pricing_settings")
    .update({
      standard_rental_price: basePrice,
      scheduled_pickup_price: basePrice,
      included_rental_days: standardRentalDays,
      daily_overage_price: dailyOveragePrice,
      max_rental_days: maxRentalDays,
      allow_extended_rental_at_booking: values.allowExtendedRentalAtBooking,
      included_tons: includedTons,
      ton_overage_price: tonOveragePrice,
    })
    .eq("id", id);

  if (error && isMissingPricingSettingsRentalPeriodColumnsError(error)) {
    return {
      success: false,
      message: "",
      error:
        "Your database needs the latest pricing settings update before these changes can be saved. Apply migration 202604150101_pricing_settings_rental_period_model and try again.",
      fieldErrors: {},
      values,
      messageKey: Date.now(),
    };
  }

  if (error) {
    return {
      success: false,
      message: "",
      error: error.message,
      fieldErrors: {},
      values,
      messageKey: Date.now(),
    };
  }

  revalidatePath("/admin/settings/pricing");

  return {
    success: true,
    message: "Pricing settings updated.",
    fieldErrors: {},
    values,
    messageKey: Date.now(),
  };
}
