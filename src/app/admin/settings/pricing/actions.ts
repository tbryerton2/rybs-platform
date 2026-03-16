"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function parseCurrency(value: string, fieldLabel: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${fieldLabel} is required`);

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a valid non-negative number`);
  }

  return Number(parsed.toFixed(2));
}

function parseInteger(value: string, fieldLabel: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${fieldLabel} is required`);

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${fieldLabel} must be a whole number greater than 0`);
  }

  return parsed;
}

function parseDecimal(value: string, fieldLabel: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${fieldLabel} is required`);

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a valid non-negative number`);
  }

  return Number(parsed.toFixed(2));
}

export async function updatePricingSettingsAction(formData: FormData) {
  const id = asString(formData.get("id"));

  if (!id) throw new Error("Missing pricing settings id");

  const standardRentalPrice = parseCurrency(
    asString(formData.get("standard_rental_price")),
    "Standard rental price"
  );

  const scheduledPickupPrice = parseCurrency(
    asString(formData.get("scheduled_pickup_price")),
    "Scheduled pickup price"
  );

  const includedRentalDays = parseInteger(
    asString(formData.get("included_rental_days")),
    "Included rental days"
  );

  const includedTons = parseDecimal(
    asString(formData.get("included_tons")),
    "Included tons"
  );

  const dailyOveragePrice = parseCurrency(
    asString(formData.get("daily_overage_price")),
    "Daily overage price"
  );

  const tonOveragePrice = parseCurrency(
    asString(formData.get("ton_overage_price")),
    "Weight overage price"
  );

  if (scheduledPickupPrice > standardRentalPrice) {
    throw new Error("Scheduled pickup price cannot be greater than standard rental price");
  }

  const { error } = await supabaseAdmin
    .from("pricing_settings")
    .update({
      standard_rental_price: standardRentalPrice,
      scheduled_pickup_price: scheduledPickupPrice,
      included_rental_days: includedRentalDays,
      included_tons: includedTons,
      daily_overage_price: dailyOveragePrice,
      ton_overage_price: tonOveragePrice,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/settings/pricing");
  redirect("/admin/settings/pricing?saved=1");
}