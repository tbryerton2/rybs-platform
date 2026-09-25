import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("existing-user admin invite requires password setup instead of immediate admin entry", () => {
  const client = readRepoFile("src/app/admin/(auth)/accept-invite/admin-accept-invite-client.tsx");

  assert.match(client, /tokenHash && \(type === "invite" \|\| type === "magiclink"\)/);
  assert.match(client, /setState\(\{ status: "ready", session \}\)/);
  assert.match(client, /updateUser\(\{ password \}\)/);
  assert.doesNotMatch(client, /if \(type !== "invite"\)[\s\S]*finishAdminSession/);
});

test("brand-new admin invite also requires password setup before admin session cookies", () => {
  const client = readRepoFile("src/app/admin/(auth)/accept-invite/admin-accept-invite-client.tsx");

  assert.match(client, /verifyOtp\(\{[\s\S]*token_hash: tokenHash,[\s\S]*type,/);
  assert.match(client, /Your invitation session is not ready yet/);
  assert.match(client, /Use at least 8 characters for the password/);
  assert.match(client, /Set password and enter admin/);
  assert.match(client, /const \{ error \} = await authClient\.auth\.updateUser\(\{ password \}\)/);
});

test("admin invite password update success routes directly to the invited tenant admin", () => {
  const client = readRepoFile("src/app/admin/(auth)/accept-invite/admin-accept-invite-client.tsx");
  const sessionRoute = readRepoFile("src/app/admin/(auth)/auth/session/route.ts");

  assert.match(client, /const redirectTo = await finishAdminSession\(state\.session, invite\.intendedBusinessId\)/);
  assert.match(client, /router\.replace\(redirectTo\)/);
  assert.match(sessionRoute, /resolveAdminInviteDestination\(businessOptions, intendedBusinessId\)/);
  assert.match(sessionRoute, /setAdminSelectedBusinessCookie\(response, destination\.selectedBusiness\.id\)/);
  assert.match(sessionRoute, /redirectTo: destination\.redirectTo/);
});

test("admin invite password update failure does not create an admin session", () => {
  const client = readRepoFile("src/app/admin/(auth)/accept-invite/admin-accept-invite-client.tsx");
  const failureBranch = /if \(error\) \{[\s\S]*setIsSubmitting\(false\);[\s\S]*setSubmitError\(error\.message \|\| "We could not set your password\."\);[\s\S]*return;[\s\S]*\}/;

  assert.match(client, failureBranch);
});

test("admin invite password screen is tenant-branded from the invited business id", () => {
  const page = readRepoFile("src/app/admin/(auth)/accept-invite/page.tsx");
  const client = readRepoFile("src/app/admin/(auth)/accept-invite/admin-accept-invite-client.tsx");

  assert.match(page, /ADMIN_INVITE_BUSINESS_PARAM/);
  assert.match(page, /findTenantByIdStrict\(businessId, \{ requireActive: true \}\)/);
  assert.match(page, /getBrandSettingsForTenant\(tenant\)/);
  assert.match(page, /<AdminAcceptInviteClient businessName=\{businessName\} \/>/);
  assert.match(client, /businessName \? `\$\{businessName\} ` : ""/);
});

test("admin invite session keeps tenant validation and multi-business preservation centralized", () => {
  const sessionRoute = readRepoFile("src/app/admin/(auth)/auth/session/route.ts");
  const helper = readRepoFile("src/lib/admin/invite-acceptance.ts");

  assert.match(helper, /findInvitedBusiness\(businesses, intendedBusinessId\)/);
  assert.match(helper, /businesses\.length === 1 \? businesses\[0\] : null/);
  assert.match(helper, /invited_business_not_available/);
  assert.match(sessionRoute, /This invitation no longer grants access to the invited business/);
  assert.doesNotMatch(sessionRoute, /\.delete\(/);
});
