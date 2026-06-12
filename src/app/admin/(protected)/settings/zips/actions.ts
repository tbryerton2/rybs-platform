"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminOwner } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AddZipFormState = {
  error: string | null;
  createdZipId: number | null;
  createdZip: string | null;
  messageKey: number;
};

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function normalizeZip(value: string) {
  return value.trim();
}

function isValidZip(zip: string) {
  return /^\d{5}$/.test(zip);
}

export async function addServiceZipAction(
  _prevState: AddZipFormState,
  formData: FormData,
): Promise<AddZipFormState> {
  const adminSession = await requireAdminOwner();

  const zip = normalizeZip(asString(formData.get("zip")));

  if (!isValidZip(zip)) {
    return {
      error: "ZIP code must be exactly 5 digits.",
      createdZipId: null,
      createdZip: null,
      messageKey: Date.now(),
    };
  }

  const { data, error } = await supabaseAdmin
    .from("service_area_zips")
    .insert({
      business_id: adminSession.business.id,
      zip,
      active: true,
    })
    .select("id, zip")
    .single();

  if (error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("duplicate") ||
      message.includes("unique") ||
      message.includes("already exists")
    ) {
      return {
        error: `ZIP ${zip} already exists.`,
        createdZipId: null,
        createdZip: null,
        messageKey: Date.now(),
      };
    }

    return {
      error: "Unable to add ZIP code right now. Please try again.",
      createdZipId: null,
      createdZip: null,
      messageKey: Date.now(),
    };
  }

  revalidatePath("/admin/settings/zips");
  return {
    error: null,
    createdZipId: Number(data.id),
    createdZip: String(data.zip ?? zip),
    messageKey: Date.now(),
  };
}

export async function toggleServiceZipAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const id = Number(asString(formData.get("id")));

  if (!id) {
    throw new Error("Missing ZIP id.");
  }

  const { data: row, error: readError } = await supabaseAdmin
    .from("service_area_zips")
    .select("id, zip, active")
    .eq("id", id)
    .eq("business_id", adminSession.business.id)
    .single();

  if (readError || !row) {
    throw new Error(readError?.message || "ZIP code not found.");
  }

  const nextActive = !row.active;

  const { error: updateError } = await supabaseAdmin
    .from("service_area_zips")
    .update({ active: nextActive, business_id: adminSession.business.id })
    .eq("id", id)
    .eq("business_id", adminSession.business.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath("/admin/settings/zips");

  const action = nextActive ? "enabled" : "disabled";
  redirect(`/admin/settings/zips?toggled=${encodeURIComponent(`${row.zip}:${action}`)}`);
}

export async function deleteServiceZipAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const id = Number(asString(formData.get("id")));

  if (!id) {
    throw new Error("Missing ZIP id.");
  }

  const { data: row, error: readError } = await supabaseAdmin
    .from("service_area_zips")
    .select("id, zip")
    .eq("id", id)
    .eq("business_id", adminSession.business.id)
    .single();

  if (readError || !row) {
    throw new Error(readError?.message || "ZIP code not found.");
  }

  const { error } = await supabaseAdmin
    .from("service_area_zips")
    .delete()
    .eq("id", id)
    .eq("business_id", adminSession.business.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/settings/zips");
  redirect(`/admin/settings/zips?deleted=${encodeURIComponent(row.zip)}`);
}
