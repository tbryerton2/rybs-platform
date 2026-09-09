import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const seedSql = readFileSync(resolve(repoRoot, "supabase/seed.sql"), "utf8");

test("local seed creates Demo Dumpster Company as a normal active tenant", () => {
  assert.match(seedSql, /create temporary table seed_demo_dumpster_business/);
  assert.match(seedSql, /'demo-dumpster-co'/);
  assert.match(seedSql, /'Demo Dumpster Company'/);
  assert.match(seedSql, /'runtime', 'storageNamespace', to_jsonb\('demo_dumpster_company'::text\)/);
  assert.match(seedSql, /'implementation', 'type', to_jsonb\('full_site_platform_subdomain'::text\)/);
  assert.match(seedSql, /'demo-dumpster-co\.localhost'/);
});

test("local Demo fixture includes tenant-owned launch configuration", () => {
  assert.match(seedSql, /insert into public\.tenant_settings/);
  assert.match(seedSql, /insert into public\.tenant_content_entries/);
  assert.match(seedSql, /insert into public\.service_area_zips \(business_id, zip, active, county, town\)/);
  assert.match(seedSql, /insert into public\.pricing_settings \([\s\S]*business_id/);
  assert.match(seedSql, /insert into public\.dumpster_product_settings \([\s\S]*business_id/);
  assert.match(seedSql, /'demo-12-yard'/);
  assert.match(seedSql, /'demo-20-yard'/);
});

test("local Demo fixture includes admin access and operational demo data", () => {
  assert.match(seedSql, /insert into auth\.users/);
  assert.match(seedSql, /'demo\.admin@demo-dumpster-company\.local'/);
  assert.match(seedSql, /insert into auth\.identities/);
  assert.match(seedSql, /insert into public\.business_admin_memberships/);
  assert.match(seedSql, /insert into public\.customers \([\s\S]*business_id/);
  assert.match(seedSql, /insert into public\.customer_locations \([\s\S]*business_id/);
  assert.match(seedSql, /'21200000-0000-4000-8000-000000000001'/);
  assert.match(seedSql, /'21500000-0000-4000-8000-000000000001'/);
});

test("local Demo fixture does not reuse Tan Can Man ownership or Square fallback credentials", () => {
  assert.doesNotMatch(seedSql, /SQUARE_ACCESS_TOKEN|SQUARE_LOCATION_ID|SQUARE_APPLICATION_ID/);

  const demoBlock = seedSql.slice(
    seedSql.indexOf("with seeded_demo as"),
    seedSql.indexOf("-- Tan Can Man QA fixture data."),
  );
  assert.match(demoBlock, /from seed_demo_dumpster_business demo/);
  assert.doesNotMatch(demoBlock, /\(select id from seed_tan_can_man_business\)/);
});
