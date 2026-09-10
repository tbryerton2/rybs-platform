import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("Business Admin Square connection UI does not render token material", () => {
  const page = readRepoFile("src/app/admin/(protected)/settings/payments/page.tsx");

  assert.match(page, /requireAdminOwner/);
  assert.match(page, /getTenantSquareConnectionForAdmin/);
  assert.match(page, /listTenantSquareConnectionLocationsForAdmin/);
  assert.match(page, /startSquareOAuthAction/);
  assert.match(page, /selectSquareLocationAction/);
  assert.match(page, /revokeSquareConnectionAction/);
  assert.match(page, /Legacy fallback/);
  assert.match(page, /Demo and future tenants do not silently use Tan Can Man payment credentials/);
  assert.doesNotMatch(page, /encrypted_access_token/);
  assert.doesNotMatch(page, /encrypted_refresh_token/);
  assert.doesNotMatch(page, /accessToken/);
  assert.doesNotMatch(page, /refreshToken/);
});

test("Square OAuth callback validates admin session state before saving a tenant connection", () => {
  const route = readRepoFile("src/app/admin/(protected)/settings/payments/square/callback/route.ts");

  assert.match(route, /requireAdminOwner/);
  assert.match(route, /consumeSquareOAuthStateCookie/);
  assert.match(route, /businessId: adminSession\.businessId/);
  assert.match(route, /userId: adminSession\.userId/);
  assert.match(route, /exchangeSquareOAuthCode/);
  assert.match(route, /persistSquareOAuthConnectionForBusiness/);
  assert.doesNotMatch(route, /console\.(log|info|warn|error)/);
});

test("Square OAuth server helpers keep secrets and tokens server-only", () => {
  const helper = readRepoFile("src/lib/payments/tenant-payment-provider-connections.ts");

  assert.match(helper, /import "server-only"/);
  assert.match(helper, /SQUARE_OAUTH_APPLICATION_SECRET/);
  assert.match(helper, /PAYMENT_PROVIDER_TOKEN_ENCRYPTION_KEY/);
  assert.match(helper, /encryptPaymentProviderToken\(input\.token\.accessToken\)/);
  assert.match(helper, /encryptPaymentProviderToken\(input\.token\.refreshToken\)/);
  assert.match(helper, /revokeTenantSquareConnectionForAdmin/);
  assert.match(helper, /TENANT_PAYMENT_PROVIDER_CONNECTION_ADMIN_SELECT/);
});

test("Payments navigation is business-admin scoped", () => {
  const nav = readRepoFile("src/app/admin/_components/admin/admin-nav.ts");
  const item = readRepoFile("src/app/admin/_components/admin/admin-nav-item.tsx");

  assert.match(nav, /href: "\/admin\/settings\/payments"/);
  assert.match(nav, /icon: "payments"/);
  assert.match(item, /payments: CreditCardIcon/);
});
