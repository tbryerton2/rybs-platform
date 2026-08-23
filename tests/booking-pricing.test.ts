import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBookingPriceQuote,
  priceQuoteMatchesSelection,
} from "../src/lib/booking-pricing.ts";

const baseQuoteInput = {
  zip: "13032",
  dumpsterSize: "14 yard",
  dumpsterProductId: "default",
  deliveryDate: "2026-06-01",
  pickupDate: "2026-06-08",
  pickupMode: "date" as const,
  basePrice: 475,
  defaultBasePrice: 475,
  standardRentalDays: 7,
  dailyOveragePrice: 25,
  maxRentalDays: 14,
  allowExtendedRentalAtBooking: true,
  pricingSource: "global_default" as const,
};

test("quote matching rejects a stale quote when dumpster product changes", () => {
  const quote = buildBookingPriceQuote(baseQuoteInput);

  assert.equal(
    priceQuoteMatchesSelection(quote, {
      zip: "13032",
      dumpsterSize: "20 yard",
      dumpsterProductId: "20-yard",
      deliveryDate: "2026-06-01",
      pickupDate: "2026-06-08",
      pickupMode: "date",
    }),
    false,
  );
});

test("quote matching rejects a stale quote when dumpster size changes", () => {
  const quote = buildBookingPriceQuote(baseQuoteInput);

  assert.equal(
    priceQuoteMatchesSelection(quote, {
      zip: "13032",
      dumpsterSize: "20 yard",
      dumpsterProductId: "default",
      deliveryDate: "2026-06-01",
      pickupDate: "2026-06-08",
      pickupMode: "date",
    }),
    false,
  );
});

test("quote matching remains backward compatible when product identity is omitted", () => {
  const quote = buildBookingPriceQuote(baseQuoteInput);

  assert.equal(
    priceQuoteMatchesSelection(quote, {
      zip: "13032",
      deliveryDate: "2026-06-01",
      pickupDate: "2026-06-08",
      pickupMode: "date",
    }),
    true,
  );
});

test("product-specific included days and extra-day pricing are reflected in the quote", () => {
  const quote = buildBookingPriceQuote({
    ...baseQuoteInput,
    dumpsterSize: "20 yard",
    dumpsterProductId: "tenant-20-yard",
    pickupDate: "2026-06-12",
    standardRentalDays: 10,
    dailyOveragePrice: 35,
  });

  assert.equal(quote.includedRentalDays, 10);
  assert.equal(quote.dailyOveragePrice, 35);
  assert.equal(quote.extraDays, 1);
  assert.equal(quote.extraDaysChargeCents, 3500);
  assert.equal(quote.rentalDurationDays, 11);
});

test("product-aware matching refreshes older quotes without product identity", () => {
  const { dumpsterSize, dumpsterProductId, ...olderQuote } = buildBookingPriceQuote(baseQuoteInput);
  assert.equal(dumpsterSize, "14 yard");
  assert.equal(dumpsterProductId, "default");

  assert.equal(
    priceQuoteMatchesSelection(olderQuote, {
      zip: "13032",
      dumpsterSize: "14 yard",
      dumpsterProductId: "default",
      deliveryDate: "2026-06-01",
      pickupDate: "2026-06-08",
      pickupMode: "date",
    }),
    false,
  );
});
