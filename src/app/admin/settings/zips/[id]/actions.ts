// src/app/admin/settings/zips/[id]/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getDumpsterSizeCapacity } from "@/lib/booking-product";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ZipFormState = {
  success: boolean;
  message: string;
  error?: string;
  messageKey: number;
};

export type ZipToggleState = {
  success: boolean;
  message: string;
  error?: string;
  messageKey: number;
  active?: boolean;
};

export type ZipPricingOverrideInput = {
  dumpsterSize: string;
  value: number | null;
};

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function normalizeText(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeCurrency(value: string) {
  return value.trim();
}

function parseId(value: FormDataEntryValue | null) {
  const id = Number(asString(value));
  if (!Number.isFinite(id)) {
    throw new Error("Invalid ZIP id.");
  }
  return id;
}

function revalidateZipPaths(id?: number) {
  revalidatePath("/admin/settings/zips");
  if (id != null) {
    revalidatePath(`/admin/settings/zips/${id}`);
  }
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

  revalidateZipPaths(id);

  return {
    success: true,
    message: "Location details updated.",
    messageKey: Date.now(),
  };
}

export async function toggleZipActiveAction(
  _prevState: ZipToggleState,
  formData: FormData,
): Promise<ZipToggleState> {
  const id = parseId(formData.get("id"));
  const nextActive = asString(formData.get("nextActive")) === "true";

  const { error } = await supabaseAdmin
    .from("service_area_zips")
    .update({
      active: nextActive,
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

  revalidateZipPaths(id);

  return {
    success: true,
    message: `ZIP ${nextActive ? "enabled" : "disabled"}.`,
    messageKey: Date.now(),
    active: nextActive,
  };
}

export async function updateZipPricingAction(
  _prevState: ZipFormState,
  formData: FormData
): Promise<ZipFormState> {
  const id = parseId(formData.get("id"));
  const overrides: ZipPricingOverrideInput[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("price_override:")) continue;

    const dumpsterSize = key.replace("price_override:", "").trim();
    if (!dumpsterSize) continue;

    const rawValue = normalizeCurrency(asString(value));
    if (rawValue === "") {
      overrides.push({ dumpsterSize, value: null });
      continue;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return {
        success: false,
        message: "",
        error: `${dumpsterSize} price override must be a valid non-negative number.`,
        messageKey: Date.now(),
      };
    }

    overrides.push({
      dumpsterSize,
      value: Math.round(parsed),
    });
  }

  const nonNullOverrides = overrides
    .filter((entry) => entry.value !== null)
    .map((entry) => {
      const dumpsterSize = getDumpsterSizeCapacity(entry.dumpsterSize);
      if (!dumpsterSize) return null;

      return {
        service_area_zip_id: id,
        dumpster_size: dumpsterSize,
        price_override: entry.value,
      };
    })
    .filter((entry) => entry !== null);

  const clearedSizes = overrides
    .filter((entry) => entry.value === null)
    .map((entry) => getDumpsterSizeCapacity(entry.dumpsterSize))
    .filter((entry) => entry !== null);

  if (clearedSizes.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from("service_area_zip_pricing_overrides")
      .delete()
      .eq("service_area_zip_id", id)
      .in("dumpster_size", clearedSizes);

    if (deleteError) {
      return {
        success: false,
        message: "",
        error: deleteError.message,
        messageKey: Date.now(),
      };
    }
  }

  if (nonNullOverrides.length > 0) {
    const { error: upsertError } = await supabaseAdmin
      .from("service_area_zip_pricing_overrides")
      .upsert(nonNullOverrides, {
        onConflict: "service_area_zip_id,dumpster_size",
      });

    if (upsertError) {
      return {
        success: false,
        message: "",
        error: upsertError.message,
        messageKey: Date.now(),
      };
    }
  }

  const fourteenYardOverride =
    overrides.find((entry) => entry.dumpsterSize.trim().toLowerCase() === "14 yard")?.value ?? null;

  const { error } = await supabaseAdmin
    .from("service_area_zips")
    .update({
      price_14_yard_override: fourteenYardOverride,
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

  revalidateZipPaths(id);

  return {
    success: true,
    message: "Pricing overrides updated.",
    messageKey: Date.now(),
  };
}
