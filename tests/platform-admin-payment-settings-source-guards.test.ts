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
  assert.doesNotMatch(source, /user_metadata/);
  assert.doesNotMatch(source, /SQUARE_ENVIRONMENT/);
});

test("future payment policy reader is not connected to checkout or Square processing yet", () => {
  const paymentRuntimeFiles = [
    "src/lib/payments/payment-service.ts",
    "src/lib/payments/providers/square.ts",
    "src/lib/payments/tenant-payment-provider-connections.ts",
    "src/app/api/payments/square/checkout-config/route.ts",
    "src/app/api/webhooks/square/route.ts",
    "src/app/checkout/page.tsx",
    "src/app/checkout/checkout-page-client.tsx",
  ];

  for (const path of paymentRuntimeFiles) {
    const source = readRepoFile(path);
    assert.doesNotMatch(source, /getTenantPaymentPolicyForBusiness/);
    assert.doesNotMatch(source, /tenant_payment_settings/);
    assert.doesNotMatch(source, /tenant_payment_setting_events/);
  }
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
