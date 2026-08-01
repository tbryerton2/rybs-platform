export const MAX_RENTAL_DAYS_CONSTRAINT_NAME = "pricing_settings_max_rental_days_valid";

export type ActiveDumpsterRentalDaysProduct = {
  includedRentalDays: number | null;
  isActiveSize?: boolean;
};

export function buildMaxRentalDaysIncludedPeriodMessage(includedRentalDays: number) {
  return `Max rental length must be at least ${includedRentalDays} days because one or more dumpsters include an ${includedRentalDays}-day rental period.`;
}

export function getHighestActiveIncludedRentalDays(products: ActiveDumpsterRentalDaysProduct[]) {
  return products.reduce<number | null>((highest, product) => {
    if (product.isActiveSize === false) return highest;

    const includedRentalDays = Number(product.includedRentalDays);
    if (!Number.isInteger(includedRentalDays) || includedRentalDays < 1) return highest;

    return highest === null ? includedRentalDays : Math.max(highest, includedRentalDays);
  }, null);
}

export function getMaxRentalDaysIncludedPeriodError(
  maxRentalDays: number | null,
  highestIncludedRentalDays: number | null,
) {
  if (maxRentalDays === null || highestIncludedRentalDays === null) return null;
  if (maxRentalDays >= highestIncludedRentalDays) return null;

  return buildMaxRentalDaysIncludedPeriodMessage(highestIncludedRentalDays);
}

export function isMaxRentalDaysConstraintError(error: { message?: string | null; code?: string | null }) {
  const message = error.message ?? "";
  return message.includes(MAX_RENTAL_DAYS_CONSTRAINT_NAME);
}

export function getPricingSettingsSaveErrorMessage(
  error: { message?: string | null; code?: string | null },
  highestIncludedRentalDays: number | null,
) {
  if (isMaxRentalDaysConstraintError(error) && highestIncludedRentalDays !== null) {
    return buildMaxRentalDaysIncludedPeriodMessage(highestIncludedRentalDays);
  }

  return "We couldn't save pricing settings. Please review the fields and try again.";
}
