import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env.local");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function clean(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
}

function normalizeEmail(value) {
  const cleaned = clean(value);
  return cleaned ? cleaned.toLowerCase() : null;
}

function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? digits : null;
}

function sameName(a, b) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

async function main() {
  loadEnvFile(envPath);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select(
      "id, customer_id, customer_first_name, customer_last_name, customer_email, customer_phone, customer_street, customer_city, customer_zip, notes, created_at",
    )
    .is("customer_id", null)
    .order("created_at", { ascending: true });

  if (bookingsError) {
    throw new Error(`Could not load bookings: ${bookingsError.message}`);
  }

  let linked = 0;
  let created = 0;
  let skipped = 0;

  for (const booking of bookings ?? []) {
    const normalizedEmail = normalizeEmail(booking.customer_email);
    const normalizedPhone = normalizePhone(booking.customer_phone);
    const fullName = [clean(booking.customer_first_name), clean(booking.customer_last_name)].filter(Boolean).join(" ") || null;

    let customer = null;

    if (normalizedEmail) {
      const existing = await supabase
        .from("customers")
        .select("id, name")
        .eq("normalized_email", normalizedEmail)
        .maybeSingle();

      if (existing.error) {
        throw new Error(existing.error.message);
      }

      customer = existing.data;
    } else if (normalizedPhone && fullName) {
      const existing = await supabase
        .from("customers")
        .select("id, name, phone")
        .not("phone", "is", null);

      if (existing.error) {
        throw new Error(existing.error.message);
      }

      customer = (existing.data ?? []).find(
        (row) => normalizePhone(row.phone) === normalizedPhone && sameName(row.name, fullName),
      ) ?? null;
    } else {
      skipped += 1;
      continue;
    }

    if (!customer) {
      const inserted = await supabase
        .from("customers")
        .insert({
          name: fullName,
          email: clean(booking.customer_email),
          phone: clean(booking.customer_phone),
          primary_street: clean(booking.customer_street),
          primary_city: clean(booking.customer_city),
          primary_zip: clean(booking.customer_zip),
          notes: clean(booking.notes),
          portal_status: "invited",
        })
        .select("id")
        .single();

      if (inserted.error) {
        throw new Error(inserted.error.message);
      }

      customer = inserted.data;
      created += 1;
    }

    const update = await supabase
      .from("bookings")
      .update({ customer_id: customer.id })
      .eq("id", booking.id);

    if (update.error) {
      throw new Error(update.error.message);
    }

    const street = clean(booking.customer_street);
    const city = clean(booking.customer_city);
    const zip = clean(booking.customer_zip);

    if (street && city && zip) {
      const existingLocation = await supabase
        .from("customer_locations")
        .select("id")
        .eq("customer_id", customer.id)
        .eq("street", street)
        .eq("city", city)
        .eq("zip", zip)
        .limit(1);

      if (existingLocation.error) {
        throw new Error(existingLocation.error.message);
      }

      if ((existingLocation.data ?? []).length === 0) {
        const defaultLocation = await supabase
          .from("customer_locations")
          .select("id")
          .eq("customer_id", customer.id)
          .eq("is_default", true)
          .limit(1);

        if (defaultLocation.error) {
          throw new Error(defaultLocation.error.message);
        }

        const insertLocation = await supabase.from("customer_locations").insert({
          customer_id: customer.id,
          label: (defaultLocation.data ?? []).length === 0 ? "Primary location" : "Saved location",
          street,
          city,
          zip,
          delivery_notes: clean(booking.notes),
          is_default: (defaultLocation.data ?? []).length === 0,
        });

        if (insertLocation.error) {
          throw new Error(insertLocation.error.message);
        }
      }
    }

    linked += 1;
  }

  console.log(`Linked ${linked} bookings to customer records.`);
  console.log(`Created ${created} new customers.`);
  console.log(`Skipped ${skipped} bookings without conservative match data.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
