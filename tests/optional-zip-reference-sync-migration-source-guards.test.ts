import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260929004411_repair_optional_zip_reference_sync.sql",
  "utf8",
);

test("optional ZIP coordinate sync avoids static references to an absent source table", () => {
  assert.match(migration, /create or replace function public\.sync_service_area_zip_coordinates\(\)/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /source_table regclass := to_regclass\('public\.zip_reference'\)/);
  assert.match(migration, /destination_table regclass := to_regclass\('public\.service_area_zips'\)/);
  assert.match(migration, /if source_table is null or destination_table is null then/);
  assert.match(
    migration,
    /execute format\(\$update\$[\s\S]*update %s as saz[\s\S]*from %s as zr[\s\S]*destination_table, source_table\)/,
  );
});

test("optional ZIP coordinate sync is service-role only", () => {
  assert.match(
    migration,
    /revoke all on function public\.sync_service_area_zip_coordinates\(\)[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.sync_service_area_zip_coordinates\(\)[\s\S]*to service_role/,
  );
});
