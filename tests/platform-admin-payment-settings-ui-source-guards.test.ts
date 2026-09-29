import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(
  "src/app/platform-admin/(protected)/businesses/[tenantId]/page.tsx",
  "utf8",
);
const actions = readFileSync(
  "src/app/platform-admin/(protected)/businesses/actions.ts",
  "utf8",
);

test("Platform Admin business detail loads protected payment state and audit history", () => {
  assert.match(page, /getPlatformTenantPaymentSetting\(tenant\.id, "square"\)/);
  assert.match(page, /listPlatformTenantPaymentConnections\(tenant\.id, "square"\)/);
  assert.match(page, /listPlatformTenantPaymentSettingEvents\(tenant\.id, "square"\)/);
  assert.match(page, /<PaymentsSection/);
  assert.match(page, /Disabled/);
  assert.match(page, /Sandbox/);
  assert.match(page, /Live/);
  assert.doesNotMatch(page, /encrypted_access_token|encrypted_refresh_token/);
});

test("Platform Admin payment mutation is exact-tenant scoped and keeps Live guarded", () => {
  assert.match(actions, /export async function updatePaymentModeAction/);
  assert.match(actions, /businessId: tenantId/);
  assert.match(actions, /provider: "square"/);
  assert.match(actions, /mode: formString\(formData, "paymentMode"\)/);
  assert.match(actions, /liveConfirmation: formString\(formData, "liveConfirmation"\)/);
  assert.match(actions, /PlatformTenantPaymentSettingError/);
  assert.match(actions, /#payments/);
});
