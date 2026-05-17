import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBookingOriginBackHref,
  buildPricingBackHref,
  normalizeBookingOrigin,
} from "../src/lib/booking-origin.ts";

test("pricing origin returns to pricing with only the zip context", () => {
  const href = buildBookingOriginBackHref({
    origin: "pricing",
    zip: "13032",
    dumpsterSize: "20 yard",
    dumpsterProductId: "20-yard",
  });

  assert.equal(href, "/pricing?zip=13032");
});

test("direct book origin returns to editable dumpster selection", () => {
  const href = buildBookingOriginBackHref({
    origin: "book",
    zip: "13032",
    dumpsterSize: "20 yard",
    dumpsterProductId: "20-yard",
  });

  assert.equal(href, "/book?zip=13032&editing=dumpster&dumpsterSize=20+yard&dumpsterProductId=20-yard&origin=book");
});

test("unknown origin falls back to book flow", () => {
  assert.equal(normalizeBookingOrigin("something-else"), "book");
});

test("pricing back href only keeps the zip when rebuilding the public pricing page", () => {
  const href = buildPricingBackHref({
    zip: "13032",
  });

  assert.equal(href, "/pricing?zip=13032");
});
