"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordEntityHistory, type EntityHistoryEntry } from "@/lib/entity-history";
import { isValidEmail } from "@/lib/identity";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateCustomerIdentityAction(formData: FormData) {
  const id = getValue(formData, "id");
  const email = getValue(formData, "email");
  const name = getValue(formData, "name");
  const phone = getValue(formData, "phone");

  if (!id) throw new Error("Missing customer id");
  if (!email || !isValidEmail(email)) throw new Error("A valid email is required.");

  const current = await supabaseAdmin
    .from("customers")
    .select("id, email, name, phone")
    .eq("id", id)
    .single();

  if (current.error || !current.data) throw new Error(current.error?.message ?? "Customer not found");

  const updates = {
    email,
    name: name || null,
    phone: phone || null,
  };

  const nullableHistoryEntries: Array<EntityHistoryEntry | null> = [
    current.data.email !== updates.email
      ? {
          entityType: "customer" as const,
          entityId: id,
          fieldName: "email",
          oldValue: current.data.email,
          newValue: updates.email,
          changedByType: "admin" as const,
          changeReason: "Updated customer account email",
        }
      : null,
    current.data.name !== updates.name
      ? {
          entityType: "customer" as const,
          entityId: id,
          fieldName: "name",
          oldValue: current.data.name,
          newValue: updates.name,
          changedByType: "admin" as const,
          changeReason: "Updated customer account details",
        }
      : null,
    current.data.phone !== updates.phone
      ? {
          entityType: "customer" as const,
          entityId: id,
          fieldName: "phone",
          oldValue: current.data.phone,
          newValue: updates.phone,
          changedByType: "admin" as const,
          changeReason: "Updated customer account details",
        }
      : null,
  ];
  const historyEntries = nullableHistoryEntries.filter(
    (entry): entry is EntityHistoryEntry => entry !== null,
  );

  const { error } = await supabaseAdmin.from("customers").update(updates).eq("id", id);
  if (error) throw new Error(error.message);

  if (historyEntries.length > 0) {
    await recordEntityHistory(supabaseAdmin, historyEntries);
  }

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}`);
  redirect(`/admin/customers/${id}?saved=identity`);
}

export async function setCustomerPortalStatusAction(formData: FormData) {
  const id = getValue(formData, "id");
  const portalStatus = getValue(formData, "portal_status");

  if (!id) throw new Error("Missing customer id");
  if (!["active", "deactivated"].includes(portalStatus)) {
    throw new Error("Invalid portal status");
  }

  const current = await supabaseAdmin
    .from("customers")
    .select("id, portal_status")
    .eq("id", id)
    .single();

  if (current.error || !current.data) throw new Error(current.error?.message ?? "Customer not found");

  const updates = {
    portal_status: portalStatus,
    deactivated_at: portalStatus === "deactivated" ? new Date().toISOString() : null,
    deactivation_reason:
      portalStatus === "deactivated" ? "Portal access updated by admin" : null,
  };

  const { error } = await supabaseAdmin.from("customers").update(updates).eq("id", id);
  if (error) throw new Error(error.message);

  await recordEntityHistory(supabaseAdmin, [
    {
      entityType: "customer",
      entityId: id,
      fieldName: "portal_status",
      oldValue: current.data.portal_status,
      newValue: portalStatus,
      changedByType: "admin",
      changeReason:
        portalStatus === "deactivated" ? "Portal access deactivated by admin" : "Portal access reactivated by admin",
    },
  ]);

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}`);
  redirect(`/admin/customers/${id}?saved=portal`);
}
