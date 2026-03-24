import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PricingSettingsSnapshot = {
  standardRentalPrice: number;
  scheduledPickupPrice: number;
  includedRentalDays: number;
  dailyOveragePrice: number;
  includedTons: number;
  tonOveragePrice: number;
};

export const DEFAULT_PRICING_SETTINGS: PricingSettingsSnapshot = {
  standardRentalPrice: 475,
  scheduledPickupPrice: 450,
  includedRentalDays: 7,
  dailyOveragePrice: 30,
  includedTons: 1,
  tonOveragePrice: 100,
};

export async function getPricingSettingsSnapshot(): Promise<PricingSettingsSnapshot> {
  const { data, error } = await supabaseAdmin
    .from("pricing_settings")
    .select(
      "standard_rental_price, scheduled_pickup_price, included_rental_days, daily_overage_price, included_tons, ton_overage_price",
    )
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return DEFAULT_PRICING_SETTINGS;
  }

  return {
    standardRentalPrice: Number(data.standard_rental_price) || DEFAULT_PRICING_SETTINGS.standardRentalPrice,
    scheduledPickupPrice: Number(data.scheduled_pickup_price) || DEFAULT_PRICING_SETTINGS.scheduledPickupPrice,
    includedRentalDays: Number(data.included_rental_days) || DEFAULT_PRICING_SETTINGS.includedRentalDays,
    dailyOveragePrice: Number(data.daily_overage_price) || DEFAULT_PRICING_SETTINGS.dailyOveragePrice,
    includedTons: Number(data.included_tons) || DEFAULT_PRICING_SETTINGS.includedTons,
    tonOveragePrice: Number(data.ton_overage_price) || DEFAULT_PRICING_SETTINGS.tonOveragePrice,
  };
}
