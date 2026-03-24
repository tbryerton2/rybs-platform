export const NY_SALES_TAX_RATE = 0.08;

export type PricingSource = "zip_override" | "global_default";
export type QuotePickupMode = "unspecified" | "date";

export type BookingPriceQuote = {
  zip: string;
  deliveryDate: string | null;
  pickupDate: string | null;
  effectivePickupDate: string | null;
  pickupMode: QuotePickupMode;
  rentalPrice: number;
  rentalPriceCents: number;
  defaultRentalPrice: number;
  overrideRentalPrice: number | null;
  pricingSource: PricingSource;
  includedRentalDays: number;
  dailyOveragePrice: number;
  rentalDurationDays: number | null;
  extraDays: number;
  extraDaysChargeCents: number;
  subtotalCents: number;
  taxableSubtotalCents: number;
  salesTaxRate: number;
  salesTaxCents: number;
  totalCents: number;
};

function isYmd(value: string | null | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").trim());
}

export function addDaysYmd(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getRentalDurationDays(deliveryDate?: string | null, pickupDate?: string | null) {
  if (!isYmd(deliveryDate) || !isYmd(pickupDate)) return null;

  const safeDeliveryDate = String(deliveryDate);
  const safePickupDate = String(pickupDate);
  const [deliveryYear, deliveryMonth, deliveryDay] = safeDeliveryDate.split("-").map(Number);
  const [pickupYear, pickupMonth, pickupDay] = safePickupDate.split("-").map(Number);
  const delivery = Date.UTC(deliveryYear, deliveryMonth - 1, deliveryDay, 12);
  const pickup = Date.UTC(pickupYear, pickupMonth - 1, pickupDay, 12);
  const diffDays = Math.round((pickup - delivery) / 86400000);

  return diffDays >= 0 ? diffDays : null;
}

export function priceQuoteMatchesSelection(
  quote: BookingPriceQuote | null | undefined,
  selection: {
    zip?: string | null;
    deliveryDate?: string | null;
    pickupDate?: string | null;
    pickupMode?: QuotePickupMode | null;
  },
) {
  if (!quote) return false;

  const zip = String(selection.zip ?? "").trim();
  const deliveryDate = isYmd(selection.deliveryDate) ? String(selection.deliveryDate) : null;
  const pickupMode = selection.pickupMode === "date" ? "date" : "unspecified";
  const pickupDate =
    pickupMode === "date" && isYmd(selection.pickupDate) ? String(selection.pickupDate) : null;

  return (
    quote.zip === zip &&
    quote.deliveryDate === deliveryDate &&
    quote.pickupMode === pickupMode &&
    quote.pickupDate === pickupDate
  );
}

export function buildBookingPriceQuote(input: {
  zip: string;
  deliveryDate?: string | null;
  pickupDate?: string | null;
  pickupMode?: QuotePickupMode | null;
  rentalPrice: number;
  defaultRentalPrice: number;
  includedRentalDays: number;
  dailyOveragePrice: number;
  overrideRentalPrice?: number | null;
  pricingSource: PricingSource;
  salesTaxRate?: number;
}): BookingPriceQuote {
  const rentalPrice = Math.round(input.rentalPrice);
  const includedRentalDays = Math.max(1, Math.round(input.includedRentalDays));
  const dailyOveragePrice = Math.round(input.dailyOveragePrice);
  const deliveryDate = isYmd(input.deliveryDate) ? String(input.deliveryDate) : null;
  const pickupMode = input.pickupMode === "date" ? "date" : "unspecified";
  const pickupDate =
    pickupMode === "date" && isYmd(input.pickupDate) ? String(input.pickupDate) : null;
  const effectivePickupDate =
    pickupDate ?? (deliveryDate ? addDaysYmd(deliveryDate, includedRentalDays) : null);
  const rentalDurationDays = getRentalDurationDays(deliveryDate, effectivePickupDate);
  const extraDays =
    pickupMode === "date" && rentalDurationDays != null
      ? Math.max(0, rentalDurationDays - includedRentalDays)
      : 0;
  const extraDaysChargeCents = extraDays * dailyOveragePrice * 100;
  const salesTaxRate = input.salesTaxRate ?? NY_SALES_TAX_RATE;
  const rentalPriceCents = rentalPrice * 100;
  const subtotalCents = rentalPriceCents + extraDaysChargeCents;
  const taxableSubtotalCents = subtotalCents;
  const salesTaxCents = Math.round(taxableSubtotalCents * salesTaxRate);

  return {
    zip: input.zip,
    deliveryDate,
    pickupDate,
    effectivePickupDate,
    pickupMode,
    rentalPrice,
    rentalPriceCents,
    defaultRentalPrice: Math.round(input.defaultRentalPrice),
    overrideRentalPrice:
      typeof input.overrideRentalPrice === "number" && Number.isFinite(input.overrideRentalPrice)
        ? Math.round(input.overrideRentalPrice)
        : null,
    pricingSource: input.pricingSource,
    includedRentalDays,
    dailyOveragePrice,
    rentalDurationDays,
    extraDays,
    extraDaysChargeCents,
    subtotalCents,
    taxableSubtotalCents,
    salesTaxRate,
    salesTaxCents,
    totalCents: subtotalCents + salesTaxCents,
  };
}
