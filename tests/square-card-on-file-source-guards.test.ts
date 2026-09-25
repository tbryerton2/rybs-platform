import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("checkout card-on-file save does not send booking service address as Square card billing address", () => {
  const route = readRepoFile("src/app/api/confirm-booking/route.ts");
  const cardOnFileSaveCall = route.match(
    /saveCustomerPaymentMethod\(\{[\s\S]*?cardSaveSourceId: checkoutPayment\.providerPaymentId,[\s\S]*?paymentMethodIdempotencyKey: `cof-card-\$\{createdBooking\.bookingId\}`,[\s\S]*?\}\);/,
  )?.[0];

  assert.ok(cardOnFileSaveCall, "confirm-booking should save card-on-file after checkout payment");
  assert.doesNotMatch(cardOnFileSaveCall, /\baddress\s*:/);
  assert.doesNotMatch(cardOnFileSaveCall, /\bpostalCode\s*:\s*customerZip/);
});
