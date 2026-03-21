import type { SupabaseClient } from "@supabase/supabase-js";
import { recordEntityHistory } from "@/lib/entity-history";
import { isValidEmail, normalizeEmail } from "@/lib/identity";
import { isPortalSchemaError } from "@/lib/portal/schema";
import { supabaseServer } from "@/lib/supabase/server";

type CustomerContactInput = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
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
  primary_zip: string | null;
  normalized_email?: string | null;
  portal_status?: string | null;
};

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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
) {
  const normalizedEmail = normalizeEmail(input.email);
  const fullName = clean(input.fullName);

  if (normalizedEmail) {
    const emailLookup = await supabase
      .from("customers")
      .select(
        "id, name, email, phone, primary_street, primary_city, primary_zip, normalized_email, portal_status",
      )
      .eq("normalized_email", normalizedEmail)
      .maybeSingle();

    if (!emailLookup.error && emailLookup.data) return emailLookup.data as CustomerRow;
    if (emailLookup.error && !isPortalSchemaError(emailLookup.error)) {
      throw new Error(emailLookup.error.message);
    }

    const fallbackEmailLookup = await supabase
      .from("customers")
      .select("id, name, email, phone, primary_street, primary_city, primary_zip, normalized_email, portal_status")
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
      .select("id, name, email, phone, primary_street, primary_city, primary_zip, normalized_email, portal_status")
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
) {
  const street = clean(input.street);
  const city = clean(input.city);
  const zip = clean(input.zip);

  if (!street || !city || !zip) return;

  const { data: existing, error: existingError } = await supabase
    .from("customer_locations")
    .select("id, is_default")
    .eq("customer_id", customerId)
    .eq("street", street)
    .eq("city", city)
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
    customer_id: customerId,
    label,
    street,
    city,
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
) {
  if (customer?.id) {
    const byId = await supabase.from("customers").select("id").eq("id", customer.id).maybeSingle();
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
) {
  const fullName = clean(input.fullName);
  const email = clean(input.email);
  const phone = normalizePhone(input.phone);
  const street = clean(input.street);
  const city = clean(input.city);
  const zip = clean(input.zip);

  if (email && !isValidEmail(email)) {
    throw new Error("Please enter a valid email address.");
  }

  if (!normalizeEmail(email) && !(normalizePhone(phone) && fullName)) {
    return null;
  }

  let customer = await findMatchingCustomer(supabase, input);
  let customerCreated = false;

  if (!customer) {
    const legacyIdentifier = getLegacyCustomerIdentifier(input);
    const insertPayload = {
      name: fullName,
      email,
      phone,
      primary_street: street,
      primary_city: city,
      primary_zip: zip,
      portal_status: "invited",
      identifier: legacyIdentifier.identifier,
      identifier_type: legacyIdentifier.identifier_type,
    };

    let inserted = await supabase
      .from("customers")
      .insert(insertPayload)
      .select("id, name, email, phone, primary_street, primary_city, primary_zip, normalized_email, portal_status")
      .single();

    if (inserted.error && isPortalSchemaError(inserted.error)) {
      const fallbackPayload = {
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
        .select("id, name, email, phone, primary_street, primary_city, primary_zip, normalized_email, portal_status")
        .single();
    }

    if (inserted.error) throw new Error(inserted.error.message);
    customer = inserted.data as CustomerRow;
    customerCreated = true;
  } else {
    const updates: Record<string, string> = {};

    if (!customer.name && fullName) updates.name = fullName;
    if (!customer.email && email) updates.email = email;
    if (phone && normalizePhone(customer.phone) !== phone) updates.phone = phone;
    if (!customer.primary_street && street) updates.primary_street = street;
    if (!customer.primary_city && city) updates.primary_city = city;
    if (!customer.primary_zip && zip) updates.primary_zip = zip;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from("customers").update(updates).eq("id", customer.id);
      if (error) throw new Error(error.message);
    }
  }

  const persistedCustomerId = await resolvePersistedCustomerId(supabase, customer, input);

  await ensureCustomerLocation(supabase, persistedCustomerId, input);

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
    ]);
  }

  return persistedCustomerId;
}

export async function attachCustomerToBooking(
  bookingId: string,
  input: CustomerContactInput,
  supabase: SupabaseClient = supabaseServer(),
) {
  const customerId = await findOrCreateCustomerRecord(input, supabase);
  if (!customerId) return null;

  const { error } = await supabase
    .from("bookings")
    .update({ customer_id: customerId })
    .eq("id", bookingId);

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

  const { data: existing, error: existingError } = await supabase
    .from("customers")
    .select("id")
    .eq("normalized_email", normalizedEmail)
    .maybeSingle();

  if (!existingError && existing?.id) return existing.id as string;

  const emailFallback = await supabase
    .from("customers")
    .select("id")
    .ilike("email", normalizedEmail)
    .limit(1);

  if (emailFallback.error) throw new Error(emailFallback.error.message);
  if ((emailFallback.data ?? []).length > 0) return emailFallback.data?.[0]?.id as string;

  if (existingError && !isPortalSchemaError(existingError)) {
    throw new Error(existingError.message);
  }

  const { data: bookings, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, customer_name, customer_email, customer_phone, customer_street, customer_city, customer_zip, notes",
    )
    .ilike("customer_email", normalizedEmail)
    .order("created_at", { ascending: false });

  if (bookingError) throw new Error(bookingError.message);
  const rows = bookings ?? [];
  if (rows.length === 0) return null;

  const latest = rows[0];
  const customerId = await findOrCreateCustomerRecord(
    {
      fullName: latest.customer_name,
      email: latest.customer_email,
      phone: latest.customer_phone,
      street: latest.customer_street,
      city: latest.customer_city,
      zip: latest.customer_zip,
      deliveryNotes: latest.notes,
    },
    supabase,
  );

  if (!customerId) return null;

  const matchingBookingIds = rows
    .filter((row) => normalizeEmail(row.customer_email) === normalizedEmail)
    .map((row) => row.id);

  if (matchingBookingIds.length > 0) {
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ customer_id: customerId })
      .in("id", matchingBookingIds);

    if (updateError) throw new Error(updateError.message);
  }

  return customerId;
}
