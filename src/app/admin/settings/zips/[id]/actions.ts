// src/app/admin/settings/zips/[id]/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ZipFormState = {
  success: boolean;
  message: string;
  error?: string;
  messageKey: number;
};

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function normalizeText(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseId(value: FormDataEntryValue | null) {
  const id = Number(asString(value));
  if (!Number.isFinite(id)) {
    throw new Error("Invalid ZIP id.");
  }
  return id;
}

function revalidateZipPaths() {
  revalidatePath("/admin/settings/zips");
}

export async function updateZipLocationAction(
  prevState: ZipFormState,
  formData: FormData
): Promise<ZipFormState> {
  const id = parseId(formData.get("id"));
  const town = normalizeText(asString(formData.get("town")));
  const county = normalizeText(asString(formData.get("county")));

  const { error } = await supabaseAdmin
    .from("service_area_zips")
    .update({
      town,
      county,
    })
    .eq("id", id);

  if (error) {
    return {
      success: false,
      message: "",
      error: error.message,
      messageKey: Date.now(),
    };
  }

  revalidateZipPaths();

  return {
    success: true,
    message: "Location details updated.",
    messageKey: Date.now(),
  };
}

export async function toggleZipActiveAction(formData: FormData) {
  const id = parseId(formData.get("id"));
  const nextActive = asString(formData.get("nextActive")) === "true";

  const { error } = await supabaseAdmin
    .from("service_area_zips")
    .update({
      active: nextActive,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidateZipPaths();
  redirect(
    `/admin/settings/zips/${id}?status=${nextActive ? "enabled" : "disabled"}-${Date.now()}`
  );
}

export async function updateZipPricingAction(
  prevState: ZipFormState,
  formData: FormData
): Promise<ZipFormState> {
  const id = parseId(formData.get("id"));
  const rawValue = asString(formData.get("price_14_yard_override")).trim();

  let price_14_yard_override: number | null = null;

  if (rawValue !== "") {
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return {
        success: false,
        message: "",
        error: "Override price must be a valid non-negative number.",
        messageKey: Date.now(),
      };
    }

    price_14_yard_override = Math.round(parsed);
  }

  const { error } = await supabaseAdmin
    .from("service_area_zips")
    .update({
      price_14_yard_override,
    })
    .eq("id", id);

  if (error) {
    return {
      success: false,
      message: "",
      error: error.message,
      messageKey: Date.now(),
    };
  }

  revalidateZipPaths();

  return {
    success: true,
    message: "Pricing override updated.",
    messageKey: Date.now(),
  };
}