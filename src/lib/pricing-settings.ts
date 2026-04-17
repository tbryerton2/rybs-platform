import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PricingSettingsSnapshot = {
  basePrice: number;
  standardRentalDays: number;
  dailyOveragePrice: number;
  maxRentalDays: number | null;
  allowExtendedRentalAtBooking: boolean;
  includedTons: number;
  tonOveragePrice: number;
  standardRentalPrice: number;
  includedRentalDays: number;
  scheduledPickupPrice: number;
};

export const DEFAULT_PRICING_SETTINGS: PricingSettingsSnapshot = {
  basePrice: 475,
  standardRentalDays: 7,
  dailyOveragePrice: 30,
  maxRentalDays: null,
  allowExtendedRentalAtBooking: false,
  includedTons: 1,
  tonOveragePrice: 100,
  standardRentalPrice: 475,
  includedRentalDays: 7,
  scheduledPickupPrice: 475,
};

type LegacyPricingSettingsRow = {
  standard_rental_price: number | null;
  included_rental_days: number | null;
  daily_overage_price: number | null;
  included_tons: number | null;
  ton_overage_price: number | null;
};

export function isMissingPricingSettingsRentalPeriodColumnsError(error: { message?: string } | null | undefined) {
  const message = String(error?.message ?? "");
  return (
    message.includes("column pricing_settings.max_rental_days does not exist") ||
    message.includes("column pricing_settings.allow_extended_rental_at_booking does not exist") ||
    message.includes("Could not find the 'max_rental_days' column of 'pricing_settings' in the schema cache") ||
    message.includes(
      "Could not find the 'allow_extended_rental_at_booking' column of 'pricing_settings' in the schema cache",
    )
  );
}

function normalizePricingSettingsSnapshot(
  data: Partial<LegacyPricingSettingsRow> & {
    max_rental_days?: number | null;
    allow_extended_rental_at_booking?: boolean | null;
  },
): PricingSettingsSnapshot {
  const basePrice = Number(data.standard_rental_price);
  const standardRentalDays = Number(data.included_rental_days);
  const dailyOveragePrice = Number(data.daily_overage_price);
  const maxRentalDaysRaw =
    data.max_rental_days === null || data.max_rental_days === undefined
      ? null
      : Number(data.max_rental_days);

  return {
    basePrice: Number.isFinite(basePrice) ? basePrice : DEFAULT_PRICING_SETTINGS.basePrice,
    standardRentalDays:
      Number.isInteger(standardRentalDays) && standardRentalDays >= 1
        ? standardRentalDays
        : DEFAULT_PRICING_SETTINGS.standardRentalDays,
    dailyOveragePrice:
      Number.isFinite(dailyOveragePrice)
        ? dailyOveragePrice
        : DEFAULT_PRICING_SETTINGS.dailyOveragePrice,
    maxRentalDays:
      maxRentalDaysRaw !== null && Number.isInteger(maxRentalDaysRaw) && maxRentalDaysRaw >= 1
        ? maxRentalDaysRaw
        : null,
    allowExtendedRentalAtBooking:
      typeof data.allow_extended_rental_at_booking === "boolean"
        ? data.allow_extended_rental_at_booking
        : DEFAULT_PRICING_SETTINGS.allowExtendedRentalAtBooking,
    includedTons: Number(data.included_tons) || DEFAULT_PRICING_SETTINGS.includedTons,
    tonOveragePrice: Number(data.ton_overage_price) || DEFAULT_PRICING_SETTINGS.tonOveragePrice,
    standardRentalPrice: Number.isFinite(basePrice) ? basePrice : DEFAULT_PRICING_SETTINGS.basePrice,
    includedRentalDays:
      Number.isInteger(standardRentalDays) && standardRentalDays >= 1
        ? standardRentalDays
        : DEFAULT_PRICING_SETTINGS.standardRentalDays,
    scheduledPickupPrice:
      Number.isFinite(basePrice) ? basePrice : DEFAULT_PRICING_SETTINGS.basePrice,
  };
}

export async function getPricingSettingsSnapshot(): Promise<PricingSettingsSnapshot> {
  const { data, error } = await supabaseAdmin
    .from("pricing_settings")
    .select(
      "standard_rental_price, included_rental_days, daily_overage_price, max_rental_days, allow_extended_rental_at_booking, included_tons, ton_overage_price",
    )
    .maybeSingle();

  if (error && !isMissingPricingSettingsRentalPeriodColumnsError(error)) {
    throw new Error(error.message);
  }

  if (error && isMissingPricingSettingsRentalPeriodColumnsError(error)) {
    const legacyResult = await supabaseAdmin
      .from("pricing_settings")
      .select(
        "standard_rental_price, included_rental_days, daily_overage_price, included_tons, ton_overage_price",
      )
      .maybeSingle<LegacyPricingSettingsRow>();

    if (legacyResult.error) {
      throw new Error(legacyResult.error.message);
    }

    if (!legacyResult.data) {
      return DEFAULT_PRICING_SETTINGS;
    }

    return normalizePricingSettingsSnapshot(legacyResult.data);
  }

  if (!data) {
    return DEFAULT_PRICING_SETTINGS;
  }

  return normalizePricingSettingsSnapshot(data);
}
