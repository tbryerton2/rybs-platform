import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function listSourceFiles(path: string): string[] {
  const absolutePath = resolve(repoRoot, path);
  const entries = readdirSync(absolutePath);

  return entries.flatMap((entry) => {
    const childPath = resolve(absolutePath, entry);
    const repoPath = resolve(path, entry);
    const stat = statSync(childPath);

    if (stat.isDirectory()) {
      return listSourceFiles(repoPath);
    }

    return /\.(ts|tsx)$/.test(entry) ? [repoPath] : [];
  });
}

test("admin auth derives business context from exactly one active business membership", () => {
  const source = readRepoFile("src/lib/admin/auth.ts");

  assert.doesNotMatch(source, /getCurrentTenant/);
  assert.match(source, /\.from\("business_admin_memberships"\)/);
  assert.match(source, /\.eq\("auth_user_id", userId\)/);
  assert.match(source, /\.eq\("role", "owner"\)/);
  assert.match(source, /\.eq\("status", "active"\)/);
  assert.match(source, /memberships\.length === 0/);
  assert.match(source, /loadAdminBusinessTenant\(membership\)/);
  assert.match(source, /options\.length > 1/);
  assert.match(source, /ADMIN_SELECTED_BUSINESS_COOKIE/);
  assert.match(source, /candidate\.id === selectedBusinessId/);
  assert.match(source, /business_selection_required/);
});

test("admin auth loads the exact membership tenant and rejects inactive tenants", () => {
  const source = readRepoFile("src/lib/admin/auth.ts");
  const tenantLookup = source.slice(source.indexOf("async function loadAdminBusinessTenant"));

  assert.match(tenantLookup, /\.from\("tenants"\)/);
  assert.match(tenantLookup, /\.eq\("id", membership\.businessId\)/);
  assert.match(tenantLookup, /\.maybeSingle\(\)/);
  assert.match(tenantLookup, /status !== "active"/);
  assert.match(source, /businessId: input\.business\.id/);
  assert.match(source, /tenant: \{/);
});

test("platform membership alone does not grant business-admin access", () => {
  const adminAuth = readRepoFile("src/lib/admin/auth.ts");
  const platformAuth = readRepoFile("src/lib/platform-admin/auth.ts");

  assert.doesNotMatch(adminAuth, /platform_admin_memberships/);
  assert.match(platformAuth, /platform_admin_memberships/);
  assert.doesNotMatch(platformAuth, /business_admin_memberships/);
});

test("protected admin shell uses the selected tenant name", () => {
  const layout = readRepoFile("src/app/admin/(protected)/layout.tsx");
  const shell = readRepoFile("src/app/admin/_components/admin/admin-shell.tsx");
  const sidebar = readRepoFile("src/app/admin/_components/admin/admin-sidebar.tsx");

  assert.match(layout, /businessName=\{adminSession\.tenant\.name\}/);
  assert.match(layout, /canSwitchBusiness=\{adminSession\.availableBusinesses\.length > 1\}/);
  assert.match(shell, /businessName: string/);
  assert.match(shell, /businessName=\{businessName\}/);
  assert.match(shell, /canSwitchBusiness/);
  assert.match(sidebar, /businessName: string/);
  assert.match(sidebar, /href="\/admin\/select-business"/);
  assert.doesNotMatch(shell, /Tan Can Man Admin/);
  assert.doesNotMatch(sidebar, /Tan Can Man Admin/);
});

test("admin business selector revalidates cookie and submitted business ids against active memberships", () => {
  const auth = readRepoFile("src/lib/admin/auth.ts");
  const page = readRepoFile("src/app/admin/(auth)/select-business/page.tsx");
  const actions = readRepoFile("src/app/admin/(auth)/select-business/actions.ts");
  const loginAction = readRepoFile("src/app/admin/(auth)/login/actions.ts");
  const sessionRoute = readRepoFile("src/app/admin/(auth)/auth/session/route.ts");
  const logoutRoute = readRepoFile("src/app/admin/(auth)/logout/route.ts");

  assert.match(auth, /ADMIN_SELECTED_BUSINESS_COOKIE = "rybs_admin_selected_business_id"/);
  assert.match(auth, /httpOnly: true/);
  assert.match(auth, /sameSite: "lax"/);
  assert.match(auth, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(auth, /loadActiveAdminBusinessOptionsForUser/);
  assert.match(auth, /options\.find\(\(candidate\) => candidate\.id === selectedBusinessId\)/);
  assert.match(auth, /redirect\("\/admin\/select-business"\)/);
  assert.match(actions, /getAdminBusinessSelectionContext\(\)/);
  assert.match(actions, /context\.businesses\.find\(\(business\) => business\.id === businessId\)/);
  assert.match(actions, /setAdminSelectedBusinessCookieFromServerAction\(selectedBusiness\.id\)/);
  assert.match(page, /selectAdminBusinessAction/);
  assert.match(page, /context\.businesses\.length === 1/);
  assert.match(loginAction, /businessOptions\.length === 1/);
  assert.match(loginAction, /businessOptions\.length > 1 \? "\/admin\/select-business" : "\/admin"/);
  assert.match(sessionRoute, /businessOptions\.length > 1 \? "\/admin\/select-business" : "\/admin"/);
  assert.match(sessionRoute, /setAdminSelectedBusinessCookie\(response, businessOptions\[0\]\.id\)/);
  assert.match(logoutRoute, /clearAdminSessionCookies\(response, host\)/);
});

test("admin helpers and routes do not call public current-tenant resolution", () => {
  const files = [
    ...listSourceFiles("src/lib/admin"),
    ...listSourceFiles("src/app/admin"),
    ...listSourceFiles("src/app/api/admin"),
  ];

  for (const file of files) {
    const source = readRepoFile(file);
    assert.doesNotMatch(source, /getCurrentTenant\(/, `${file} must not call getCurrentTenant()`);
    assert.doesNotMatch(source, /DEFAULT_TENANT_SLUG/, `${file} must not use DEFAULT_TENANT_SLUG`);
  }
});

test("admin actions and API routes do not accept forged business identifiers", () => {
  const files = [
    ...listSourceFiles("src/app/admin"),
    ...listSourceFiles("src/app/api/admin"),
  ];

  for (const file of files) {
    if (file.endsWith("src/app/admin/(auth)/select-business/actions.ts")) continue;

    const source = readRepoFile(file);
    assert.doesNotMatch(source, /formData\.get\(["']businessId["']\)/, `${file} must not read businessId from forms`);
    assert.doesNotMatch(source, /searchParams\.get\(["']businessId["']\)/, `${file} must not read businessId from URLs`);
    assert.doesNotMatch(source, /\bbody\.businessId\b/, `${file} must not read businessId from request bodies`);
  }
});

test("booking and customer admin object lookups are scoped by context business id", () => {
  const files = [
    "src/app/admin/(protected)/bookings/[id]/page.tsx",
    "src/app/admin/(protected)/bookings/[id]/actions.ts",
    "src/app/admin/(protected)/customers/[id]/page.tsx",
    "src/app/admin/(protected)/customers/[id]/actions.ts",
    "src/app/api/admin/bookings/[id]/route.ts",
  ];

  for (const file of files) {
    const source = readRepoFile(file);
    assert.match(source, /requireAdminOwner|requireAdminOwnerForApi/, `${file} must guard with admin context`);
    assert.match(source, /\.eq\("business_id", adminSession\.business\.id\)|\.eq\("business_id", adminAuth\.session\.business\.id\)|const businessId = adminSession\.business\.id/, `${file} must scope by context business id`);
  }
});

test("admin booking detail future dependency lookup is business-scoped", () => {
  const source = readRepoFile("src/app/admin/(protected)/bookings/[id]/page.tsx");
  const futureLookup = source.slice(source.indexOf("const futureDependencyDatesResult"));

  assert.match(futureLookup, /\.from\("bookings"\)/);
  assert.match(futureLookup, /\.eq\("business_id", businessId\)/);
  assert.match(futureLookup, /\.neq\("id", booking\.id\)/);
});

test("public tenant resolution remains separate from admin and platform admin", () => {
  const tenantServer = readRepoFile("src/lib/tenant/server.ts");
  const adminAuth = readRepoFile("src/lib/admin/auth.ts");
  const platformAuth = readRepoFile("src/lib/platform-admin/auth.ts");

  assert.match(tenantServer, /export const getCurrentTenant/);
  assert.match(tenantServer, /resolvePublicTenantFromHostname\(headerStore\.get\("host"\)\)/);
  assert.match(tenantServer, /\.from\("tenant_domains"\)/);
  assert.doesNotMatch(adminAuth, /getCurrentTenant/);
  assert.doesNotMatch(platformAuth, /getCurrentTenant/);
});
