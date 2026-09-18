import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("business-admin forgot password sends Supabase recovery to admin update-password", () => {
  const source = readRepoFile("src/app/admin/(auth)/forgot-password/actions.ts");
  const helper = readRepoFile("src/lib/admin/password-recovery.ts");

  assert.match(source, /sendAdminPasswordRecoveryEmail\(\{/);
  assert.match(source, /NEXT_PUBLIC_SITE_URL/);
  assert.match(source, /headers\(\)/);
  assert.match(source, /x-forwarded-host/);
  assert.match(source, /x-forwarded-proto/);
  assert.match(helper, /generateLink\(\{[\s\S]*type: "recovery"/);
  assert.match(helper, /resolveTenantEmailSender/);
  assert.match(helper, /tenantSenderSendEmailOptions/);
  assert.match(helper, /\.from\("business_admin_memberships"\)/);
  assert.match(helper, /\.in\("role", \["owner", "admin"\]\)/);
  assert.match(helper, /\/admin\/update-password/);
  assert.doesNotMatch(source, /platform-admin/);
});

test("business-admin recovery redirect prefers request host before site url", () => {
  const source = readRepoFile("src/lib/admin/password-recovery.ts");

  assert.match(source, /forwardedHost/);
  assert.match(source, /normalizePublicHostname/);
  assert.match(source, /requestHost[\s\S]*siteUrl/);
  assert.match(source, /\/admin\/update-password/);
  assert.doesNotMatch(source, /demo-preview\.rybsoftware\.com/);
});

test("business-admin recovery uses tenant-aware SES sender, not Supabase direct email", () => {
  const action = readRepoFile("src/app/admin/(auth)/forgot-password/actions.ts");
  const helper = readRepoFile("src/lib/admin/password-recovery.ts");

  assert.doesNotMatch(action, /resetPasswordForEmail/);
  assert.doesNotMatch(helper, /resetPasswordForEmail/);
  assert.match(helper, /resolveTenantFromHostname\(requestHost\)/);
  assert.match(helper, /findAuthUserByEmail\(input\.email\)/);
  assert.match(helper, /hasActiveAdminMembership/);
  assert.match(helper, /businessId: tenant\.id/);
  assert.match(helper, /authUserId: authUser\.id/);
  assert.match(helper, /buildAdminPasswordRecoveryEmail/);
  assert.match(helper, /sendEmail\(\{/);
  assert.doesNotMatch(helper, /Tan Can Man/);
});

test("business-admin update password consumes recovery session and updates Supabase password", () => {
  const source = readRepoFile("src/app/admin/(auth)/update-password/update-password-client.tsx");

  assert.match(source, /verifyOtp\(\{[\s\S]*type: "recovery"/);
  assert.match(source, /exchangeCodeForSession\(code\)/);
  assert.match(source, /setSession\(\{/);
  assert.match(source, /updateUser\(\{ password \}\)/);
  assert.match(source, /router\.replace\("\/admin\/login\?success=password-updated"\)/);
  assert.doesNotMatch(source, /platform-admin/);
  assert.doesNotMatch(source, /business_admin_memberships/);
});

test("business-admin login links to recovery and displays reset success", () => {
  const source = readRepoFile("src/app/admin/(auth)/login/page.tsx");

  assert.match(source, /href=\{`\/admin\/forgot-password/);
  assert.match(source, /Forgot password\?/);
  assert.match(source, /success === "password-updated"/);
  assert.doesNotMatch(source, /platform-admin/);
});

test("platform admin recovery is not wired in this phase", () => {
  const platformLogin = readRepoFile("src/app/platform-admin/(auth)/login/page.tsx");
  const platformActions = readRepoFile("src/app/platform-admin/(auth)/login/actions.ts");

  assert.doesNotMatch(platformLogin, /forgot-password|update-password|resetPasswordForEmail/);
  assert.doesNotMatch(platformActions, /forgot-password|update-password|resetPasswordForEmail/);
});
