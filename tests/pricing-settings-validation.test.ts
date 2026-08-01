import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMaxRentalDaysIncludedPeriodMessage,
  getHighestActiveIncludedRentalDays,
  getMaxRentalDaysIncludedPeriodError,
  getPricingSettingsSaveErrorMessage,
} from "../src/lib/admin/pricing-settings-validation.ts";

test("client-side max rental validation uses the highest active included rental period", () => {
  const highestIncludedRentalDays = getHighestActiveIncludedRentalDays([
    { includedRentalDays: 7, isActiveSize: true },
    { includedRentalDays: 12, isActiveSize: true },
    { includedRentalDays: 21, isActiveSize: false },
    { includedRentalDays: null, isActiveSize: true },
  ]);

  assert.equal(highestIncludedRentalDays, 12);
  assert.equal(
    getMaxRentalDaysIncludedPeriodError(10, highestIncludedRentalDays),
    "Max rental length must be at least 12 days because one or more dumpsters include an 12-day rental period.",
  );
  assert.equal(getMaxRentalDaysIncludedPeriodError(12, highestIncludedRentalDays), null);
  assert.equal(getMaxRentalDaysIncludedPeriodError(null, highestIncludedRentalDays), null);
});

test("pricing settings database constraint errors are translated to the friendly max rental message", () => {
  const rawError = {
    message:
      'new row for relation "pricing_settings" violates check constraint "pricing_settings_max_rental_days_valid"',
  };

  assert.equal(
    getPricingSettingsSaveErrorMessage(rawError, 14),
    buildMaxRentalDaysIncludedPeriodMessage(14),
  );
});

test("other pricing settings database errors do not expose raw database text", () => {
  const rawError = {
    message: 'duplicate key value violates unique constraint "pricing_settings_business_id_key"',
  };

  assert.equal(
    getPricingSettingsSaveErrorMessage(rawError, 14),
    "We couldn't save pricing settings. Please review the fields and try again.",
  );
});
