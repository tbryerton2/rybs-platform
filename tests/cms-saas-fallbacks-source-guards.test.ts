import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

const cmsFallbackFiles = [
  "src/lib/admin/cms.ts",
  "src/lib/tenant/content.ts",
  "src/app/home-page-client.tsx",
  "src/app/admin/(protected)/settings/retail-site/retail-site-settings-editor.tsx",
];

test("shared CMS and public fallbacks are neutral for new tenants", () => {
  const unsafeFallbackPhrases =
    /Tan Can Man|Central New York|CNY|Syracuse|Onondaga|Madison|Next-day|Fully insured|Family owned|Locally owned|No hidden|same-day|Oneida|Utica|Rome|Cazenovia|Chittenango|Canastota|Hamilton|\+1-315/i;

  for (const file of cmsFallbackFiles) {
    const source = readRepoFile(file);
    assert.doesNotMatch(source, unsafeFallbackPhrases, `${file} contains an unsafe shared fallback phrase`);
  }

  const adminCms = readRepoFile("src/lib/admin/cms.ts");
  const publicContent = readRepoFile("src/lib/tenant/content.ts");

  assert.match(adminCms, /Reliable dumpster rental made simple/);
  assert.match(publicContent, /Reliable dumpster rental made simple/);
  assert.match(adminCms, /areaPills: \[\]/);
  assert.match(publicContent, /areaPills: \[\]/);
  assert.match(publicContent, /Why choose us\?/);
});

test("claim-based defaults are opt-in or neutral instead of factual assertions", () => {
  const adminCms = readRepoFile("src/lib/admin/cms.ts");
  const publicContent = readRepoFile("src/lib/tenant/content.ts");

  assert.match(adminCms, /const HOME_STATS_BAR_DEFAULT[\s\S]*enabled: false/);
  assert.match(publicContent, /const HOME_STATS_BAR_FALLBACK[\s\S]*enabled: false/);
  assert.match(adminCms, /text: ""/);
  assert.match(publicContent, /text: ""/);
  assert.match(publicContent, /Delivery timing depends on local availability/);
  assert.match(publicContent, /Additional charges may apply according to configured pricing/);
});

test("opening the admin CMS page does not create tenant content rows", () => {
  const page = readRepoFile("src/app/admin/(protected)/cms/page.tsx");
  const adminCms = readRepoFile("src/lib/admin/cms.ts");

  assert.match(page, /getRetailSiteCmsInitialStateForTenant\(adminSession\.business\.id\)/);
  assert.doesNotMatch(page, /tenant_content_entries[\s\S]*\.(insert|upsert|update)\(/);
  assert.doesNotMatch(adminCms, /\.(insert|upsert|update)\(/);
});

test("saved Tan Can Man content still overrides shared defaults by exact tenant id", () => {
  const adminCms = readRepoFile("src/lib/admin/cms.ts");
  const tenantServer = readRepoFile("src/lib/tenant/server.ts");

  assert.match(adminCms, /getRetailSiteCmsInitialStateForTenant\(\s*tenantId: string/);
  assert.match(adminCms, /getTenantContentDraftFirstForTenant\(tenantId, "content\.home\.hero"\)/);
  assert.match(adminCms, /value: normalizeHero\(value\)/);
  assert.match(tenantServer, /\.from\("tenant_content_entries"\)[\s\S]*\.eq\("tenant_id", tenantId\)[\s\S]*\.eq\("status", status\)/);
});

test("CMS source state distinguishes default, draft, and published rows", () => {
  const adminCms = readRepoFile("src/lib/admin/cms.ts");
  const editor = readRepoFile("src/app/admin/(protected)/cms/retail-site/retail-site-cms-editor.tsx");

  assert.match(adminCms, /source: "default" \| "draft" \| "published"/);
  assert.match(adminCms, /function getEntrySource/);
  assert.match(adminCms, /return "default"/);
  assert.match(adminCms, /return "draft"/);
  assert.match(adminCms, /return "published"/);
  assert.match(editor, /type CmsSourceLabel = "Using default" \| "Draft" \| "Published"/);
  assert.match(editor, /function SourceBadge/);
  assert.match(editor, /return "Using default"/);
  assert.match(editor, /status\?\.source === "draft"/);
  assert.match(editor, /status\?\.source === "published"/);
});

test("saving CMS content uses the authenticated business id, not a submitted tenant id", () => {
  const route = readRepoFile("src/app/api/admin/cms/retail-site/route.ts");

  assert.match(route, /const businessId = adminAuth\.session\.business\.id/);
  assert.match(route, /tenant_id: businessId/);
  assert.doesNotMatch(route, /body\.tenantId|body\.businessId|searchParams\.get\(["']tenantId["']\)|searchParams\.get\(["']businessId["']\)/);
});

test("setup completeness treats CMS defaults as conditional launch requirements", () => {
  const setupCompleteness = readRepoFile("src/lib/platform-admin/setup-completeness.ts");

  assert.match(setupCompleteness, /publishedContentCount > 0/);
  assert.match(setupCompleteness, /status: required \? "needs_attention" : "using_defaults"/);
  assert.match(setupCompleteness, /implementationType === "existing_site_hosted_booking"/);
  assert.match(setupCompleteness, /status: "not_applicable"/);
});
