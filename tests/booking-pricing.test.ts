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
