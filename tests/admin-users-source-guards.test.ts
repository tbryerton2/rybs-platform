import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("business admin memberships support owner and admin roles with same-business RPC guards", () => {
  const migration = readRepoFile("supabase/migrations/20260918010112_tenant_admin_user_management.sql");

  assert.match(migration, /check \(role in \('owner', 'admin'\)\)/);
  assert.match(migration, /business_admin_grant_membership/);
  assert.match(migration, /business_admin_update_membership/);
  assert.match(migration, /business_id = p_business_id/);
  assert.match(migration, /p_actor_auth_user_id/);
  assert.match(migration, /role = 'owner'/);
  assert.match(migration, /BUSINESS_ADMIN_OWNER_REQUIRED/);
  assert.match(migration, /BUSINESS_ADMIN_SELF_UPDATE_BLOCKED/);
  assert.match(migration, /BUSINESS_ADMIN_LAST_OWNER/);
  assert.match(migration, /join auth\.users/);
  assert.match(migration, /email_confirmed_at is not null/);
  assert.match(migration, /grant execute on function public\.business_admin_grant_membership/);
  assert.match(migration, /to service_role/);
});

test("tenant admin users service uses selected business context and tenant-aware invite email", () => {
  const service = readRepoFile("src/lib/admin/users.ts");

  assert.match(service, /requireAdminBusinessOwner/);
  assert.match(service, /\.eq\("business_id", session\.business\.id\)/);
  assert.match(service, /business_admin_grant_membership/);
  assert.match(service, /business_admin_update_membership/);
  assert.match(service, /p_business_id: session\.business\.id/);
  assert.match(service, /generateLink\(\{[\s\S]*type: "invite"/);
  assert.match(service, /generateLink\(\{[\s\S]*type: "magiclink"/);
  assert.match(service, /resolveTenantEmailSender/);
  assert.match(service, /tenantSenderSendEmailOptions/);
  assert.match(service, /buildAdminUserInviteEmail/);
  assert.match(service, /getTenantCommunicationSettings\(session\.business/);
  assert.match(service, /\/admin\/accept-invite/);
  assert.doesNotMatch(service, /inviteUserByEmail/);
  assert.doesNotMatch(service, /Tan Can Man/);
});

test("tenant users page exposes phase one controls without accepting forged business ids", () => {
  const page = readRepoFile("src/app/admin/(protected)/settings/users/page.tsx");
  const actions = readRepoFile("src/app/admin/(protected)/settings/users/actions.ts");
  const nav = readRepoFile("src/app/admin/_components/admin/admin-nav.ts");

  assert.match(page, /Invite User/);
  assert.match(page, /<option value="admin">Admin<\/option>/);
  assert.match(page, /<option value="owner">Owner<\/option>/);
  assert.match(page, /Pending/);
  assert.match(page, /Resend Invite/);
  assert.match(page, /Remove/);
  assert.match(page, /activeOwnerCount <= 1/);
  assert.match(page, /isCurrentUser/);
  assert.match(page, /lg:hidden/);
  assert.match(actions, /inviteBusinessAdminUser/);
  assert.match(actions, /resendBusinessAdminInvitation/);
  assert.match(actions, /disableBusinessAdminUser/);
  assert.doesNotMatch(actions, /formData\.get\(["']businessId["']\)/);
  assert.match(nav, /\/admin\/settings\/users/);
});

test("admin invite acceptance sets password before creating app admin session", () => {
  const client = readRepoFile("src/app/admin/(auth)/accept-invite/admin-accept-invite-client.tsx");
  const page = readRepoFile("src/app/admin/(auth)/accept-invite/page.tsx");

  assert.match(page, /AdminAcceptInviteClient/);
  assert.match(client, /verifyOtp\(\{[\s\S]*type/);
  assert.match(client, /exchangeCodeForSession\(code\)/);
  assert.match(client, /updateUser\(\{ password \}\)/);
  assert.match(client, /fetch\("\/admin\/auth\/session"/);
  assert.match(client, /router\.replace\(redirectTo\)/);
  assert.doesNotMatch(client, /Tan Can Man/);
});
