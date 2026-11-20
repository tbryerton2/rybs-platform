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
const auditPage = readFileSync(
  "src/app/platform-admin/(protected)/businesses/[tenantId]/audit/page.tsx",
  "utf8",
);

test("Platform Admin business detail loads protected payment state and links to tenant audit history", () => {
  assert.match(page, /getPlatformTenantPaymentSetting\(tenant\.id, "square"\)/);
  assert.match(page, /listPlatformTenantPaymentConnections\(tenant\.id, "square"\)/);
  assert.match(page, /href=\{`\/platform-admin\/businesses\/\$\{tenant\.id\}\/audit`\}/);
  assert.match(auditPage, /await getPlatformTenantDetail\(tenantId\)/);
  assert.match(auditPage, /if \(!detail\) \{\s*notFound\(\)/);
  assert.match(auditPage, /listPlatformTenantPaymentSettingEvents\(tenant\.id, "square"\)/);
  assert.match(auditPage, /paymentEvents\.map\(\(event\) =>/);
  assert.match(auditPage, /visibleEvents\.map\(\(event\) =>/);
  assert.match(auditPage, /\{event\.detail\}/);
  assert.match(auditPage, /\{event\.actor\}/);
  assert.match(page, /<PaymentsSection/);
  assert.match(page, /Disabled/);
  assert.match(page, /Sandbox/);
  assert.match(page, /Live/);
  assert.doesNotMatch(page, /encrypted_access_token|encrypted_refresh_token/);
  assert.doesNotMatch(auditPage, /encrypted_access_token|encrypted_refresh_token/);
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
