import type { SupabaseClient } from "@supabase/supabase-js";
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
};

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeEmail(value: string | null | undefined) {
  const cleaned = clean(value);
  return cleaned ? cleaned.toLowerCase() : null;
}

export function normalizePhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits ? digits : null;
}

function sameNormalizedName(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
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
        "id, name, email, phone, primary_street, primary_city, primary_zip, normalized_email",
      )
      .eq("normalized_email", normalizedEmail)
      .maybeSingle();

    if (!emailLookup.error && emailLookup.data) return emailLookup.data as CustomerRow;
    if (emailLookup.error && !isPortalSchemaError(emailLookup.error)) {
      throw new Error(emailLookup.error.message);
    }

    const fallbackEmailLookup = await supabase
      .from("customers")
      .select("id, name, email, phone, primary_street, primary_city, primary_zip, normalized_email")
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
      .select("id, name, email, phone, primary_street, primary_city, primary_zip, normalized_email")
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
    if (isPortalSchemaError(insertError)) return;
    throw new Error(insertError.message);
  }
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

  if (!normalizeEmail(email) && !(normalizePhone(phone) && fullName)) {
    return null;
  }

  let customer = await findMatchingCustomer(supabase, input);

  if (!customer) {
    let inserted = await supabase
      .from("customers")
      .insert({
        name: fullName,
        email,
        phone,
        primary_street: street,
        primary_city: city,
        primary_zip: zip,
        portal_status: "invited",
      })
      .select("id, name, email, phone, primary_street, primary_city, primary_zip, normalized_email")
      .single();

    if (inserted.error && isPortalSchemaError(inserted.error)) {
      inserted = await supabase
        .from("customers")
        .insert({
          name: fullName,
          email,
          phone,
          primary_street: street,
          primary_city: city,
          primary_zip: zip,
        })
        .select("id, name, email, phone, primary_street, primary_city, primary_zip")
        .single();
    }

    if (inserted.error) throw new Error(inserted.error.message);
    customer = inserted.data as CustomerRow;
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

  await ensureCustomerLocation(supabase, customer.id, input);
  return customer.id;
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
