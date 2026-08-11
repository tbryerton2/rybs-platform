import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("platform domain services require platform auth and never infer tenant from hostname", () => {
  const source = readRepoFile("src/lib/platform-admin/domains.ts");

  for (const exportedName of [
    "listPlatformTenantDomains",
    "createPlatformTenantDomain",
    "updatePlatformTenantDomain",
    "activatePlatformTenantDomain",
    "disablePlatformTenantDomain",
    "setPlatformTenantDomainPrimary",
    "provisionPlatformTenantDomain",
    "checkPlatformTenantDomain",
    "removePlatformTenantDomain",
  ]) {
    const body = source.slice(source.indexOf(`export async function ${exportedName}`));
    assert.match(body, /await requirePlatformAdmin\(\);/, `${exportedName} must require platform auth`);
  }

  assert.match(source, /findTenantByIdStrict\(tenantId\.value, \{ requireActive: false \}\)/);
  assert.doesNotMatch(source, /getCurrentTenant\(/);
  assert.doesNotMatch(source, /requireAdminOwner/);
  assert.doesNotMatch(source, /resolvePublicTenantFromHostname/);
});

test("domain creation reloads exact tenant and rejects global hostname duplicates", () => {
  const source = readRepoFile("src/lib/platform-admin/domains.ts");
  const createBody = source.slice(
    source.indexOf("export async function createPlatformTenantDomain"),
    source.indexOf("export async function updatePlatformTenantDomain"),
  );

  assert.match(createBody, /const tenant = await requireTenantForDomainMutation\(input\.tenantId\)/);
  assert.match(createBody, /const hostname = normalizePlatformDomainHostname\(input\.hostname\)/);
  assert.match(createBody, /await assertHostnameAvailableForTenant\(hostname, tenant\.id\)/);
  assert.match(createBody, /tenant_id: tenant\.id/);
  assert.match(source, /\.from\("tenant_domains"\)[\s\S]*\.select\("id, tenant_id"\)[\s\S]*\.eq\("hostname", hostname\)[\s\S]*\.maybeSingle\(\)/);
  assert.match(source, /That hostname is already assigned to another business\./);
  assert.match(source, /That hostname is already assigned to this business\./);
});

test("hostname validation uses public normalization but rejects stored URL, path, port, localhost, and empty inputs", () => {
  const source = readRepoFile("src/lib/platform-admin/domains.ts");
  const validationBody = source.slice(
    source.indexOf("export function normalizePlatformDomainHostname"),
    source.indexOf("function normalizeDomainId"),
  );

  assert.match(validationBody, /normalizePublicHostname\(raw\)/);
  assert.match(validationBody, /if \(!raw\)/);
  assert.match(validationBody, /\^\[a-z\]\[a-z0-9\+\.\-\]\*:\\\/\\\//);
  assert.match(validationBody, /\/\[\/\?\#\]\//);
  assert.match(validationBody, /raw\.includes\(":"\)/);
  assert.match(validationBody, /isPlainLocalhostHostname\(hostname\)/);
  assert.match(validationBody, /hostname\.endsWith\("\.localhost"\)/);
});

test("domain updates and removals are scoped by both exact tenant id and exact domain id", () => {
  const source = readRepoFile("src/lib/platform-admin/domains.ts");

  assert.match(source, /\.from\("tenant_domains"\)[\s\S]*\.eq\("id", domainId\)[\s\S]*\.eq\("tenant_id", tenantId\)[\s\S]*\.maybeSingle\(\)/);
  assert.match(source, /\.update\(\{[\s\S]*domain_type: domainType[\s\S]*status[\s\S]*\}\)[\s\S]*\.eq\("id", domain\.id\)[\s\S]*\.eq\("tenant_id", tenant\.id\)/);
  assert.match(source, /assertDomainCanBecomeActive/);
  assert.match(source, /\.update\(\{ status: "active" \}\)[\s\S]*\.eq\("id", domain\.id\)[\s\S]*\.eq\("tenant_id", tenant\.id\)/);
  assert.match(source, /\.update\(\{ status: "disabled", is_primary: false \}\)[\s\S]*\.eq\("id", domain\.id\)[\s\S]*\.eq\("tenant_id", tenant\.id\)/);
  assert.match(source, /\.delete\(\)[\s\S]*\.eq\("id", domain\.id\)[\s\S]*\.eq\("tenant_id", tenant\.id\)/);
  assert.doesNotMatch(source, /\.from\("tenants"\)[\s\S]*\.delete\(/);
  assert.doesNotMatch(source, /\.from\("(?:tenant_content_entries|bookings|auth\.users|tenant_settings)"\)[\s\S]*\.delete\(/);
});

test("production domain activation requires provider readiness except wildcard platform subdomains", () => {
  const source = readRepoFile("src/lib/platform-admin/domains.ts");
  const vercelSource = readRepoFile("src/lib/platform-admin/vercel-domains.ts");
  const migration = readRepoFile("supabase/migrations/202608110101_tenant_domain_vercel_provisioning.sql");

  assert.match(source, /providerStatus === "ready"/);
  assert.match(source, /isPlatformSubdomainCoveredByConfiguredWildcard\(domain\.hostname\)/);
  assert.match(source, /This domain cannot be activated until Vercel reports it is configured and verified\./);
  assert.match(source, /Production domains must be provisioned and verified before activation\./);
  assert.match(vercelSource, /PLATFORM_PUBLIC_BASE_DOMAIN/);
  assert.match(vercelSource, /hostname\.endsWith\(`\.\$\{baseDomain\}`\)/);
  assert.match(migration, /add column if not exists provider_status text not null default 'not_provisioned'/);
  assert.match(migration, /add column if not exists dns_instructions jsonb/);
  assert.match(migration, /tenant_domains_provider_status_idx/);
});

test("Vercel provisioning/check/removal flows are exact-domain scoped and retry safe", () => {
  const source = readRepoFile("src/lib/platform-admin/domains.ts");
  const actions = readRepoFile("src/app/platform-admin/(protected)/businesses/actions.ts");
  const vercelSource = readRepoFile("src/lib/platform-admin/vercel-domains.ts");

  assert.match(actions, /export async function provisionDomainAction/);
  assert.match(actions, /export async function checkDomainAction/);
  assert.match(actions, /await provisionPlatformTenantDomain\(/);
  assert.match(source, /await markDomainProvisioning\(domain\)/);
  assert.match(source, /await fetchVercelDomainSnapshot\(\{\s*hostname: domain\.hostname,\s*attemptVerification: true,/);
  assert.match(source, /await removeVercelProjectDomain\(\{ hostname: domain\.hostname \}\)/);
  assert.match(source, /!isWildcardReadyPlatformSubdomain\(domain\)/);
  assert.match(vercelSource, /\/v10\/projects\/\$\{encodedProject\}\/domains/);
  assert.match(vercelSource, /\/v9\/projects\/\$\{encodedProject\}\/domains\/\$\{encodeURIComponent\(hostname\)\}\/verify/);
  assert.match(vercelSource, /\/v6\/domains\/\$\{encodeURIComponent\(hostname\)\}\/config/);
  assert.match(vercelSource, /Authorization: `Bearer \$\{config\.token\}`/);
});

test("primary domain switching is RPC-backed, active-only, and tenant-scoped", () => {
  const source = readRepoFile("src/lib/platform-admin/domains.ts");
  const migration = readRepoFile("supabase/migrations/202608100102_platform_admin_domain_primary_rpc.sql");

  assert.match(source, /\.rpc\("platform_admin_set_primary_tenant_domain"/);
  assert.match(source, /Only active domains can be marked primary\./);
  assert.match(migration, /create or replace function public\.platform_admin_set_primary_tenant_domain/);
  assert.match(migration, /where tenant_domains\.id = p_domain_id\s+and tenant_domains\.tenant_id = p_tenant_id\s+for update/);
  assert.match(migration, /target_status <> 'active'/);
  assert.match(migration, /where tenant_domains\.tenant_id = p_tenant_id\s+and tenant_domains\.id <> p_domain_id\s+and tenant_domains\.is_primary = true/);
  assert.match(migration, /where tenant_domains\.id = p_domain_id\s+and tenant_domains\.tenant_id = p_tenant_id/);
  assert.match(migration, /revoke all on function public\.platform_admin_set_primary_tenant_domain\(uuid, uuid\) from anon/);
  assert.match(migration, /revoke all on function public\.platform_admin_set_primary_tenant_domain\(uuid, uuid\) from authenticated/);
  assert.match(migration, /grant execute on function public\.platform_admin_set_primary_tenant_domain\(uuid, uuid\) to service_role/);
});

test("domain removal requires explicit confirmations for hostname, primary, and only-active cases", () => {
  const source = readRepoFile("src/lib/platform-admin/domains.ts");
  const removeBody = source.slice(source.indexOf("export async function removePlatformTenantDomain"));

  assert.match(removeBody, /confirmation !== domain\.hostname/);
  assert.match(removeBody, /domain\.isPrimary && !asBoolean\(input\.clearPrimary\)/);
  assert.match(removeBody, /activeDomainCount <= 1/);
  assert.match(removeBody, /!asBoolean\(input\.acknowledgeLastActive\)/);
  assert.match(removeBody, /\.from\("tenant_domains"\)[\s\S]*\.delete\(\)/);
});

test("platform admin domain UI exposes compact management actions and warnings", () => {
  const detailPage = readRepoFile("src/app/platform-admin/(protected)/businesses/[tenantId]/page.tsx");
  const newPage = readRepoFile("src/app/platform-admin/(protected)/businesses/[tenantId]/domains/new/page.tsx");
  const editPage = readRepoFile("src/app/platform-admin/(protected)/businesses/[tenantId]/domains/[domainId]/page.tsx");
  const actions = readRepoFile("src/app/platform-admin/(protected)/businesses/actions.ts");

  for (const actionName of [
    "createDomainAction",
    "updateDomainAction",
    "provisionDomainAction",
    "checkDomainAction",
    "activateDomainAction",
    "disableDomainAction",
    "makePrimaryDomainAction",
    "removeDomainAction",
  ]) {
    assert.match(actions, new RegExp(`export async function ${actionName}`));
  }

  assert.match(detailPage, /Add domain/);
  assert.match(detailPage, /Edit/);
  assert.match(detailPage, /Activate/);
  assert.match(detailPage, /Provision on Vercel/);
  assert.match(detailPage, /Check domain/);
  assert.match(detailPage, /DNS required/);
  assert.match(detailPage, /Ownership TXT required/);
  assert.match(detailPage, /Disable/);
  assert.match(detailPage, /Make primary/);
  assert.match(detailPage, /Remove confirmation/);
  assert.match(detailPage, /active business has no active production public domain/);
  assert.match(detailPage, /custom domain is pending/);
  assert.match(detailPage, /primary domain is not active/);
  assert.match(detailPage, /Vercel domain integration/);
  assert.match(newPage, /Platform subdomain/);
  assert.match(newPage, /Customer-owned domain/);
  assert.match(newPage, /Dedicated booking hostname/);
  assert.match(newPage, /Protocols, paths, ports, and localhost/);
  assert.match(newPage, /start Vercel provisioning/);
  assert.match(editPage, /Hostnames are immutable/);
  assert.match(editPage, /Only active domains can be primary/);
});
