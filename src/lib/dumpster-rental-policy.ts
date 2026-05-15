import "server-only";

import { DEFAULT_PRICING_SETTINGS, getPricingSettingsSnapshot } from "@/lib/pricing-settings";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type DumpsterRentalPolicyInput = {
  dumpsterSize?: string | null;
  dumpsterProductId?: string | null;
};

export type DumpsterRentalPolicy = {
  dumpsterSize: string;
  dumpsterProductId: string | null;
  productName: string | null;
  standardRentalDays: number;
  dailyOveragePrice: number;
  maxRentalDays: number | null;
  allowExtendedRentalAtBooking: boolean;
  basePrice: number;
};

function normalizeText(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

export async function getDumpsterRentalPolicy(
  input: DumpsterRentalPolicyInput,
): Promise<DumpsterRentalPolicy> {
  const pricingSettings = await getPricingSettingsSnapshot();
  const dumpsterSize = normalizeText(input.dumpsterSize) ?? "14 yard";
  const dumpsterProductId = normalizeText(input.dumpsterProductId);

  let productSettings:
    | {
        included_rental_days: number | null;
        extra_day_price: number | string | null;
        base_price: number | string | null;
        display_name: string | null;
      }
    | null = null;

  if (dumpsterProductId || dumpsterSize) {
    const query = supabaseAdmin
      .from("dumpster_product_settings")
      .select("included_rental_days, extra_day_price, base_price, display_name")
      .limit(1);

    const { data, error } = dumpsterProductId
      ? await query.eq("dumpster_product_id", dumpsterProductId).maybeSingle()
      : await query.eq("dumpster_size", dumpsterSize).maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    productSettings = data;
  }

  const standardRentalDays = Number(productSettings?.included_rental_days);
  const dailyOveragePrice = Number(productSettings?.extra_day_price);
  const basePrice = Number(productSettings?.base_price);

  return {
    dumpsterSize,
    dumpsterProductId,
    productName: productSettings?.display_name?.trim() || null,
    standardRentalDays:
      Number.isInteger(standardRentalDays) && standardRentalDays >= 1
        ? standardRentalDays
        : pricingSettings.standardRentalDays ?? DEFAULT_PRICING_SETTINGS.standardRentalDays,
    dailyOveragePrice:
      Number.isFinite(dailyOveragePrice) && dailyOveragePrice >= 0
        ? Math.round(dailyOveragePrice)
        : pricingSettings.dailyOveragePrice ?? DEFAULT_PRICING_SETTINGS.dailyOveragePrice,
    maxRentalDays: pricingSettings.maxRentalDays,
    allowExtendedRentalAtBooking: pricingSettings.allowExtendedRentalAtBooking,
    basePrice:
      Number.isFinite(basePrice) && basePrice > 0
        ? Math.round(basePrice)
        : pricingSettings.basePrice ?? DEFAULT_PRICING_SETTINGS.basePrice,
  };
}
