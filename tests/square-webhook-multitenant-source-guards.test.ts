import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("Square webhook route resolves tenant connections by Square merchant id", () => {
  const route = readRepoFile("src/app/api/webhooks/square/route.ts");

  assert.match(route, /merchant_id\?: string/);
  assert.match(route, /const providerMerchantId = event\.merchant_id\?\.trim\(\) \|\| null/);
  assert.match(route, /findTenantPaymentProviderConnectionByMerchant/);
  assert.match(route, /providerMerchantId/);
});

test("Square webhook route scopes payment matching by connection when present", () => {
  const route = readRepoFile("src/app/api/webhooks/square/route.ts");

  assert.match(route, /\.select\("id, business_id, booking_id, booking_charge_id, status"\)/);
  assert.match(route, /if \(input\.connection\) \{\s+query = query\.eq\("payment_provider_connection_id", input\.connection\.id\);/);
  assert.match(route, /payment_provider_connection_id = input\.connection\.id/);
  assert.match(route, /provider_merchant_id = input\.providerMerchantId/);
  assert.match(route, /paymentProviderConnectionId: input\.connection\?\.id \?\? null/);
});

test("Square webhook route reconciles saved-card post-rental charge payments to booking charges", () => {
  const route = readRepoFile("src/app/api/webhooks/square/route.ts");

  assert.match(route, /if \(existing\.data\.booking_charge_id\) \{/);
  assert.match(route, /\.from\("booking_charges"\)\s+\.update\(chargeUpdate\)/);
  assert.match(route, /\.eq\("id", existing\.data\.booking_charge_id\)/);
  assert.match(route, /\.eq\("business_id", existing\.data\.business_id\)/);
  assert.match(route, /toBookingChargeStatus\(status\)/);
  assert.match(route, /provider_payment_id: providerPaymentId/);
  assert.match(route, /payment_provider_connection_id = input\.connection\.id/);
});

test("Square webhook route records merchant and location details even when connection is unresolved", () => {
  const route = readRepoFile("src/app/api/webhooks/square/route.ts");

  assert.match(route, /if \(input\.providerMerchantId\) \{\s+insertValues\.provider_merchant_id = input\.providerMerchantId;/);
  assert.match(route, /if \(input\.providerLocationId\) \{\s+insertValues\.provider_location_id = input\.providerLocationId;/);
});

test("Square webhook route keeps legacy matching only when no merchant connection is resolved", () => {
  const route = readRepoFile("src/app/api/webhooks/square/route.ts");

  assert.match(route, /\.eq\("provider", "square"\)/);
  assert.match(route, /\.eq\("provider_environment", getConfiguredSquareEnvironment\(\)\)/);
  assert.match(route, /\.eq\("provider_payment_id", providerPaymentId\)/);
  assert.doesNotMatch(route, /SQUARE_ACCESS_TOKEN/);
});
