import { buildBookingPriceQuote } from "@/lib/booking-pricing";
import {
  formatDumpsterSizeFromCapacity,
  getDumpsterSizeCapacity,
  resolveSelectedDumpster,
} from "@/lib/booking-product";
import { getDumpsterRentalPolicy } from "@/lib/dumpster-rental-policy";
import { getPricingSettingsSnapshot } from "@/lib/pricing-settings";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTenant } from "@/lib/tenant/server";

export function sanitizeZip(input?: string) {
  return (input || "").toString().replace(/\D/g, "").slice(0, 5);
}

export async function getDumpsterPriceForZip(
  inputZip?: string,
  selectedDumpsterInput?: {
    dumpsterSize?: string | null;
    dumpsterProductId?: string | null;
  },
  bookingInput?: {
    deliveryDate?: string | null;
    pickupDate?: string | null;
    pickupMode?: "unspecified" | "date" | null;
    businessId?: string | null;
  },
) {
  const businessId = bookingInput?.businessId ?? (await getCurrentTenant()).id;
  const zip = sanitizeZip(inputZip);
  const zipValid = zip.length === 5;
  const selectedDumpster = resolveSelectedDumpster(selectedDumpsterInput);
  const [pricingSettings, rentalPolicy] = await Promise.all([
    getPricingSettingsSnapshot(businessId),
    getDumpsterRentalPolicy({ ...selectedDumpster, businessId }),
  ]);
  const defaultPrice = rentalPolicy.basePrice;
  const buildQuote = (price: number, overridePrice: number | null, pricingSource: "zip_override" | "global_default") =>
    buildBookingPriceQuote({
      zip,
      dumpsterSize: selectedDumpster.dumpsterSize,
      dumpsterProductId: selectedDumpster.dumpsterProductId,
      deliveryDate: bookingInput?.deliveryDate,
      pickupDate: bookingInput?.pickupDate,
      pickupMode: bookingInput?.pickupMode,
      basePrice: price,
      defaultBasePrice: defaultPrice,
      standardRentalDays: rentalPolicy.standardRentalDays,
      dailyOveragePrice: rentalPolicy.dailyOveragePrice,
      maxRentalDays: rentalPolicy.maxRentalDays,
      allowExtendedRentalAtBooking: rentalPolicy.allowExtendedRentalAtBooking,
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
    .select(`
      active,
      price_14_yard_override,
      service_area_zip_pricing_overrides (
        dumpster_size,
        price_override
      )
    `)
    .eq("zip", zip)
    .eq("business_id", businessId)
    .eq("service_area_zip_pricing_overrides.business_id", businessId)
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

  const overrideRows = Array.isArray(data.service_area_zip_pricing_overrides)
    ? data.service_area_zip_pricing_overrides
    : [];
  const sizeOverride = overrideRows.find(
    (row) =>
      getDumpsterSizeCapacity(row.dumpster_size) ===
      getDumpsterSizeCapacity(selectedDumpster.dumpsterSize),
  );
  const overrideRaw =
    sizeOverride?.price_override ?? (selectedDumpster.dumpsterSize.trim().toLowerCase() === "14 yard"
      ? data.price_14_yard_override
      : null);
  const overridePrice = overrideRaw === null || overrideRaw === undefined ? null : Number(overrideRaw);
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

export async function get14YardPriceForZip(
  inputZip?: string,
  bookingInput?: {
    deliveryDate?: string | null;
    pickupDate?: string | null;
    pickupMode?: "unspecified" | "date" | null;
    businessId?: string | null;
  },
) {
  return getDumpsterPriceForZip(
    inputZip,
    { dumpsterSize: "14 yard", dumpsterProductId: "default" },
    bookingInput,
  );
}

export async function getZipPricingOverridesBySize(inputZip?: string, businessId?: string) {
  const resolvedBusinessId = businessId ?? (await getCurrentTenant()).id;
  const zip = sanitizeZip(inputZip);
  const zipValid = zip.length === 5;
  const pricingSettings = await getPricingSettingsSnapshot(resolvedBusinessId);
  const defaultPrice = pricingSettings.basePrice;

  if (!zipValid) {
    return {
      zip,
      zipValid,
      defaultPrice,
      serviceable: null as boolean | null,
      overridesBySize: new Map<string, number>(),
    };
  }

  const { data, error } = await supabaseAdmin
    .from("service_area_zips")
    .select(`
      active,
      price_14_yard_override,
      service_area_zip_pricing_overrides (
        dumpster_size,
        price_override
      )
    `)
    .eq("zip", zip)
    .eq("business_id", resolvedBusinessId)
    .eq("service_area_zip_pricing_overrides.business_id", resolvedBusinessId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.active === false) {
    return {
      zip,
      zipValid,
      defaultPrice,
      serviceable: false,
      overridesBySize: new Map<string, number>(),
    };
  }

  const overridesBySize = new Map<string, number>();
  const rows = Array.isArray(data.service_area_zip_pricing_overrides)
    ? data.service_area_zip_pricing_overrides
    : [];

  for (const row of rows) {
    const dumpsterSize = formatDumpsterSizeFromCapacity(row.dumpster_size);
    const price = Number(row.price_override);
    if (!dumpsterSize || !Number.isFinite(price) || price <= 0) continue;
    overridesBySize.set(dumpsterSize, Math.round(price));
  }

  const legacyFourteenYard = Number(data.price_14_yard_override);
  if (
    !overridesBySize.has("14 yard") &&
    Number.isFinite(legacyFourteenYard) &&
    legacyFourteenYard > 0
  ) {
    overridesBySize.set("14 yard", Math.round(legacyFourteenYard));
  }

  return {
    zip,
    zipValid,
    defaultPrice,
    serviceable: true,
    overridesBySize,
  };
}
