import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("platform tenant data helpers require platform auth and avoid tenant fallback", () => {
  const source = readRepoFile("src/lib/platform-admin/tenants.ts");

  assert.match(source, /await requirePlatformAdmin\(\);/);
  assert.match(source, /\.from\("tenants"\)/);
  assert.match(source, /findTenantByIdStrict\(tenantId\)/);
  assert.doesNotMatch(source, /getCurrentTenant\(/);
  assert.doesNotMatch(source, /requireAdminOwner/);
});

test("platform businesses pages use platform data helpers and exact not-found handling", () => {
  const indexPage = readRepoFile("src/app/platform-admin/(protected)/businesses/page.tsx");
  const detailPage = readRepoFile("src/app/platform-admin/(protected)/businesses/[tenantId]/page.tsx");

  assert.match(indexPage, /getPlatformTenantIndex/);
  assert.match(detailPage, /getPlatformTenantDetail\(tenantId\)/);
  assert.match(detailPage, /notFound\(\)/);
  assert.doesNotMatch(indexPage, /requireAdminOwner/);
  assert.doesNotMatch(detailPage, /requireAdminOwner/);
});

test("platform dashboard uses tenant summaries instead of navigation cards", () => {
  const dashboardPage = readRepoFile("src/app/platform-admin/(protected)/page.tsx");

  assert.match(dashboardPage, /getPlatformTenantIndex/);
  assert.match(dashboardPage, /stats\.businessesNeedingSetup/);
  assert.match(dashboardPage, /tenant\.setup\.missingRequiredAreas/);
  assert.match(dashboardPage, /\/platform-admin\/businesses\/\$\{tenant\.id\}/);
  assert.match(dashboardPage, /recentlyAdded/);
  assert.doesNotMatch(dashboardPage, /Business management/);
  assert.doesNotMatch(dashboardPage, /Platform authorization/);
  assert.doesNotMatch(dashboardPage, /requireAdminOwner/);
});

test("platform admin shell exposes dashboard businesses and users navigation", () => {
  const shell = readRepoFile("src/app/platform-admin/_components/platform-admin-shell.tsx");

  assert.match(shell, /href="\/platform-admin"/);
  assert.match(shell, /href="\/platform-admin\/businesses"/);
  assert.match(shell, /href="\/platform-admin\/users"/);
  assert.match(shell, /UsersIcon/);
  assert.match(shell, /usersActive/);
});

test("platform user management remains owner-only and separate from business memberships", () => {
  const auth = readRepoFile("src/lib/platform-admin/auth.ts");
  const service = readRepoFile("src/lib/platform-admin/users.ts");
  const page = readRepoFile("src/app/platform-admin/(protected)/users/page.tsx");
  const actions = readRepoFile("src/app/platform-admin/(protected)/users/actions.ts");

  assert.match(auth, /export async function requirePlatformOwner/);
  assert.match(auth, /session\.membership\.role === "owner"/);
  assert.match(service, /requirePlatformOwner/);
  assert.match(service, /\.from\("platform_admin_memberships"\)/);
  assert.match(service, /inviteUserByEmail/);
  assert.match(service, /platform_admin_grant_membership/);
  assert.match(service, /platform_admin_update_membership/);
  assert.match(service, /PGRST202/);
  assert.match(service, /membership_rpc_missing/);
  assert.match(service, /deleteUser\(authUser\.id\)/);
  assert.match(service, /invite_membership_failure_cleanup_failed/);
  assert.match(page, /isPlatformAdminOwner/);
  assert.match(actions, /grantPlatformAdminUser/);
  assert.match(actions, /disablePlatformAdminUser/);
  assert.doesNotMatch(service, /business_admin_memberships/);
  assert.doesNotMatch(service, /password:/);
  assert.doesNotMatch(actions, /business_admin_memberships/);
});

test("platform user management rpc protects owners and service-role boundary", () => {
  const migration = readRepoFile(
    "supabase/migrations/202608200101_platform_admin_user_management_rpcs.sql",
  );

  assert.match(migration, /platform_admin_grant_membership/);
  assert.match(migration, /platform_admin_update_membership/);
  assert.match(migration, /role = 'owner'/);
  assert.match(migration, /status = 'active'/);
  assert.match(migration, /lock table public\.platform_admin_memberships/);
  assert.match(migration, /PLATFORM_ADMIN_LAST_OWNER/);
  assert.match(migration, /PLATFORM_ADMIN_SELF_UPDATE_BLOCKED/);
  assert.match(migration, /revoke all on function .* from public/);
  assert.match(migration, /revoke all on function .* from anon/);
  assert.match(migration, /revoke all on function .* from authenticated/);
  assert.match(migration, /grant execute on function .* to service_role/);
});

test("existing business admin auth still uses the existing admin route and membership table", () => {
  const adminAuth = readRepoFile("src/lib/admin/auth.ts");

  assert.match(adminAuth, /ADMIN_ACCESS_TOKEN_COOKIE = "tcm_admin_access_token"/);
  assert.match(adminAuth, /\.from\("business_admin_memberships"\)/);
  assert.match(adminAuth, /redirect\("\/admin\/login"\)/);
});
