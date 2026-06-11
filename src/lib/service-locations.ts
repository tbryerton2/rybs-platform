import { normalizePhone } from "@/lib/customers";
import { getActiveServiceAreaZip, sanitizeServiceAreaZip } from "@/lib/service-area";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTenant } from "@/lib/tenant/server";

export const SERVICE_LOCATION_LABEL_MAX_LENGTH = 80;
export const SERVICE_LOCATION_STREET_MAX_LENGTH = 160;
export const SERVICE_LOCATION_CITY_MAX_LENGTH = 80;
export const SERVICE_LOCATION_STATE_MAX_LENGTH = 2;
export const SERVICE_LOCATION_ZIP_MAX_LENGTH = 10;
export const SERVICE_LOCATION_NOTES_MAX_LENGTH = 500;
export const SERVICE_LOCATION_ACCESS_MAX_LENGTH = 160;
export const SERVICE_LOCATION_CONTACT_NAME_MAX_LENGTH = 80;

export type SavedServiceLocation = {
  id: string;
  customer_id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  delivery_notes: string | null;
  access_notes: string | null;
  onsite_contact_name: string | null;
  onsite_contact_phone: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type SavedServiceLocationInput = {
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  deliveryNotes: string | null;
  accessNotes: string | null;
  onsiteContactName: string | null;
  onsiteContactPhone: string | null;
  isDefault: boolean;
};

export type SavedServiceLocationFieldErrors = Partial<Record<keyof SavedServiceLocationInput, string>>;

export type SavedServiceLocationValidationResult =
  | {
      ok: true;
      data: SavedServiceLocationInput;
    }
  | {
      ok: false;
      fieldErrors: SavedServiceLocationFieldErrors;
      formError: string | null;
    };

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function emptyToNull(value: string) {
  return value ? value : null;
}

function clip(value: string, maxLength: number) {
  return value.slice(0, maxLength);
}

function normalizeState(value: string) {
  return value.replace(/[^a-z]/gi, "").slice(0, SERVICE_LOCATION_STATE_MAX_LENGTH).toUpperCase();
}

function normalizeZip(value: string) {
  return value.replace(/[^0-9-]/g, "").slice(0, SERVICE_LOCATION_ZIP_MAX_LENGTH);
}

function debugServiceLocationEvent(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[service-locations]", { event, ...details });
}

export function formatServiceLocationAddress(location: Pick<SavedServiceLocation, "street" | "city" | "state" | "zip">) {
  return [location.street, [location.city, location.state].filter(Boolean).join(", "), location.zip]
    .filter(Boolean)
    .join(" ");
}

export function getServiceLocationNotePreview(value: string | null | undefined, maxLength = 120) {
  const trimmed = cleanText(value);
  if (!trimmed) return null;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

export function validateSavedServiceLocationInput(input: Record<string, unknown>): SavedServiceLocationValidationResult {
  const label = clip(cleanText(input.label), SERVICE_LOCATION_LABEL_MAX_LENGTH);
  const street = clip(cleanText(input.street), SERVICE_LOCATION_STREET_MAX_LENGTH);
  const city = clip(cleanText(input.city), SERVICE_LOCATION_CITY_MAX_LENGTH);
  const state = normalizeState(cleanText(input.state));
  const zip = normalizeZip(cleanText(input.zip));
  const deliveryNotes = emptyToNull(clip(cleanText(input.deliveryNotes), SERVICE_LOCATION_NOTES_MAX_LENGTH));
  const accessNotes = emptyToNull(clip(cleanText(input.accessNotes), SERVICE_LOCATION_ACCESS_MAX_LENGTH));
  const onsiteContactName = emptyToNull(
    clip(cleanText(input.onsiteContactName), SERVICE_LOCATION_CONTACT_NAME_MAX_LENGTH),
  );
  const onsiteContactPhone = normalizePhone(cleanText(input.onsiteContactPhone));
  const isDefault = input.isDefault === true || input.isDefault === "true" || input.isDefault === "on";

  const fieldErrors: SavedServiceLocationFieldErrors = {};

  if (!label) fieldErrors.label = "Add a short label so you can recognize this location later.";
  if (!street) fieldErrors.street = "Street address is required.";
  if (!city) fieldErrors.city = "City is required.";
  if (!/^[A-Z]{2}$/.test(state)) fieldErrors.state = "Use the 2-letter state code.";
  if (!/^\d{5}(?:-\d{4})?$/.test(zip)) fieldErrors.zip = "Enter a valid ZIP code.";
  if (onsiteContactName && !onsiteContactPhone) {
    fieldErrors.onsiteContactPhone = "Add a phone number for the on-site contact.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
      formError: "Please review the highlighted fields.",
    };
  }

  return {
    ok: true,
    data: {
      label,
      street,
      city,
      state,
      zip,
      deliveryNotes,
      accessNotes,
      onsiteContactName,
      onsiteContactPhone,
      isDefault,
    },
  };
}

export async function validateSavedServiceLocationForSave(
  input: Record<string, unknown>,
): Promise<SavedServiceLocationValidationResult> {
  const validation = validateSavedServiceLocationInput(input);

  if (!validation.ok) {
    return validation;
  }

  const serviceableZip = await getActiveServiceAreaZip(sanitizeServiceAreaZip(validation.data.zip));

  if (serviceableZip) {
    return validation;
  }

  return {
    ok: false,
    fieldErrors: {
      zip: "We don’t currently service this ZIP code.",
    },
    formError: "Please review the highlighted fields.",
  };
}

export async function listSavedServiceLocations(customerId: string) {
  const tenant = await getCurrentTenant();
  const { data, error } = await supabaseAdmin
    .from("customer_locations")
    .select(
      "id, customer_id, label, street, city, state, zip, delivery_notes, access_notes, onsite_contact_name, onsite_contact_phone, is_default, created_at, updated_at",
    )
    .eq("business_id", tenant.id)
    .eq("customer_id", customerId)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []) as SavedServiceLocation[];
}

async function clearDefaultLocation(customerId: string, exceptId?: string) {
  const tenant = await getCurrentTenant();
  let query = supabaseAdmin
    .from("customer_locations")
    .update({ is_default: false })
    .eq("business_id", tenant.id)
    .eq("customer_id", customerId);
  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);
}

async function maybePromoteFallbackDefault(customerId: string, exceptId?: string) {
  const tenant = await getCurrentTenant();
  let query = supabaseAdmin
    .from("customer_locations")
    .select("id")
    .eq("business_id", tenant.id)
    .eq("customer_id", customerId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) return;

  const { error: updateError } = await supabaseAdmin
    .from("customer_locations")
    .update({ is_default: true })
    .eq("id", data.id)
    .eq("business_id", tenant.id)
    .eq("customer_id", customerId);

  if (updateError) throw new Error(updateError.message);
}

export async function createSavedServiceLocation(customerId: string, input: SavedServiceLocationInput) {
  debugServiceLocationEvent("create_attempt", {
    customerId,
    label: input.label,
    isDefault: input.isDefault,
  });
  const existingLocations = await listSavedServiceLocations(customerId);
  const shouldBeDefault = input.isDefault || existingLocations.length === 0;

  if (shouldBeDefault) {
    await clearDefaultLocation(customerId);
  }

  const tenant = await getCurrentTenant();
  const { data, error } = await supabaseAdmin
    .from("customer_locations")
    .insert({
      business_id: tenant.id,
      customer_id: customerId,
      label: input.label,
      street: input.street,
      city: input.city,
      state: input.state,
      zip: input.zip,
      delivery_notes: input.deliveryNotes,
      access_notes: input.accessNotes,
      onsite_contact_name: input.onsiteContactName,
      onsite_contact_phone: input.onsiteContactPhone,
      is_default: shouldBeDefault,
    })
    .select(
      "id, customer_id, label, street, city, state, zip, delivery_notes, access_notes, onsite_contact_name, onsite_contact_phone, is_default, created_at, updated_at",
    )
    .single();

  if (error) throw new Error(error.message);

  debugServiceLocationEvent("create_success", {
    customerId,
    locationId: data.id,
  });
  return data as SavedServiceLocation;
}

export async function updateSavedServiceLocation(
  customerId: string,
  locationId: string,
  input: SavedServiceLocationInput,
) {
  const tenant = await getCurrentTenant();
  debugServiceLocationEvent("update_attempt", {
    customerId,
    locationId,
    isDefault: input.isDefault,
  });
  if (input.isDefault) {
    await clearDefaultLocation(customerId, locationId);
  }

  const { data, error } = await supabaseAdmin
    .from("customer_locations")
    .update({
      label: input.label,
      street: input.street,
      city: input.city,
      state: input.state,
      zip: input.zip,
      delivery_notes: input.deliveryNotes,
      access_notes: input.accessNotes,
      onsite_contact_name: input.onsiteContactName,
      onsite_contact_phone: input.onsiteContactPhone,
      is_default: input.isDefault,
    })
    .eq("id", locationId)
    .eq("business_id", tenant.id)
    .eq("customer_id", customerId)
    .select(
      "id, customer_id, label, street, city, state, zip, delivery_notes, access_notes, onsite_contact_name, onsite_contact_phone, is_default, created_at, updated_at",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Saved location not found.");

  const remainingLocations = await listSavedServiceLocations(customerId);
  if (remainingLocations.length > 0 && !remainingLocations.some((location) => location.is_default)) {
    await maybePromoteFallbackDefault(customerId, locationId);
  }

  debugServiceLocationEvent("update_success", {
    customerId,
    locationId,
  });
  return data as SavedServiceLocation;
}

export async function deleteSavedServiceLocation(customerId: string, locationId: string) {
  const tenant = await getCurrentTenant();
  debugServiceLocationEvent("delete_attempt", {
    customerId,
    locationId,
  });
  const { data, error } = await supabaseAdmin
    .from("customer_locations")
    .delete()
    .eq("id", locationId)
    .eq("business_id", tenant.id)
    .eq("customer_id", customerId)
    .select("id, is_default")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Saved location not found.");

  if (data.is_default) {
    await maybePromoteFallbackDefault(customerId);
  }

  debugServiceLocationEvent("delete_success", {
    customerId,
    locationId,
  });
  return { id: data.id as string };
}

export async function setDefaultSavedServiceLocation(customerId: string, locationId: string) {
  const tenant = await getCurrentTenant();
  debugServiceLocationEvent("set_default_attempt", {
    customerId,
    locationId,
  });
  await clearDefaultLocation(customerId, locationId);

  const { data, error } = await supabaseAdmin
    .from("customer_locations")
    .update({ is_default: true })
    .eq("id", locationId)
    .eq("business_id", tenant.id)
    .eq("customer_id", customerId)
    .select(
      "id, customer_id, label, street, city, state, zip, delivery_notes, access_notes, onsite_contact_name, onsite_contact_phone, is_default, created_at, updated_at",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Saved location not found.");

  debugServiceLocationEvent("set_default_success", {
    customerId,
    locationId,
  });
  return data as SavedServiceLocation;
}
