import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBookingOriginBackHref,
  buildPricingBackHref,
  normalizeBookingOrigin,
} from "../src/lib/booking-origin.ts";

test("pricing origin returns to pricing with zip and selected product context", () => {
  const href = buildBookingOriginBackHref({
    origin: "pricing",
    zip: "13032",
    dumpsterSize: "20 yard",
    dumpsterProductId: "20-yard",
  });

  assert.equal(href, "/pricing?zip=13032&dumpsterSize=20+yard&dumpsterProductId=20-yard");
});

test("direct book origin keeps generic back behavior", () => {
  const href = buildBookingOriginBackHref({
    origin: "book",
    zip: "13032",
    dumpsterSize: "20 yard",
    dumpsterProductId: "20-yard",
  });

  assert.equal(href, "/book");
});

test("unknown origin falls back to book flow", () => {
  assert.equal(normalizeBookingOrigin("something-else"), "book");
});

test("pricing back href survives refresh-style reconstruction from saved context", () => {
  const href = buildPricingBackHref({
    zip: "13032",
    dumpsterSize: "20 yard",
    dumpsterProductId: "20-yard",
  });

  assert.equal(href, "/pricing?zip=13032&dumpsterSize=20+yard&dumpsterProductId=20-yard");
});
