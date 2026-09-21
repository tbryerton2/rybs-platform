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

test("business admin membership update rpc runs as a locked-down definer without broad auth grants", () => {
  const migration = readRepoFile(
    "supabase/migrations/20260921142749_security_definer_business_admin_update_membership.sql",
  );

  assert.match(migration, /create or replace function public\.business_admin_update_membership\(\s*p_actor_auth_user_id uuid,\s*p_business_id uuid,\s*p_membership_id uuid,\s*p_role text default null,\s*p_status text default null\s*\)/);
  assert.match(migration, /returns uuid\s+language plpgsql\s+security definer\s+set search_path = public/);
  assert.doesNotMatch(migration, /business_admin_grant_membership/);

  assert.match(migration, /p_role is not null and p_role not in \('owner', 'admin'\)/);
  assert.match(migration, /p_status is not null and p_status not in \('active', 'disabled'\)/);
  assert.match(migration, /business_id = p_business_id[\s\S]*auth_user_id = p_actor_auth_user_id[\s\S]*role = 'owner'[\s\S]*status = 'active'/);
  assert.match(migration, /BUSINESS_ADMIN_OWNER_REQUIRED/);
  assert.match(migration, /where id = p_membership_id\s+and business_id = p_business_id/);
  assert.match(migration, /BUSINESS_ADMIN_MEMBERSHIP_NOT_FOUND/);
  assert.match(migration, /BUSINESS_ADMIN_SELF_UPDATE_BLOCKED/);
  assert.match(migration, /current_membership\.role = 'owner'[\s\S]*current_membership\.status = 'active'[\s\S]*coalesce\(current_owner_confirmed, false\)/);
  assert.match(migration, /join auth\.users au on au\.id = business_admin_memberships\.auth_user_id/);
  assert.match(migration, /BUSINESS_ADMIN_LAST_OWNER/);
  assert.match(migration, /return p_membership_id/);

  assert.match(migration, /revoke all on function public\.business_admin_update_membership\(uuid, uuid, uuid, text, text\) from public/);
  assert.match(migration, /revoke all on function public\.business_admin_update_membership\(uuid, uuid, uuid, text, text\) from anon/);
  assert.match(migration, /revoke all on function public\.business_admin_update_membership\(uuid, uuid, uuid, text, text\) from authenticated/);
  assert.match(migration, /grant execute on function public\.business_admin_update_membership\(uuid, uuid, uuid, text, text\) to service_role/);
  assert.doesNotMatch(migration, /grant\s+(select|all|usage)[\s\S]*auth\.users[\s\S]*service_role/i);
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
  assert.match(service, /options:\s*\{[\s\S]*redirectTo/);
  assert.match(service, /data\.properties\.hashed_token/);
  assert.match(service, /buildAdminInviteAcceptanceUrl\(\{/);
  assert.doesNotMatch(service, /actionLink:\s*data\.properties\.action_link/);
  assert.match(service, /resendBusinessAdminInvitation[\s\S]*!isPendingInvite\(authUser\)/);
  assert.match(service, /Only pending invitations can be resent/);
  assert.match(service, /resolveTenantEmailSender/);
  assert.match(service, /tenantSenderSendEmailOptions/);
  assert.match(service, /buildAdminUserInviteEmail/);
  assert.match(service, /getTenantCommunicationSettings\(session\.business/);
  assert.match(service, /getAdminAuthRedirectUrl\("\/admin\/accept-invite"/);
  assert.match(service, /getTenantPublicBaseUrl\(tenant\)/);
  assert.match(service, /\/admin\/accept-invite/);
  assert.doesNotMatch(service, /inviteUserByEmail/);
  assert.doesNotMatch(service, /Tan Can Man/);
});

test("tenant admin user mutations are bounded and surface clear failures", () => {
  const service = readRepoFile("src/lib/admin/users.ts");
  const actions = readRepoFile("src/app/admin/(protected)/settings/users/actions.ts");

  assert.match(service, /ADMIN_USER_REQUEST_TIMEOUT_MS/);
  assert.match(service, /withAdminUserRequestTimeout/);
  assert.match(service, /Removing admin access/);
  assert.match(service, /taking longer than expected/);
  assert.match(service, /mapDatabaseMutationError\(membershipError\)/);
  assert.match(actions, /redirectUnexpectedMutationError/);
  assert.match(actions, /unexpected_mutation_error/);
  assert.match(actions, /revalidatePath\("\/admin\/settings\/users"\);[\s\S]*redirect\("\/admin\/settings\/users\?status=removed"\)/);
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

test("admin invite acceptance cleans auth tokens and selects the invited tenant", () => {
  const client = readRepoFile("src/app/admin/(auth)/accept-invite/admin-accept-invite-client.tsx");
  const page = readRepoFile("src/app/admin/(auth)/accept-invite/page.tsx");
  const sessionRoute = readRepoFile("src/app/admin/(auth)/auth/session/route.ts");

  assert.match(page, /AdminAcceptInviteClient/);
  assert.match(client, /verifyOtp\(\{[\s\S]*type/);
  assert.match(client, /exchangeCodeForSession\(code\)/);
  assert.match(client, /updateUser\(\{ password \}\)/);
  assert.match(client, /fetch\("\/admin\/auth\/session"/);
  assert.match(client, /window\.history\.replaceState\(window\.history\.state, "", invite\.cleanUrl\)/);
  assert.match(client, /intendedBusinessId/);
  assert.match(client, /router\.replace\(redirectTo\)/);
  assert.match(sessionRoute, /findInvitedBusiness\(businessOptions, intendedBusinessId\)/);
  assert.match(sessionRoute, /setAdminSelectedBusinessCookie\(response, selectedBusiness\.id\)/);
  assert.match(sessionRoute, /This invitation no longer grants access to the invited business/);
  assert.doesNotMatch(client, /Tan Can Man/);
});
