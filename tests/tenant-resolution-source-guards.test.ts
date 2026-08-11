import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("getCurrentTenant has no first-active fallback query", () => {
  const source = readRepoFile("src/lib/tenant/server.ts");
  const getCurrentTenantBody = source.slice(
    source.indexOf("export const getCurrentTenant"),
    source.indexOf("export type StrictTenantLookupOptions"),
  );

  assert.match(getCurrentTenantBody, /headers\(\)/);
  assert.match(getCurrentTenantBody, /resolvePublicTenantFromHostname\(headerStore\.get\("host"\)\)/);
  assert.match(getCurrentTenantBody, /\.from\("tenant_domains"\)/);
  assert.match(getCurrentTenantBody, /\.eq\("hostname", hostname\)/);
  assert.match(getCurrentTenantBody, /row\.status !== "active"/);
  assert.match(getCurrentTenantBody, /tenant\.status !== "active"/);
  assert.match(getCurrentTenantBody, /process\.env\.NODE_ENV === "development"/);
  assert.doesNotMatch(getCurrentTenantBody, /order\("created_at"/);
  assert.doesNotMatch(getCurrentTenantBody, /limit\(1\)/);
  assert.doesNotMatch(getCurrentTenantBody, /getConfiguredCurrentTenantSlug\(\)/);
});

test("strict tenant helpers query exact id or slug and never order by first active tenant", () => {
  const source = readRepoFile("src/lib/tenant/server.ts");
  const strictBody = source.slice(source.indexOf("async function findTenantStrict"));

  assert.match(strictBody, /\.eq\(field, cleanedValue\)/);
  assert.doesNotMatch(strictBody, /order\("created_at"/);
  assert.doesNotMatch(strictBody, /fallbackLookup/);
});

test("platform admin auth remains tenant-independent", () => {
  const source = readRepoFile("src/lib/platform-admin/auth.ts");

  assert.doesNotMatch(source, /getCurrentTenant/);
  assert.doesNotMatch(source, /business_admin_memberships/);
  assert.match(source, /platform_admin_memberships/);
});

test("availability and hold flows pass the exact resolved business id downstream", () => {
  const availability = readRepoFile("src/app/api/availability/route.ts");
  const calendar = readRepoFile("src/app/api/availability/calendar/route.ts");
  const hold = readRepoFile("src/app/api/hold/route.ts");
  const pickupCap = readRepoFile("src/app/api/pickup-cap/route.ts");

  for (const source of [availability, calendar, hold, pickupCap]) {
    assert.match(source, /const tenant = await getCurrentTenant\(\)/);
    assert.match(source, /businessId: tenant\.id/);
    assert.match(source, /isTenantResolutionError/);
  }

  assert.match(availability, /getRetailSiteSettingsForTenant\(tenant\)/);
  assert.match(hold, /getServerTenantStorageKeyForTenant\(businessId/);
  assert.match(calendar, /getRetailSiteSettingsForTenant\(tenant\)/);
});

test("public page loaders pass the resolved tenant id to tenant-sensitive helpers", () => {
  const home = readRepoFile("src/app/page.tsx");
  const pricing = readRepoFile("src/app/pricing/page.tsx");
  const book = readRepoFile("src/app/book/page.tsx");

  assert.match(home, /const tenant = await getCurrentTenant\(\)/);
  assert.match(home, /tenantId: tenant\.id/);
  assert.match(home, /getRetailSiteSettingsForTenant\(tenant\)/);
  assert.match(home, /getActiveServiceAreaZipCodes\(tenant\.id\)/);

  assert.match(pricing, /const tenant = await getCurrentTenant\(\)/);
  assert.match(pricing, /getPublicDumpsterProducts\(zip, tenant\.id\)/);
  assert.match(pricing, /getPricingSettingsSnapshot\(tenant\.id\)/);
  assert.match(pricing, /tenantId: tenant\.id/);

  assert.match(book, /const tenant = await getCurrentTenant\(\)/);
  assert.match(book, /getBookingEntryContent\(\{ tenantId: tenant\.id \}\)/);
  assert.match(book, /getPublicDumpsterProducts\(zip, tenant\.id\)/);
  assert.match(book, /getActiveServiceAreaZip\(zip, tenant\.id\)/);
});

test("public hostname resolution has no production query-string tenant override", () => {
  const tenantServer = readRepoFile("src/lib/tenant/server.ts");
  const hostnameResolverBody = tenantServer.slice(
    tenantServer.indexOf("const resolvePublicTenantFromNormalizedHostname"),
    tenantServer.indexOf("export async function resolvePublicTenantFromRequest"),
  );

  assert.doesNotMatch(tenantServer, /searchParams\.get\(["'](?:tenant|tenantId|businessId)["']\)/);
  assert.doesNotMatch(tenantServer, /nextUrl\.searchParams/);
  assert.doesNotMatch(hostnameResolverBody, /DEFAULT_TENANT_SLUG/);
});

test("tenant-sensitive caches are keyed by tenant or normalized hostname", () => {
  const tenantServer = readRepoFile("src/lib/tenant/server.ts");

  assert.match(tenantServer, /const getTenantSettingsMap = cache\(async \(tenantId: string\)/);
  assert.match(tenantServer, /const getTenantContentMap = cache\(async \(tenantId: string, status: TenantContentStatus\)/);
  assert.match(tenantServer, /const resolvePublicTenantFromNormalizedHostname = cache\(\s*async \(hostname: string\)/);
  assert.match(tenantServer, /getTenantContentByStatusForTenant\(tenantId, key, "published"\)/);
});

test("Platform Admin business detail shows domains without using public hostname auth", () => {
  const tenants = readRepoFile("src/lib/platform-admin/tenants.ts");
  const detailPage = readRepoFile("src/app/platform-admin/(protected)/businesses/[tenantId]/page.tsx");

  assert.match(tenants, /\.from\("tenant_domains"\)/);
  assert.match(tenants, /\.eq\("tenant_id", tenant\.id\)/);
  assert.match(detailPage, /function TenantDomainsSection/);
  assert.match(detailPage, /hostname/);
  assert.match(detailPage, /domainType/);
  assert.match(detailPage, /isPrimary/);
});

test("booking creation and confirmation flows use the exact resolved business id", () => {
  const bookingCreate = readRepoFile("src/app/api/bookings/create/route.ts");
  const bookings = readRepoFile("src/app/api/bookings/route.ts");
  const confirmBooking = readRepoFile("src/app/api/confirm-booking/route.ts");

  for (const source of [bookingCreate, bookings, confirmBooking]) {
    assert.match(source, /const tenant = await getCurrentTenant\(\)/);
    assert.match(source, /businessId: tenant\.id/);
    assert.match(source, /isTenantResolutionError/);
  }

  assert.match(confirmBooking, /attachReorderReference\([\s\S]*tenant\.id/);
  assert.doesNotMatch(confirmBooking, /tenantForPostBooking/);
});

test("business-admin auth no longer resolves admin access through the current public tenant", () => {
  const source = readRepoFile("src/lib/admin/auth.ts");

  assert.doesNotMatch(source, /getCurrentTenant/);
  assert.match(source, /\.from\("business_admin_memberships"\)/);
  assert.match(source, /\.eq\("auth_user_id", data\.user\.id\)/);
  assert.match(source, /memberships\.length === 0/);
  assert.match(source, /memberships\.length > 1/);
  assert.match(source, /\.from\("tenants"\)/);
  assert.match(source, /\.eq\("id", membership\.businessId\)/);
  assert.match(source, /status !== "active"/);
  assert.doesNotMatch(source, /platform_admin_memberships/);
});
