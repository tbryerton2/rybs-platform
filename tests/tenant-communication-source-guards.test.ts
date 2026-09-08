import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("booking emails use tenant branding and tenant-scoped notification recipients", () => {
  const source = readRepoFile("src/lib/email/booking-emails.ts");

  assert.match(source, /tenant: TenantRecord/);
  assert.match(source, /getTenantCommunicationSettings\(input\.tenant, input\.requestContext\)/);
  assert.match(source, /businessName: communication\.businessName/);
  assert.match(source, /to: communication\.bookingNotificationRecipients/);
  assert.doesNotMatch(source, /process\.env\.ADMIN_BOOKING_EMAIL/);
});

test("tenant communication settings do not use global admin email outside the current Tan tenant", () => {
  const source = readRepoFile("src/lib/tenant/communications.ts");

  assert.match(source, /settings\.get\("notifications\.bookingEmails"\)/);
  assert.match(source, /settings\.get\("support\.email"\)/);
  assert.match(source, /tenant\.slug === DEFAULT_LOCAL_TENANT_SLUG/);
  assert.match(source, /normalizeEmailList\(process\.env\.ADMIN_BOOKING_EMAIL\)/);
});

test("portal login sends tenant-branded app email with a tenant-aware Supabase auth link", () => {
  const source = readRepoFile("src/app/portal/login/actions.ts");

  assert.match(source, /getCurrentTenant\(\)/);
  assert.match(source, /getTenantCommunicationSettings\(tenant, requestContext\)/);
  assert.match(source, /emailRedirectTo: `\$\{baseUrl\}\/portal\/auth\/callback`/);
  assert.match(source, /supabaseAdmin\.auth\.admin\.generateLink/);
  assert.match(source, /buildPortalLoginEmail/);
  assert.match(source, /sendEmail\(/);
  assert.doesNotMatch(source, /signInWithOtp/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_SITE_URL/);
});

test("portal login page does not hardcode Tan Can Man portal copy", () => {
  const source = readRepoFile("src/app/portal/login/page.tsx");

  assert.match(source, /getBrandSettings\(\)/);
  assert.match(source, /open your \{brand\.name\} portal/);
  assert.doesNotMatch(source, /Tan Can Man portal/);
});

test("portal rental request notifications are tenant-routed", () => {
  const source = readRepoFile("src/app/portal/rentals/[id]/actions.ts");

  assert.match(source, /getTenantCommunicationSettings\(tenant,/);
  assert.match(source, /to: communication\.bookingNotificationRecipients/);
  assert.match(source, /businessName: communication\.businessName/);
  assert.match(source, /communication\.publicBaseUrl/);
  assert.doesNotMatch(source, /process\.env\.ADMIN_BOOKING_EMAIL/);
  assert.doesNotMatch(source, /process\.env\.NEXT_PUBLIC_SITE_URL/);
});

test("portal issue report template is not hardcoded to Tan Can Man", () => {
  const source = readRepoFile("src/lib/email/templates/admin-issue-report.ts");

  assert.match(source, /businessName: string/);
  assert.match(source, /from the \$\{businessName\} portal/);
  assert.doesNotMatch(source, /Tan Can Man/);
});
