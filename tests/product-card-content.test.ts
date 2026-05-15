import test from "node:test";
import assert from "node:assert/strict";

import { parseCustomerBulletPoints } from "../src/lib/product-card-content.ts";

test("customer-facing bullet points are parsed one non-empty line at a time", () => {
  assert.deepEqual(
    parseCustomerBulletPoints("Fits small remodels\n\nConcrete accepted by approval  \r\n  Call for placement help"),
    ["Fits small remodels", "Concrete accepted by approval", "Call for placement help"],
  );
});

test("empty customer-facing bullet points render no bullets", () => {
  assert.deepEqual(parseCustomerBulletPoints(""), []);
  assert.deepEqual(parseCustomerBulletPoints(null), []);
});

test("hardcoded legacy bullets only appear when entered by the business user", () => {
  assert.deepEqual(
    parseCustomerBulletPoints("Driveway friendly\nFlexible rental period"),
    ["Driveway friendly", "Flexible rental period"],
  );
});

test("short description is not parsed as a bullet source", () => {
  assert.deepEqual(parseCustomerBulletPoints(""), []);
});
