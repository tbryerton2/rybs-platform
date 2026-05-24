import { getMinPickupLeadDays } from "./config.ts";

export const NY_SALES_TAX_RATE = 0.08;

export type PricingSource = "zip_override" | "global_default";
export type QuotePickupMode = "unspecified" | "date";

export type RentalPeriodPolicy = {
  standardRentalDays: number;
  dailyOveragePrice: number;
  maxRentalDays?: number | null;
  allowExtendedRentalAtBooking?: boolean | null;
  minPickupLeadDays?: number | null;
};

export type RentalPeriodSelection = {
  deliveryDate?: string | null;
  pickupDate?: string | null;
  pickupMode?: QuotePickupMode | null;
};

export type RentalPeriodDetails = {
  deliveryDate: string | null;
  pickupDate: string | null;
  pickupMode: QuotePickupMode;
  standardRentalDays: number;
  maxRentalDays: number | null;
  allowExtendedRentalAtBooking: boolean;
  minPickupLeadDays: number;
  minimumPickupDate: string | null;
  standardPickupDate: string | null;
  effectivePickupDate: string | null;
  rentalDurationDays: number | null;
  bookedRentalDays: number | null;
  overageDays: number;
  validationError: string | null;
};

export type BookingPriceQuote = RentalPeriodDetails & {
  zip: string;
  dumpsterSize?: string | null;
  dumpsterProductId?: string | null;
  basePrice: number;
  basePriceCents: number;
  rentalPrice: number;
  rentalPriceCents: number;
  defaultBasePrice: number;
  defaultRentalPrice: number;
  overrideBasePrice: number | null;
  overrideRentalPrice: number | null;
  pricingSource: PricingSource;
  dailyOveragePrice: number;
  dailyOveragePriceCents: number;
  overageChargeCents: number;
  extraDaysChargeCents: number;
  subtotalCents: number;
  taxableSubtotalCents: number;
  salesTaxRate: number;
  salesTaxCents: number;
  totalCents: number;
  includedRentalDays: number;
  extraDays: number;
};

export function isYmd(value: string | null | undefined): value is string {
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

function normalizePolicy(policy: RentalPeriodPolicy) {
  const standardRentalDays = Math.max(1, Math.round(policy.standardRentalDays));
  const dailyOveragePrice = Math.max(0, Math.round(policy.dailyOveragePrice));
  const maxRentalDaysRaw =
    policy.maxRentalDays === null || policy.maxRentalDays === undefined
      ? null
      : Math.round(policy.maxRentalDays);
  const maxRentalDays =
    maxRentalDaysRaw !== null && maxRentalDaysRaw >= standardRentalDays ? maxRentalDaysRaw : null;

  return {
    standardRentalDays,
    dailyOveragePrice,
    maxRentalDays,
    allowExtendedRentalAtBooking: Boolean(policy.allowExtendedRentalAtBooking),
    minPickupLeadDays: Math.max(
      0,
      Math.round(policy.minPickupLeadDays ?? getMinPickupLeadDays()),
    ),
  };
}

export function getRentalPeriodDetails(
  selection: RentalPeriodSelection & RentalPeriodPolicy,
): RentalPeriodDetails {
  const normalized = normalizePolicy(selection);
  const deliveryDate = isYmd(selection.deliveryDate) ? String(selection.deliveryDate) : null;
  const pickupMode = selection.pickupMode === "date" ? "date" : "unspecified";
  const pickupDate =
    pickupMode === "date" && isYmd(selection.pickupDate) ? String(selection.pickupDate) : null;
  const minimumPickupDate =
    deliveryDate && normalized.minPickupLeadDays > 0
      ? addDaysYmd(deliveryDate, normalized.minPickupLeadDays)
      : deliveryDate;
  const standardPickupDate = deliveryDate
    ? addDaysYmd(deliveryDate, normalized.standardRentalDays)
    : null;
  const effectivePickupDate = pickupDate ?? standardPickupDate;
  const rentalDurationDays = getRentalDurationDays(deliveryDate, effectivePickupDate);
  const bookedRentalDays = rentalDurationDays;
  const overageDays =
    bookedRentalDays != null ? Math.max(0, bookedRentalDays - normalized.standardRentalDays) : 0;

  let validationError: string | null = null;

  if (pickupMode === "date") {
    if (!pickupDate) {
      validationError = "Please choose a valid removal date.";
    } else if (minimumPickupDate && pickupDate < minimumPickupDate) {
      validationError =
        normalized.minPickupLeadDays > 0
          ? `Removal date must be on or after ${minimumPickupDate}.`
          : "Removal date cannot be before delivery.";
    } else if (bookedRentalDays === null) {
      validationError = "Removal date must be on or after delivery.";
    } else if (
      !normalized.allowExtendedRentalAtBooking &&
      bookedRentalDays > normalized.standardRentalDays
    ) {
      validationError = `Online booking includes up to ${normalized.standardRentalDays} days.`;
    } else if (
      normalized.maxRentalDays !== null &&
      bookedRentalDays > normalized.maxRentalDays
    ) {
      validationError = `Maximum rental length is ${normalized.maxRentalDays} days.`;
    }
  }

  return {
    deliveryDate,
    pickupDate,
    pickupMode,
    standardRentalDays: normalized.standardRentalDays,
    maxRentalDays: normalized.maxRentalDays,
    allowExtendedRentalAtBooking: normalized.allowExtendedRentalAtBooking,
    minPickupLeadDays: normalized.minPickupLeadDays,
    minimumPickupDate,
    standardPickupDate,
    effectivePickupDate,
    rentalDurationDays,
    bookedRentalDays,
    overageDays,
    validationError,
  };
}

export function getMaximumBookablePickupDate(
  deliveryDate: string,
  policy: RentalPeriodPolicy,
  operationalMaxPickupDate?: string | null,
) {
  if (!isYmd(deliveryDate)) return isYmd(operationalMaxPickupDate) ? String(operationalMaxPickupDate) : null;

  const normalized = normalizePolicy(policy);
  const pricingLimitDays = normalized.allowExtendedRentalAtBooking
    ? normalized.maxRentalDays
    : normalized.standardRentalDays;
  const pricingMaxPickupDate =
    pricingLimitDays !== null ? addDaysYmd(deliveryDate, pricingLimitDays) : null;

  if (!isYmd(operationalMaxPickupDate)) {
    return pricingMaxPickupDate;
  }

  if (!pricingMaxPickupDate) {
    return String(operationalMaxPickupDate);
  }

  const safeOperationalMaxPickupDate = String(operationalMaxPickupDate);

  return pricingMaxPickupDate < safeOperationalMaxPickupDate
    ? pricingMaxPickupDate
    : safeOperationalMaxPickupDate;
}

export function priceQuoteMatchesSelection(
  quote: BookingPriceQuote | null | undefined,
  selection: {
    zip?: string | null;
    dumpsterSize?: string | null;
    dumpsterProductId?: string | null;
    deliveryDate?: string | null;
    pickupDate?: string | null;
    pickupMode?: QuotePickupMode | null;
  },
) {
  if (!quote) return false;

  const zip = String(selection.zip ?? "").trim();
  const selectionHasDumpsterSize = Object.prototype.hasOwnProperty.call(selection, "dumpsterSize");
  const selectionHasDumpsterProductId = Object.prototype.hasOwnProperty.call(selection, "dumpsterProductId");
  const dumpsterSize = String(selection.dumpsterSize ?? "").trim();
  const quoteDumpsterSize = String(quote.dumpsterSize ?? "").trim();
  const dumpsterProductId = String(selection.dumpsterProductId ?? "").trim();
  const quoteDumpsterProductId = String(quote.dumpsterProductId ?? "").trim();
  const deliveryDate = isYmd(selection.deliveryDate) ? String(selection.deliveryDate) : null;
  const pickupMode = selection.pickupMode === "date" ? "date" : "unspecified";
  const pickupDate =
    pickupMode === "date" && isYmd(selection.pickupDate) ? String(selection.pickupDate) : null;

  if (selectionHasDumpsterSize && quoteDumpsterSize !== dumpsterSize) {
    return false;
  }

  if (selectionHasDumpsterProductId && quoteDumpsterProductId !== dumpsterProductId) {
    return false;
  }

  return (
    quote.zip === zip &&
    quote.deliveryDate === deliveryDate &&
    quote.pickupMode === pickupMode &&
    quote.pickupDate === pickupDate
  );
}

export function buildBookingPriceQuote(input: {
  zip: string;
  dumpsterSize?: string | null;
  dumpsterProductId?: string | null;
  deliveryDate?: string | null;
  pickupDate?: string | null;
  pickupMode?: QuotePickupMode | null;
  basePrice: number;
  defaultBasePrice: number;
  standardRentalDays: number;
  dailyOveragePrice: number;
  maxRentalDays?: number | null;
  allowExtendedRentalAtBooking?: boolean | null;
  overrideBasePrice?: number | null;
  pricingSource: PricingSource;
  salesTaxRate?: number;
}): BookingPriceQuote {
  const basePrice = Math.max(0, Math.round(input.basePrice));
  const details = getRentalPeriodDetails({
    deliveryDate: input.deliveryDate,
    pickupDate: input.pickupDate,
    pickupMode: input.pickupMode,
    standardRentalDays: input.standardRentalDays,
    dailyOveragePrice: input.dailyOveragePrice,
    maxRentalDays: input.maxRentalDays,
    allowExtendedRentalAtBooking: input.allowExtendedRentalAtBooking,
  });
  const dailyOveragePrice = Math.max(0, Math.round(input.dailyOveragePrice));
  const dailyOveragePriceCents = dailyOveragePrice * 100;
  const overageChargeCents = details.overageDays * dailyOveragePriceCents;
  const salesTaxRate = input.salesTaxRate ?? NY_SALES_TAX_RATE;
  const basePriceCents = basePrice * 100;
  const subtotalCents = basePriceCents + overageChargeCents;
  const taxableSubtotalCents = subtotalCents;
  const salesTaxCents = Math.round(taxableSubtotalCents * salesTaxRate);

  return {
    zip: input.zip,
    dumpsterSize: input.dumpsterSize,
    dumpsterProductId: input.dumpsterProductId,
    ...details,
    basePrice,
    basePriceCents,
    rentalPrice: basePrice,
    rentalPriceCents: basePriceCents,
    defaultBasePrice: Math.max(0, Math.round(input.defaultBasePrice)),
    defaultRentalPrice: Math.max(0, Math.round(input.defaultBasePrice)),
    overrideBasePrice:
      typeof input.overrideBasePrice === "number" && Number.isFinite(input.overrideBasePrice)
        ? Math.max(0, Math.round(input.overrideBasePrice))
        : null,
    overrideRentalPrice:
      typeof input.overrideBasePrice === "number" && Number.isFinite(input.overrideBasePrice)
        ? Math.max(0, Math.round(input.overrideBasePrice))
        : null,
    pricingSource: input.pricingSource,
    dailyOveragePrice,
    dailyOveragePriceCents,
    overageChargeCents,
    extraDaysChargeCents: overageChargeCents,
    subtotalCents,
    taxableSubtotalCents,
    salesTaxRate,
    salesTaxCents,
    totalCents: subtotalCents + salesTaxCents,
    includedRentalDays: details.standardRentalDays,
    extraDays: details.overageDays,
  };
}
