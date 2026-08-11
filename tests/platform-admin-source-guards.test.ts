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

test("existing business admin auth still uses the existing admin route and membership table", () => {
  const adminAuth = readRepoFile("src/lib/admin/auth.ts");

  assert.match(adminAuth, /ADMIN_ACCESS_TOKEN_COOKIE = "tcm_admin_access_token"/);
  assert.match(adminAuth, /\.from\("business_admin_memberships"\)/);
  assert.match(adminAuth, /redirect\("\/admin\/login"\)/);
});
