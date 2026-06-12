"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordEntityHistory, type EntityHistoryEntry } from "@/lib/entity-history";
import { isValidEmail } from "@/lib/identity";
import { clearPortalSessionCookies, deactivatePortalAccess, requirePortalCustomer } from "@/lib/portal/auth";
import { isPortalSchemaError } from "@/lib/portal/schema";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTenant } from "@/lib/tenant/server";

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function nullable(value: string) {
  return value ? value : null;
}

function normalizeState(value: string) {
  return value.trim() ? value.trim().toUpperCase() : null;
}

function normalizePreferredContactMethod(value: string) {
  return ["email", "phone", "either"].includes(value) ? value : null;
}

export async function updatePortalAccountAction(formData: FormData) {
  const customer = await requirePortalCustomer();
  const tenant = await getCurrentTenant();

  const fullName = value(formData, "full_name");
  const company = value(formData, "company");
  const email = value(formData, "email");
  const phone = value(formData, "phone");
  const preferredContactMethod = normalizePreferredContactMethod(value(formData, "preferred_contact_method"));
  const street = value(formData, "street_address");
  const city = value(formData, "city");
  const state = normalizeState(value(formData, "state"));
  const zip = value(formData, "zip_code");

  if (!fullName) throw new Error("Full name is required.");
  if (!email || !isValidEmail(email)) throw new Error("A valid email is required.");

  const extendedSelect =
    "id, name, email, phone, company, preferred_contact_method, primary_street, primary_city, primary_state, primary_zip";
  const fallbackSelect = "id, name, email, phone, primary_street, primary_city, primary_state, primary_zip";

  let current = await supabaseAdmin
    .from("customers")
    .select(extendedSelect)
    .eq("id", customer.id)
    .eq("business_id", tenant.id)
    .maybeSingle();

  let supportsExtendedFields = true;

  if (current.error && isPortalSchemaError(current.error)) {
    supportsExtendedFields = false;
    current = await supabaseAdmin
      .from("customers")
      .select(fallbackSelect)
      .eq("id", customer.id)
      .eq("business_id", tenant.id)
      .maybeSingle();
  }

  if (current.error || !current.data) {
    throw new Error(current.error?.message ?? "Customer account could not be loaded.");
  }

  const currentRow = current.data as Record<string, string | null>;
  const updates: Record<string, string | null> = {
    name: nullable(fullName),
    email: nullable(email),
    phone: nullable(phone),
    primary_street: nullable(street),
    primary_city: nullable(city),
    primary_state: state,
    primary_zip: nullable(zip),
  };

  if (supportsExtendedFields) {
    updates.company = nullable(company);
    updates.preferred_contact_method = preferredContactMethod;
  }

  const nullableHistoryEntries: Array<EntityHistoryEntry | null> = [
    currentRow.name !== updates.name
      ? {
          entityType: "customer" as const,
          entityId: customer.id,
          fieldName: "name",
          oldValue: currentRow.name,
          newValue: updates.name,
          changedByType: "customer" as const,
          changeReason: "Updated portal account profile",
        }
      : null,
    currentRow.email !== updates.email
      ? {
          entityType: "customer" as const,
          entityId: customer.id,
          fieldName: "email",
          oldValue: currentRow.email,
          newValue: updates.email,
          changedByType: "customer" as const,
          changeReason: "Updated portal account profile",
        }
      : null,
    currentRow.phone !== updates.phone
      ? {
          entityType: "customer" as const,
          entityId: customer.id,
          fieldName: "phone",
          oldValue: currentRow.phone,
          newValue: updates.phone,
          changedByType: "customer" as const,
          changeReason: "Updated portal account profile",
        }
      : null,
    currentRow.primary_street !== updates.primary_street
      ? {
          entityType: "customer" as const,
          entityId: customer.id,
          fieldName: "primary_street",
          oldValue: currentRow.primary_street,
          newValue: updates.primary_street,
          changedByType: "customer" as const,
          changeReason: "Updated portal account address",
        }
      : null,
    currentRow.primary_city !== updates.primary_city
      ? {
          entityType: "customer" as const,
          entityId: customer.id,
          fieldName: "primary_city",
          oldValue: currentRow.primary_city,
          newValue: updates.primary_city,
          changedByType: "customer" as const,
          changeReason: "Updated portal account address",
        }
      : null,
    currentRow.primary_state !== updates.primary_state
      ? {
          entityType: "customer" as const,
          entityId: customer.id,
          fieldName: "primary_state",
          oldValue: currentRow.primary_state,
          newValue: updates.primary_state,
          changedByType: "customer" as const,
          changeReason: "Updated portal account address",
        }
      : null,
    currentRow.primary_zip !== updates.primary_zip
      ? {
          entityType: "customer" as const,
          entityId: customer.id,
          fieldName: "primary_zip",
          oldValue: currentRow.primary_zip,
          newValue: updates.primary_zip,
          changedByType: "customer" as const,
          changeReason: "Updated portal account address",
        }
      : null,
    supportsExtendedFields && currentRow.company !== updates.company
      ? {
          entityType: "customer" as const,
          entityId: customer.id,
          fieldName: "company",
          oldValue: currentRow.company ?? null,
          newValue: updates.company ?? null,
          changedByType: "customer" as const,
          changeReason: "Updated portal account profile",
        }
      : null,
    supportsExtendedFields && currentRow.preferred_contact_method !== updates.preferred_contact_method
      ? {
          entityType: "customer" as const,
          entityId: customer.id,
          fieldName: "preferred_contact_method",
          oldValue: currentRow.preferred_contact_method ?? null,
          newValue: updates.preferred_contact_method ?? null,
          changedByType: "customer" as const,
          changeReason: "Updated portal account preferences",
        }
      : null,
  ];
  const historyEntries = nullableHistoryEntries.filter(
    (entry): entry is EntityHistoryEntry => entry !== null,
  );

  let updateResult = await supabaseAdmin
    .from("customers")
    .update(updates)
    .eq("id", customer.id)
    .eq("business_id", tenant.id);
  if (updateResult.error && isPortalSchemaError(updateResult.error) && supportsExtendedFields) {
    const fallbackUpdates = { ...updates };
    delete fallbackUpdates.company;
    delete fallbackUpdates.preferred_contact_method;
    updateResult = await supabaseAdmin
      .from("customers")
      .update(fallbackUpdates)
      .eq("id", customer.id)
      .eq("business_id", tenant.id);
  }

  if (updateResult.error) {
    throw new Error(updateResult.error.message);
  }

  if (historyEntries.length > 0) {
    await recordEntityHistory(supabaseAdmin, historyEntries, tenant.id);
  }

  revalidatePath("/portal/account");
  redirect("/portal/account?saved=1");
}

export async function deactivatePortalAccountAction() {
  const customer = await requirePortalCustomer();
  await deactivatePortalAccess(customer.id, "Customer closed portal access");
  await clearPortalSessionCookies();
  redirect("/portal/login?closed=1");
}
