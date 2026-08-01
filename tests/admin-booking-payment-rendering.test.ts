import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bookingDetailPageSource = readFileSync(
  "src/app/admin/(protected)/bookings/[id]/page.tsx",
  "utf8",
);

test("booking detail page render does not perform live Square card verification", () => {
  assert.equal(bookingDetailPageSource.includes("cards.get"), false);
  assert.equal(bookingDetailPageSource.includes("verifySavedPaymentMethod"), false);
  assert.equal(bookingDetailPageSource.includes("getPaymentProviderAdapter"), false);
});
