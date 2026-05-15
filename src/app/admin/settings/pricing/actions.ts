"use server";

import { revalidatePath } from "next/cache";
import { isMissingPricingSettingsRentalPeriodColumnsError } from "@/lib/pricing-settings";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PricingSettingsFormValues = {
  maxRentalDays: string;
  allowExtendedRentalAtBooking: boolean;
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

export type DumpsterProductSettingsFormValues = {
  dumpsterSize: string;
  dumpsterProductId: string;
  displayName: string;
  shortDescription: string;
  customerBulletPoints: string;
  dimensions: string;
  includedWeightTons: string;
  includedRentalDays: string;
  extraDayPrice: string;
  basePrice: string;
  isPublic: boolean;
  sortOrder: string;
};

export type DumpsterProductSettingsFieldErrors = Partial<
  Record<
    | "displayName"
    | "shortDescription"
    | "customerBulletPoints"
    | "dimensions"
    | "includedWeightTons"
    | "includedRentalDays"
    | "extraDayPrice"
    | "basePrice"
    | "isPublic"
    | "sortOrder",
    string
  >
>;

export type DumpsterProductSettingsFormState = {
  success: boolean;
  message: string;
  error?: string;
  fieldErrors: DumpsterProductSettingsFieldErrors;
  values: DumpsterProductSettingsFormValues;
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
    maxRentalDays: asString(formData.get("maxRentalDays")).trim(),
    allowExtendedRentalAtBooking: asBoolean(formData.get("allowExtendedRentalAtBooking")),
    tonOveragePrice: normalizeCurrency(asString(formData.get("tonOveragePrice"))),
  };
}

function buildDumpsterProductValues(formData: FormData): DumpsterProductSettingsFormValues {
  return {
    dumpsterSize: asString(formData.get("dumpsterSize")).trim(),
    dumpsterProductId: asString(formData.get("dumpsterProductId")).trim(),
    displayName: asString(formData.get("displayName")).trim(),
    shortDescription: asString(formData.get("shortDescription")).trim(),
    customerBulletPoints: asString(formData.get("customerBulletPoints")).trim(),
    dimensions: asString(formData.get("dimensions")).trim(),
    includedWeightTons: asString(formData.get("includedWeightTons")).trim(),
    includedRentalDays: asString(formData.get("includedRentalDays")).trim(),
    extraDayPrice: normalizeCurrency(asString(formData.get("extraDayPrice"))),
    basePrice: normalizeCurrency(asString(formData.get("basePrice"))),
    isPublic: asBoolean(formData.get("isPublic")),
    sortOrder: asString(formData.get("sortOrder")).trim(),
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

function invalidDumpsterProductState(
  values: DumpsterProductSettingsFormValues,
  fieldErrors: DumpsterProductSettingsFieldErrors,
  error = "Please fix the highlighted product fields."
): DumpsterProductSettingsFormState {
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

function parseProductCurrency(
  rawValue: string,
  fieldName: keyof DumpsterProductSettingsFieldErrors,
  fieldLabel: string,
  fieldErrors: DumpsterProductSettingsFieldErrors,
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

function parseProductRequiredInteger(
  rawValue: string,
  fieldName: keyof DumpsterProductSettingsFieldErrors,
  fieldLabel: string,
  fieldErrors: DumpsterProductSettingsFieldErrors,
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

function parseProductOptionalInteger(
  rawValue: string,
  fieldName: keyof DumpsterProductSettingsFieldErrors,
  fieldLabel: string,
  fieldErrors: DumpsterProductSettingsFieldErrors,
) {
  if (!rawValue) return null;

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed)) {
    fieldErrors[fieldName] = `${fieldLabel} must be a whole number.`;
    return null;
  }

  return parsed;
}

function parseProductDecimal(
  rawValue: string,
  fieldName: keyof DumpsterProductSettingsFieldErrors,
  fieldLabel: string,
  fieldErrors: DumpsterProductSettingsFieldErrors,
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

  const maxRentalDays = parseOptionalInteger(
    values.maxRentalDays,
    "maxRentalDays",
    "Max rental length",
    fieldErrors,
  );
  const tonOveragePrice = parseCurrency(
    values.tonOveragePrice,
    "tonOveragePrice",
    "Price per ton over",
    fieldErrors,
  );

  if (maxRentalDays !== null && maxRentalDays < 1) {
    fieldErrors.maxRentalDays = "Max rental length must be at least 1 day.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return invalidState(values, fieldErrors);
  }

  const { error } = await supabaseAdmin
    .from("pricing_settings")
    .update({
      max_rental_days: maxRentalDays,
      allow_extended_rental_at_booking: values.allowExtendedRentalAtBooking,
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

export async function updateDumpsterProductSettingAction(
  prevState: DumpsterProductSettingsFormState,
  formData: FormData
): Promise<DumpsterProductSettingsFormState> {
  const id = asString(formData.get("id")).trim();
  const values = buildDumpsterProductValues(formData);

  if (!id && (!values.dumpsterSize || !values.dumpsterProductId)) {
    return {
      ...prevState,
      success: false,
      error: "Missing dumpster product settings record.",
      message: "",
      messageKey: Date.now(),
    };
  }

  const fieldErrors: DumpsterProductSettingsFieldErrors = {};

  if (!values.dumpsterSize) {
    fieldErrors.displayName = "Missing dumpster size for this product.";
  }

  if (!values.dumpsterProductId) {
    fieldErrors.displayName = "Missing dumpster product ID for this product.";
  }

  if (!values.displayName) {
    fieldErrors.displayName = "Display name is required.";
  }

  const includedWeightTons = parseProductDecimal(
    values.includedWeightTons,
    "includedWeightTons",
    "Included weight",
    fieldErrors,
  );
  const includedRentalDays = parseProductRequiredInteger(
    values.includedRentalDays,
    "includedRentalDays",
    "Included rental days",
    fieldErrors,
  );
  const extraDayPrice = parseProductCurrency(
    values.extraDayPrice,
    "extraDayPrice",
    "Extra day price",
    fieldErrors,
  );
  const basePrice = parseProductCurrency(values.basePrice, "basePrice", "Base price", fieldErrors);
  const sortOrder = parseProductOptionalInteger(values.sortOrder, "sortOrder", "Sort order", fieldErrors);

  if (Object.keys(fieldErrors).length > 0) {
    return invalidDumpsterProductState(values, fieldErrors);
  }

  const payload = {
      dumpster_size: values.dumpsterSize,
      dumpster_product_id: values.dumpsterProductId,
      display_name: values.displayName,
      short_description: values.shortDescription || null,
      customer_bullet_points: values.customerBulletPoints || null,
      dimensions: values.dimensions || null,
      included_weight_tons: includedWeightTons,
      included_rental_days: includedRentalDays,
      extra_day_price: extraDayPrice,
      base_price: basePrice,
      is_public: values.isPublic,
      sort_order: sortOrder ?? 0,
    };

  const query = id
    ? supabaseAdmin
        .from("dumpster_product_settings")
        .update(payload)
        .eq("id", id)
    : supabaseAdmin.from("dumpster_product_settings").upsert(payload, {
        onConflict: "dumpster_size",
      });

  const { error } = await query;

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
  revalidatePath("/pricing");

  return {
    success: true,
    message: "Dumpster product settings updated.",
    fieldErrors: {},
    values,
    messageKey: Date.now(),
  };
}
