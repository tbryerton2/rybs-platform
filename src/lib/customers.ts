import type { SupabaseClient } from "@supabase/supabase-js";
import { recordEntityHistory } from "@/lib/entity-history";
import { isValidEmail, normalizeEmail } from "@/lib/identity";
import { isPortalSchemaError } from "@/lib/portal/schema";
import { supabaseServer } from "@/lib/supabase/server";
import { combineCustomerNameParts } from "@/lib/customer-name";
import { getCurrentTenant } from "@/lib/tenant/server";

type CustomerContactInput = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  deliveryNotes?: string | null;
};

type CustomerRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  primary_street: string | null;
  primary_city: string | null;
  primary_state: string | null;
  primary_zip: string | null;
  normalized_email?: string | null;
  portal_status?: string | null;
};

export const PORTAL_ACCESS_DEACTIVATED_ERROR = "PORTAL_ACCESS_DEACTIVATED";
const CUSTOMER_SELECT =
  "id, name, email, phone, primary_street, primary_city, primary_state, primary_zip, normalized_email, portal_status";
const CUSTOMER_FALLBACK_SELECT =
  "id, name, email, phone, primary_street, primary_city, primary_zip, normalized_email, portal_status";

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function assertPortalAccessEnabled(customer: Pick<CustomerRow, "portal_status"> | null) {
  if ((customer?.portal_status ?? "active") === "deactivated") {
    throw new Error(PORTAL_ACCESS_DEACTIVATED_ERROR);
  }
}

export function normalizePhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits ? digits : null;
}

export { normalizeEmail, isValidEmail };

function sameNormalizedName(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

function isCustomerLocationForeignKeyError(errorLike: { message?: string | null } | string | null | undefined) {
  const message =
    typeof errorLike === "string" ? errorLike : typeof errorLike?.message === "string" ? errorLike.message : "";
  const normalized = message.toLowerCase();

  return (
    normalized.includes("customer_locations_customer_id_fkey") ||
    (normalized.includes("customer_locations") && normalized.includes("foreign key"))
  );
}

function getLegacyCustomerIdentifier(input: CustomerContactInput) {
  const normalizedEmail = normalizeEmail(input.email);
  if (normalizedEmail) {
    return {
      identifier: normalizedEmail,
      identifier_type: "email" as const,
    };
  }

  const normalizedPhone = normalizePhone(input.phone);
  if (normalizedPhone) {
    return {
      identifier: normalizedPhone,
      identifier_type: "phone" as const,
    };
  }

  return {
    identifier: null,
    identifier_type: null,
  };
}

async function findMatchingCustomer(
  supabase: SupabaseClient,
  input: CustomerContactInput,
  businessId: string,
) {
  const normalizedEmail = normalizeEmail(input.email);
  const fullName = clean(input.fullName);

  if (normalizedEmail) {
    const emailLookup = await supabase
      .from("customers")
      .select(CUSTOMER_SELECT)
      .eq("business_id", businessId)
      .eq("normalized_email", normalizedEmail)
      .maybeSingle();

    if (!emailLookup.error && emailLookup.data) return emailLookup.data as CustomerRow;
    if (emailLookup.error && !isPortalSchemaError(emailLookup.error)) {
      throw new Error(emailLookup.error.message);
    }

    const fallbackEmailLookup = await supabase
      .from("customers")
      .select(CUSTOMER_FALLBACK_SELECT)
      .eq("business_id", businessId)
      .ilike("email", normalizedEmail)
      .limit(1);

    if (fallbackEmailLookup.error) throw new Error(fallbackEmailLookup.error.message);
    if ((fallbackEmailLookup.data ?? []).length > 0) {
      return fallbackEmailLookup.data?.[0] as CustomerRow;
    }
  }

  const normalizedPhone = normalizePhone(input.phone);
  if (normalizedPhone && fullName) {
    const { data, error } = await supabase
      .from("customers")
      .select(CUSTOMER_SELECT)
      .eq("business_id", businessId)
      .not("phone", "is", null);

    if (error) throw new Error(error.message);

    const exactPhoneMatch = (data ?? []).find(
      (row) =>
        normalizePhone(row.phone) === normalizedPhone &&
        sameNormalizedName(row.name, fullName),
    );

    if (exactPhoneMatch) return exactPhoneMatch as CustomerRow;
  }

  return null;
}

async function ensureCustomerLocation(
  supabase: SupabaseClient,
  customerId: string,
  input: CustomerContactInput,
  businessId: string,
) {
  const street = clean(input.street);
  const city = clean(input.city);
  const state = clean(input.state)?.toUpperCase() ?? null;
  const zip = clean(input.zip);

  if (!street || !city || !state || !zip) return;

  const { data: existing, error: existingError } = await supabase
    .from("customer_locations")
    .select("id, is_default")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("street", street)
    .eq("city", city)
    .eq("state", state)
    .eq("zip", zip)
    .limit(1);

  if (existingError) {
    if (isPortalSchemaError(existingError)) return;
    throw new Error(existingError.message);
  }
  if ((existing ?? []).length > 0) return;

  const { data: defaults, error: defaultsError } = await supabase
    .from("customer_locations")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("is_default", true)
    .limit(1);

  if (defaultsError) {
    if (isPortalSchemaError(defaultsError)) return;
    throw new Error(defaultsError.message);
  }

  const hasDefault = (defaults ?? []).length > 0;
  const label = hasDefault ? "Saved location" : "Primary location";

  const { error: insertError } = await supabase.from("customer_locations").insert({
    business_id: businessId,
    customer_id: customerId,
    label,
    street,
    city,
    state,
    zip,
    delivery_notes: clean(input.deliveryNotes),
    is_default: !hasDefault,
  });

  if (insertError) {
    if (isCustomerLocationForeignKeyError(insertError)) {
      console.warn("[customers] skipping customer_locations write after customer lookup/create", {
        customerId,
        message: insertError.message,
      });
      return;
    }
    if (isPortalSchemaError(insertError)) return;
    throw new Error(insertError.message);
  }
}

async function resolvePersistedCustomerId(
  supabase: SupabaseClient,
  customer: CustomerRow | null,
  input: CustomerContactInput,
  businessId: string,
) {
  if (customer?.id) {
    const byId = await supabase
      .from("customers")
      .select("id")
      .eq("id", customer.id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (byId.error && !isPortalSchemaError(byId.error)) {
      throw new Error(byId.error.message);
    }
    if (byId.data?.id) {
      return byId.data.id as string;
    }
  }

  const normalizedEmail = normalizeEmail(input.email);
  if (normalizedEmail) {
    const byEmail = await supabase
      .from("customers")
      .select("id")
      .eq("business_id", businessId)
      .eq("normalized_email", normalizedEmail)
      .maybeSingle();

    if (byEmail.error && !isPortalSchemaError(byEmail.error)) {
      throw new Error(byEmail.error.message);
    }
    if (byEmail.data?.id) {
      return byEmail.data.id as string;
    }
  }

  const normalizedPhone = normalizePhone(input.phone);
  const fullName = clean(input.fullName);
  if (normalizedPhone && fullName) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone")
      .eq("business_id", businessId)
      .not("phone", "is", null);

    if (error) throw new Error(error.message);

    const exactPhoneMatch = (data ?? []).find(
      (row) =>
        normalizePhone(row.phone) === normalizedPhone &&
        sameNormalizedName(row.name, fullName),
    );

    if (exactPhoneMatch?.id) return exactPhoneMatch.id as string;
  }

  throw new Error("Customer record could not be verified after lookup/create.");
}

export async function findOrCreateCustomerRecord(
  input: CustomerContactInput,
  supabase: SupabaseClient = supabaseServer(),
  businessId?: string,
) {
  const fullName = clean(input.fullName);
  const email = clean(input.email);
  const phone = normalizePhone(input.phone);
  const street = clean(input.street);
  const city = clean(input.city);
  const state = clean(input.state)?.toUpperCase() ?? null;
  const zip = clean(input.zip);

  if (email && !isValidEmail(email)) {
    throw new Error("Please enter a valid email address.");
  }

  if (!normalizeEmail(email) && !(normalizePhone(phone) && fullName)) {
    return null;
  }

  const resolvedBusinessId = businessId ?? (await getCurrentTenant()).id;
  let customer = await findMatchingCustomer(supabase, input, resolvedBusinessId);
  let customerCreated = false;

  if (!customer) {
    const legacyIdentifier = getLegacyCustomerIdentifier(input);
    const insertPayload = {
      business_id: resolvedBusinessId,
      name: fullName,
      email,
      phone,
      primary_street: street,
      primary_city: city,
      primary_state: state,
      primary_zip: zip,
      portal_status: "invited",
      identifier: legacyIdentifier.identifier,
      identifier_type: legacyIdentifier.identifier_type,
    };

    let inserted = await supabase
      .from("customers")
      .insert(insertPayload)
      .select(CUSTOMER_SELECT)
      .single();

    if (inserted.error && isPortalSchemaError(inserted.error)) {
      const fallbackPayload = {
        business_id: resolvedBusinessId,
        name: fullName,
        email,
        phone,
        primary_street: street,
        primary_city: city,
        primary_zip: zip,
      };

      inserted = await supabase
        .from("customers")
        .insert(fallbackPayload)
        .select(CUSTOMER_FALLBACK_SELECT)
        .single();
    }

    if (inserted.error) throw new Error(inserted.error.message);
    customer = inserted.data as CustomerRow;
    customerCreated = true;
  } else {
    assertPortalAccessEnabled(customer);
    const updates: Record<string, string> = {};

    if (!customer.name && fullName) updates.name = fullName;
    if (!customer.email && email) updates.email = email;
    if (phone && normalizePhone(customer.phone) !== phone) updates.phone = phone;
    if (!customer.primary_street && street) updates.primary_street = street;
    if (!customer.primary_city && city) updates.primary_city = city;
    if (!customer.primary_state && state) updates.primary_state = state;
    if (!customer.primary_zip && zip) updates.primary_zip = zip;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", customer.id)
        .eq("business_id", resolvedBusinessId);
      if (error) throw new Error(error.message);
    }
  }

  const persistedCustomerId = await resolvePersistedCustomerId(supabase, customer, input, resolvedBusinessId);

  assertPortalAccessEnabled(customer);

  await ensureCustomerLocation(supabase, persistedCustomerId, input, resolvedBusinessId);

  if (customerCreated) {
    await recordEntityHistory(supabase, [
      {
        entityType: "customer",
        entityId: persistedCustomerId,
        fieldName: "customer_created",
        newValue: customer.email ?? customer.phone ?? customer.id,
        changedByType: "system",
        changeReason: "Customer record created from booking flow",
      },
    ], resolvedBusinessId);
  }

  return persistedCustomerId;
}

export async function attachCustomerToBooking(
  bookingId: string,
  input: CustomerContactInput,
  supabase: SupabaseClient = supabaseServer(),
) {
  const businessId = (await getCurrentTenant()).id;
  const customerId = await findOrCreateCustomerRecord(input, supabase, businessId);
  if (!customerId) return null;

  const { error } = await supabase
    .from("bookings")
    .update({ customer_id: customerId })
    .eq("id", bookingId)
    .eq("business_id", businessId);

  if (error) {
    if (isPortalSchemaError(error)) return customerId;
    throw new Error(error.message);
  }
  return customerId;
}

export async function ensureCustomerForEmail(
  email: string,
  supabase: SupabaseClient = supabaseServer(),
) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  const businessId = (await getCurrentTenant()).id;

  const { data: existing, error: existingError } = await supabase
    .from("customers")
    .select("id, portal_status")
    .eq("business_id", businessId)
    .eq("normalized_email", normalizedEmail)
    .maybeSingle();

  if (!existingError && existing?.id) {
    assertPortalAccessEnabled(existing as CustomerRow);
    return existing.id as string;
  }

  const emailFallback = await supabase
    .from("customers")
    .select("id, portal_status")
    .eq("business_id", businessId)
    .ilike("email", normalizedEmail)
    .limit(1);

  if (emailFallback.error) throw new Error(emailFallback.error.message);
  if ((emailFallback.data ?? []).length > 0) {
    const fallbackCustomer = emailFallback.data?.[0] as CustomerRow;
    assertPortalAccessEnabled(fallbackCustomer);
    return fallbackCustomer.id as string;
  }

  if (existingError && !isPortalSchemaError(existingError)) {
    throw new Error(existingError.message);
  }

  const { data: bookings, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, customer_first_name, customer_last_name, customer_email, customer_phone, customer_street, customer_city, customer_state, customer_zip, notes",
    )
    .eq("business_id", businessId)
    .ilike("customer_email", normalizedEmail)
    .order("created_at", { ascending: false });

  if (bookingError) throw new Error(bookingError.message);
  const rows = bookings ?? [];
  if (rows.length === 0) return null;

  const latest = rows[0];
  const customerId = await findOrCreateCustomerRecord(
    {
      fullName: combineCustomerNameParts(latest.customer_first_name, latest.customer_last_name),
      email: latest.customer_email,
      phone: latest.customer_phone,
      street: latest.customer_street,
      city: latest.customer_city,
      state: latest.customer_state,
      zip: latest.customer_zip,
      deliveryNotes: latest.notes,
    },
    supabase,
    businessId,
  );

  if (!customerId) return null;

  const { data: finalCustomer, error: finalCustomerError } = await supabase
    .from("customers")
    .select("id, portal_status")
    .eq("id", customerId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (finalCustomerError && !isPortalSchemaError(finalCustomerError)) {
    throw new Error(finalCustomerError.message);
  }

  if (finalCustomer?.id) {
    assertPortalAccessEnabled(finalCustomer as CustomerRow);
  }

  const matchingBookingIds = rows
    .filter((row) => normalizeEmail(row.customer_email) === normalizedEmail)
    .map((row) => row.id);

  if (matchingBookingIds.length > 0) {
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ customer_id: customerId })
      .eq("business_id", businessId)
      .in("id", matchingBookingIds);

    if (updateError) throw new Error(updateError.message);
  }

  return customerId;
}
