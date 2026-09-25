import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const holdRoute = readFileSync("src/app/api/hold/route.ts", "utf8");
const confirmBookingRoute = readFileSync("src/app/api/confirm-booking/route.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260925001459_production_access_hardening.sql",
  "utf8",
);

test("public booking mutations use the server-owned Supabase client", () => {
  assert.match(holdRoute, /import \{ supabaseAdmin \} from "@\/lib\/supabaseAdmin"/);
  assert.doesNotMatch(holdRoute, /from "@\/lib\/supabase"/);
  assert.doesNotMatch(confirmBookingRoute, /from "@\/lib\/supabase"/);
});

test("production data tables enable RLS and remove direct public role access", () => {
  const protectedTables = [
    "entity_history",
    "customers_legacy_derived",
    "pricing_defaults",
    "tenants",
    "tenant_content_entries",
    "booking_messages",
    "booking_holds",
    "dumpsters",
    "dumpster_product_settings",
    "bookings",
    "pricing_settings",
    "booking_events",
  ];

  for (const table of protectedTables) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(
      migration,
      new RegExp(`revoke all privileges on table public\\.${table} from anon, authenticated`),
    );
  }

  assert.match(migration, /alter view public\.customer_rollups set \(security_invoker = true\)/);
  assert.match(
    migration,
    /revoke all privileges on table public\.customer_rollups from anon, authenticated/,
  );
});

test("server-owned security definer functions are service-role only", () => {
  const functions = [
    "expire_active_holds_for_client",
    "get_delivery_availability",
    "next_tight_date",
    "get_admin_reports_business_metrics",
    "get_admin_reports_website_funnel_metrics",
    "record_external_booking_charge_payment",
  ];

  for (const functionName of functions) {
    const start = migration.indexOf(`revoke all on function public.${functionName}`);
    assert.notEqual(start, -1, `${functionName} must revoke public execution`);
    const grant = migration.indexOf(`grant execute on function public.${functionName}`, start);
    assert.notEqual(grant, -1, `${functionName} must grant service-role execution`);
    assert.match(migration.slice(start, grant), /from public, anon, authenticated/);
    assert.match(migration.slice(grant), /to service_role/);
  }
});
