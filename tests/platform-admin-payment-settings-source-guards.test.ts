import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("platform-admin payment settings service is server-only and protects mutations with platform auth", () => {
  const source = readRepoFile("src/lib/platform-admin/payment-settings.ts");

  assert.match(source, /import "server-only";/);
  assert.match(source, /await import\("@\/lib\/platform-admin\/auth"\)/);
  assert.match(source, /export async function updatePlatformTenantPaymentMode/);
  assert.match(source, /const session = await requireSession\(options\);/);
  assert.match(source, /platform_admin_set_tenant_payment_mode/);
  assert.match(source, /p_actor_auth_user_id: session\.user\.id/);
  assert.match(source, /export async function listPlatformTenantPaymentConnections/);
  assert.match(source, /connection\.provider_environment === "production"/);
  assert.match(source, /connection\.status === "active"/);
  assert.match(source, /Boolean\(connection\.provider_location_id\)/);
  assert.doesNotMatch(source, /CONNECTION_SUMMARY_SELECT[\s\S]*encrypted_access_token/);
  assert.doesNotMatch(source, /user_metadata/);
  assert.doesNotMatch(source, /SQUARE_ENVIRONMENT/);
});

test("tenant payment runtime resolves protected policy before Square execution", () => {
  const resolver = readRepoFile("src/lib/payments/tenant-payment-provider-connections.ts");
  const squareProvider = readRepoFile("src/lib/payments/providers/square.ts");

  assert.match(resolver, /getTenantPaymentPolicyForBusiness/);
  assert.match(resolver, /policy\.mode === "disabled"/);
  assert.match(resolver, /TENANT_PAYMENT_POLICY_DISABLED/);
  assert.match(resolver, /TENANT_PAYMENT_POLICY_ENVIRONMENT_MISMATCH/);
  assert.match(resolver, /\.eq\("business_id", input\.businessId\)/);
  assert.match(resolver, /\.eq\("provider_environment", input\.providerEnvironment\)/);
  assert.doesNotMatch(resolver, /legacy_tan_can_man_fallback/);
  assert.doesNotMatch(squareProvider, /process\.env\.SQUARE_ACCESS_TOKEN/);
  assert.doesNotMatch(squareProvider, /process\.env\.SQUARE_LOCATION_ID/);
  assert.doesNotMatch(squareProvider, /process\.env\.SQUARE_ENVIRONMENT/);
});

test("business-admin payment settings code does not call the protected platform mutation", () => {
  const businessAdminFiles = [
    "src/app/admin/(protected)/settings/payments/page.tsx",
    "src/app/admin/(protected)/settings/payments/actions.ts",
  ];

  for (const path of businessAdminFiles) {
    const source = readRepoFile(path);
    assert.doesNotMatch(source, /updatePlatformTenantPaymentMode/);
    assert.doesNotMatch(source, /platform_admin_set_tenant_payment_mode/);
  }
});
