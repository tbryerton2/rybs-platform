import { buildBookingPriceQuote } from "@/lib/booking-pricing";
import { getPricingSettingsSnapshot } from "@/lib/pricing-settings";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export function sanitizeZip(input?: string) {
  return (input || "").toString().replace(/\D/g, "").slice(0, 5);
}

export async function get14YardPriceForZip(
  inputZip?: string,
  bookingInput?: {
    deliveryDate?: string | null;
    pickupDate?: string | null;
    pickupMode?: "unspecified" | "date" | null;
  },
) {
  const zip = sanitizeZip(inputZip);
  const zipValid = zip.length === 5;
  const pricingSettings = await getPricingSettingsSnapshot();
  const defaultPrice = pricingSettings.basePrice;
  const buildQuote = (price: number, overridePrice: number | null, pricingSource: "zip_override" | "global_default") =>
    buildBookingPriceQuote({
      zip,
      deliveryDate: bookingInput?.deliveryDate,
      pickupDate: bookingInput?.pickupDate,
      pickupMode: bookingInput?.pickupMode,
      basePrice: price,
      defaultBasePrice: defaultPrice,
      standardRentalDays: pricingSettings.standardRentalDays,
      dailyOveragePrice: pricingSettings.dailyOveragePrice,
      maxRentalDays: pricingSettings.maxRentalDays,
      allowExtendedRentalAtBooking: pricingSettings.allowExtendedRentalAtBooking,
      overrideBasePrice: overridePrice,
      pricingSource,
    });

  if (!zipValid) {
    return {
      zip,
      zipValid,
      price: defaultPrice,
      defaultPrice,
      overridePrice: null as number | null,
      pricingSource: "global_default" as const,
      priceQuote: buildQuote(defaultPrice, null, "global_default"),
      rentalValidationError: null as string | null,
      pricingSettings,
      serviceable: null as boolean | null,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("service_area_zips")
    .select("active, price_14_yard_override")
    .eq("zip", zip)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.active === false) {
    return {
      zip,
      zipValid,
      price: defaultPrice,
      defaultPrice,
      overridePrice: null,
      pricingSource: "global_default" as const,
      priceQuote: buildQuote(defaultPrice, null, "global_default"),
      rentalValidationError: null,
      pricingSettings,
      serviceable: false,
    };
  }

  const overrideRaw = data.price_14_yard_override;
  const overridePrice =
    overrideRaw === null || overrideRaw === undefined ? null : Number(overrideRaw);
  const hasOverride = Number.isFinite(overridePrice) && overridePrice! > 0;
  const price = hasOverride ? Math.round(overridePrice!) : defaultPrice;
  const pricingSource = hasOverride ? "zip_override" : "global_default";
  const priceQuote = buildQuote(price, hasOverride ? Math.round(overridePrice!) : null, pricingSource);

  return {
    zip,
    zipValid,
    price,
    defaultPrice,
    overridePrice: hasOverride ? Math.round(overridePrice!) : null,
    pricingSource,
    priceQuote,
    rentalValidationError: priceQuote.validationError,
    pricingSettings,
    serviceable: true,
  };
}
