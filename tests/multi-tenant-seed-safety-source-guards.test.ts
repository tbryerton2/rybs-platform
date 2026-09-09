import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const seedSql = readFileSync(resolve(repoRoot, "supabase/seed.sql"), "utf8");

function insertColumns(tableName: string) {
  const pattern = new RegExp(`insert into public\\.${tableName} \\((?<columns>[\\s\\S]*?)\\)\\s`, "m");
  const match = seedSql.match(pattern);
  assert.ok(match?.groups?.columns, `Expected seed insert for public.${tableName}`);

  return match.groups.columns
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);
}

test("local seed resolves Tan Can Man explicitly instead of falling back to the first tenant", () => {
  assert.match(seedSql, /where slug = 'tan-can-man'/);
  assert.match(seedSql, /Local seed requires tenant slug tan-can-man to exist/);
  assert.doesNotMatch(seedSql, /fallback_business/);
  assert.doesNotMatch(seedSql, /order by created_at asc/);
});

test("local seed writes business ownership for hardened business-scoped records", () => {
  for (const tableName of [
    "pricing_settings",
    "customers",
    "customer_locations",
    "bookings",
    "rental_action_requests",
    "booking_holds",
  ]) {
    assert.ok(
      insertColumns(tableName).includes("business_id"),
      `Expected public.${tableName} seed insert to include business_id`,
    );
  }

  assert.match(seedSql, /\(select id from public\.tenants where slug = 'tan-can-man'\)/);
  assert.match(seedSql, /\(select id from public\.tenants where slug = 'demo-dumpster-co'\)/);
});
