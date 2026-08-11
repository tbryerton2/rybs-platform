import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("platform mutation helpers require platform auth and never resolve current tenant", () => {
  const source = readRepoFile("src/lib/platform-admin/tenants.ts");

  assert.match(source, /export async function createPlatformTenant/);
  assert.match(source, /await requirePlatformAdmin\(\);/);
  assert.match(source, /\.rpc\("platform_admin_create_tenant"/);
  assert.match(source, /\.rpc\("platform_admin_update_tenant_basic"/);
  assert.match(source, /findTenantByIdStrict\(tenantId, \{ requireActive: false \}\)/);
  assert.doesNotMatch(source, /getCurrentTenant\(/);
  assert.doesNotMatch(source, /requireAdminOwner/);
});

test("tenant creation and edit RPCs keep tenant rows and settings in one database function", () => {
  const migration = readRepoFile("supabase/migrations/202608060101_platform_admin_tenant_mutations.sql");
  const tenantsSource = readRepoFile("src/lib/platform-admin/tenants.ts");

  assert.match(migration, /create or replace function public\.platform_admin_create_tenant/);
  assert.match(migration, /insert into public\.tenants \(slug, status\)/);
  assert.match(migration, /insert into public\.tenant_settings \(tenant_id, category, key, value_json\)/);
  assert.match(migration, /'brand', 'name'/);
  assert.match(migration, /'support', 'timezone'/);
  assert.match(migration, /'runtime', 'storageNamespace'/);
  assert.match(migration, /create or replace function public\.platform_admin_update_tenant_basic/);
  assert.match(migration, /where tenants\.id = p_tenant_id/);
  assert.match(migration, /on conflict on constraint tenant_settings_tenant_category_key_unique/);
  assert.doesNotMatch(tenantsSource, /\.from\("tenant_settings"\)\s*\.insert/);
});

test("platform RPCs are not granted to anon or ordinary authenticated users", () => {
  const migration = readRepoFile("supabase/migrations/202608060101_platform_admin_tenant_mutations.sql");

  assert.match(migration, /revoke all on function public\.platform_admin_create_tenant\(text, text, text, text, text\) from anon/);
  assert.match(migration, /revoke all on function public\.platform_admin_create_tenant\(text, text, text, text, text\) from authenticated/);
  assert.match(migration, /grant execute on function public\.platform_admin_create_tenant\(text, text, text, text, text\) to service_role/);
  assert.match(migration, /revoke all on function public\.platform_admin_update_tenant_basic\(uuid, text, text, timestamptz\) from anon/);
  assert.match(migration, /revoke all on function public\.platform_admin_update_tenant_basic\(uuid, text, text, timestamptz\) from authenticated/);
  assert.match(migration, /grant execute on function public\.platform_admin_update_tenant_basic\(uuid, text, text, timestamptz\) to service_role/);
});

test("lifecycle actions target exact UUIDs and keep Tan Can Man high-friction", () => {
  const tenantsSource = readRepoFile("src/lib/platform-admin/tenants.ts");
  const detailPage = readRepoFile("src/app/platform-admin/(protected)/businesses/[tenantId]/page.tsx");

  assert.match(tenantsSource, /\.from\("tenants"\)/);
  assert.match(tenantsSource, /\.eq\("id", tenant\.id\)/);
  assert.match(tenantsSource, /\.eq\("status", currentStatus\)/);
  assert.match(tenantsSource, /getConfiguredCurrentTenantSlug\(\)/);
  assert.match(tenantsSource, /CURRENT_SITE_DEACTIVATION_CONFIRMATION/);
  assert.match(detailPage, /confirmationSlug/);
  assert.match(detailPage, /currentSiteConfirmation/);
  assert.match(detailPage, /Activate business/);
  assert.match(detailPage, /Deactivate business/);
});

test("business pages expose create and edit without a misleading tenant-specific admin link", () => {
  const indexPage = readRepoFile("src/app/platform-admin/(protected)/businesses/page.tsx");
  const detailPage = readRepoFile("src/app/platform-admin/(protected)/businesses/[tenantId]/page.tsx");
  const editPage = readRepoFile("src/app/platform-admin/(protected)/businesses/[tenantId]/edit/page.tsx");
  const createPage = readRepoFile("src/app/platform-admin/(protected)/businesses/new/page.tsx");

  assert.match(indexPage, /Create business/);
  assert.match(indexPage, /\/platform-admin\/businesses\/new/);
  assert.match(indexPage, /\/platform-admin\/businesses\/\$\{tenant\.id\}\/edit/);
  assert.match(detailPage, /Edit business/);
  assert.match(editPage, /getPlatformTenantDetail\(tenantId\)/);
  assert.match(createPage, /Create business/);
  assert.doesNotMatch(detailPage, /href="\/admin"/);
  assert.match(detailPage, /Tenant-specific \/admin entry is intentionally omitted/);
});

test("implementation type is stored as an exact tenant setting without domain inference", () => {
  const tenantsSource = readRepoFile("src/lib/platform-admin/tenants.ts");
  const setupSource = readRepoFile("src/lib/platform-admin/setup-completeness.ts");

  assert.match(tenantsSource, /export async function updatePlatformTenantImplementation/);
  assert.match(tenantsSource, /\.from\("tenant_settings"\)\.upsert/);
  assert.match(tenantsSource, /category: "implementation"/);
  assert.match(tenantsSource, /key: "type"/);
  assert.match(tenantsSource, /\.eq\("tenant_id", tenant\.id\)/);
  assert.match(setupSource, /getTenantImplementationType/);
  assert.doesNotMatch(setupSource, /domainType.*implementationType|implementationType.*domainType/);
});

test("activation warning and admin assignment are exact-tenant scoped", () => {
  const tenantsSource = readRepoFile("src/lib/platform-admin/tenants.ts");
  const actionsSource = readRepoFile("src/app/platform-admin/(protected)/businesses/actions.ts");
  const detailPage = readRepoFile("src/app/platform-admin/(protected)/businesses/[tenantId]/page.tsx");

  assert.match(tenantsSource, /requireActivationAcknowledgementIfIncomplete/);
  assert.match(tenantsSource, /buildTenantSetupSummary/);
  assert.match(actionsSource, /acknowledgeIncompleteSetup/);
  assert.match(detailPage, /acknowledgeIncompleteSetup/);
  assert.match(tenantsSource, /export async function assignExistingUserAsBusinessAdmin/);
  assert.match(tenantsSource, /supabaseAdmin\.auth\.admin\.listUsers/);
  assert.match(tenantsSource, /\.from\("business_admin_memberships"\)/);
  assert.match(tenantsSource, /\.eq\("business_id", tenant\.id\)/);
  assert.match(tenantsSource, /\.eq\("auth_user_id", user\.id\)/);
  assert.doesNotMatch(tenantsSource, /createUser|inviteUserByEmail/);
});

test("launch readiness links missing items to setup checklist cards from shared setup state", () => {
  const detailPage = readRepoFile("src/app/platform-admin/(protected)/businesses/[tenantId]/page.tsx");

  assert.match(detailPage, /function getSetupAreaElementId\(areaKey: SetupAreaKey\)/);
  assert.match(detailPage, /return `setup-area-\$\{areaKey\}`/);
  assert.match(detailPage, /const missingAreas = tenant\.setup\.missingRequiredAreas/);
  assert.match(detailPage, /href=\{`#\$\{getSetupAreaElementId\(area\.key\)\}`\}/);
  assert.match(detailPage, /id=\{getSetupAreaElementId\(area\.key\)\}/);
  assert.match(detailPage, /id="setup-checklist"/);
  assert.match(detailPage, /href="#setup-checklist"/);
});

test("setup cards expose responsibility and safe next steps without business-admin impersonation", () => {
  const detailPage = readRepoFile("src/app/platform-admin/(protected)/businesses/[tenantId]/page.tsx");

  assert.match(detailPage, /responsibilityLabel: "Platform Admin action"/);
  assert.match(detailPage, /responsibilityLabel: "Business Admin action"/);
  assert.match(detailPage, /"No action needed"/);
  assert.match(detailPage, /Business Admin -> Settings/);
  assert.match(detailPage, /Business Admin -> Pricing/);
  assert.match(detailPage, /Business Admin -> Service Area/);
  assert.match(detailPage, /Business Admin -> Dumpsters/);
  assert.match(detailPage, /Business Admin -> Content/);
  assert.match(detailPage, /href: `\/platform-admin\/businesses\/\$\{tenantId\}\/edit`/);
  assert.match(detailPage, /href: "#business-admin-access"/);
  assert.match(detailPage, /href: "#public-domains"/);
  assert.doesNotMatch(detailPage, /href=\{?["'`]\/admin/);
  assert.doesNotMatch(detailPage, /impersonat|tenant switch|switchTenant|businessId=.*\/admin|tenantId=.*\/admin/i);
});

test("brand readiness follows bootstrap settings and keeps header contact settings optional", () => {
  const setupSource = readRepoFile("src/lib/platform-admin/setup-completeness.ts");
  const retailSettings = readRepoFile("src/lib/tenant/retail-site-settings.ts");
  const tenantMutationMigration = readRepoFile("supabase/migrations/202608060101_platform_admin_tenant_mutations.sql");

  assert.match(setupSource, /getBrandContactSettingsArea/);
  assert.match(setupSource, /getSettingString\(signals\.settings, "brand\.name"\)/);
  assert.match(setupSource, /getSettingString\(signals\.settings, "support\.timezone"\)/);
  assert.match(setupSource, /getSettingString\(signals\.settings, "runtime\.storageNamespace"\)/);
  assert.doesNotMatch(setupSource, /support\.email or support\.phone/);
  assert.doesNotMatch(setupSource, /getSettingString\(signals\.settings, "support\.(?:email|phone)"\)/);
  assert.match(setupSource, /Phone and email are optional customer-facing contact details/);
  assert.match(retailSettings, /category: SETTINGS_CATEGORY_HEADER,\s+key: "phoneNumber"/);
  assert.match(retailSettings, /category: SETTINGS_CATEGORY_HEADER,\s+key: "emailAddress"/);
  assert.match(tenantMutationMigration, /\(created_tenant_id, 'brand', 'name'/);
  assert.match(tenantMutationMigration, /\(created_tenant_id, 'support', 'timezone'/);
  assert.match(tenantMutationMigration, /\(created_tenant_id, 'runtime', 'storageNamespace'/);
});

test("launch readiness success messaging matches lifecycle and incomplete states stay warnings", () => {
  const detailPage = readRepoFile("src/app/platform-admin/(protected)/businesses/[tenantId]/page.tsx");

  assert.match(detailPage, /function launchReadinessSuccessMessage/);
  assert.match(detailPage, /case "ready_to_launch":[\s\S]*This business is ready to launch/);
  assert.match(detailPage, /case "active":[\s\S]*this business is active/);
  assert.match(detailPage, /case "active_setup_incomplete":[\s\S]*return null/);
  assert.match(detailPage, /case "in_progress":[\s\S]*return null/);
  assert.match(detailPage, /const successMessage = launchReadinessSuccessMessage\(tenant\.setup\.readinessStatus\)/);
  assert.match(detailPage, /\) : successMessage \? \(/);
  assert.match(detailPage, /Missing required setup/);
  assert.doesNotMatch(detailPage, /Keep the business inactive until you explicitly launch it/);
});
