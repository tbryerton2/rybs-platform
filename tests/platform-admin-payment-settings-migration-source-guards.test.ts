import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const migration = readFileSync(
  resolve(repoRoot, "supabase/migrations/20260929002251_tenant_payment_settings_policy.sql"),
  "utf8",
);

test("tenant payment settings migration creates constrained server-owned settings", () => {
  assert.match(migration, /create table if not exists public\.tenant_payment_settings/);
  assert.match(migration, /id uuid primary key default gen_random_uuid\(\)/);
  assert.match(migration, /business_id uuid not null references public\.tenants \(id\) on delete cascade/);
  assert.match(migration, /provider text not null default 'square'[\s\S]*check \(provider in \('square'\)\)/);
  assert.match(
    migration,
    /mode text not null default 'disabled'[\s\S]*check \(mode in \('disabled', 'sandbox', 'production'\)\)/,
  );
  assert.match(migration, /updated_by uuid references auth\.users \(id\) on delete set null/);
  assert.match(migration, /constraint tenant_payment_settings_business_provider_unique[\s\S]*unique \(business_id, provider\)/);
  assert.match(migration, /tenant_payment_settings_set_updated_at/);
});

test("tenant payment setting events are append-only and audited by platform-admin user", () => {
  assert.match(migration, /create table if not exists public\.tenant_payment_setting_events/);
  assert.match(migration, /previous_mode text not null[\s\S]*check \(previous_mode in \('disabled', 'sandbox', 'production'\)\)/);
  assert.match(migration, /new_mode text not null[\s\S]*check \(new_mode in \('disabled', 'sandbox', 'production'\)\)/);
  assert.match(
    migration,
    /actor_platform_admin_user_id uuid references auth\.users \(id\) on delete set null/,
  );
  assert.match(migration, /prevent_tenant_payment_setting_event_mutation/);
  assert.match(migration, /tenant_payment_setting_events_append_only_update/);
  assert.match(migration, /tenant_payment_setting_events_append_only_delete/);
});

test("payment settings tables are hidden from browser roles and granted only to service role", () => {
  for (const table of ["tenant_payment_settings", "tenant_payment_setting_events"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from authenticated`));
    assert.match(migration, new RegExp(`grant all on table public\\.${table} to service_role`));
  }
});

test("payment settings RPC is security-invoker and service-role only", () => {
  assert.match(
    migration,
    /create or replace function public\.platform_admin_set_tenant_payment_mode\([\s\S]*p_actor_auth_user_id uuid[\s\S]*\)/,
  );
  assert.match(migration, /security invoker/);
  assert.doesNotMatch(migration, /platform_admin_set_tenant_payment_mode[\s\S]*security definer/i);
  assert.match(
    migration,
    /perform 1[\s\S]*from public\.tenants[\s\S]*where tenants\.id = p_business_id/,
  );
  assert.match(migration, /TENANT_PAYMENT_SETTING_BUSINESS_NOT_FOUND/);
  assert.match(migration, /TENANT_PAYMENT_SETTING_INVALID_PROVIDER/);
  assert.match(migration, /TENANT_PAYMENT_SETTING_INVALID_MODE/);
  assert.match(
    migration,
    /pg_advisory_xact_lock\([\s\S]*hashtextextended\(p_business_id::text \|\| ':' \|\| p_provider, 0\)/,
  );
  assert.match(
    migration,
    /if p_mode = 'disabled' then[\s\S]*false;[\s\S]*return;[\s\S]*end if;[\s\S]*insert into public\.tenant_payment_settings/,
  );
  assert.match(migration, /if existing_setting\.mode = p_mode then[\s\S]*false;[\s\S]*return;/);
  assert.match(migration, /insert into public\.tenant_payment_setting_events/);
  assert.match(
    migration,
    /revoke all on function public\.platform_admin_set_tenant_payment_mode\(uuid, text, text, uuid\) from public/,
  );
  assert.match(
    migration,
    /revoke all on function public\.platform_admin_set_tenant_payment_mode\(uuid, text, text, uuid\) from anon/,
  );
  assert.match(
    migration,
    /revoke all on function public\.platform_admin_set_tenant_payment_mode\(uuid, text, text, uuid\) from authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.platform_admin_set_tenant_payment_mode\(uuid, text, text, uuid\) to service_role/,
  );
});

test("payment settings migration does not seed business-specific data or credentials", () => {
  assert.doesNotMatch(
    migration,
    /insert\s+into\s+public\.tenant_payment_settings[\s\S]*values\s*\(\s*'[0-9a-f-]{36}'/i,
  );
  assert.doesNotMatch(
    migration,
    /insert\s+into\s+public\.tenant_payment_setting_events[\s\S]*values\s*\(\s*'[0-9a-f-]{36}'/i,
  );
  assert.doesNotMatch(migration, /Demo Dumpster Company/i);
  assert.doesNotMatch(migration, /Demo Dumpster/i);
  assert.doesNotMatch(migration, /Tan Can Man/i);
  assert.doesNotMatch(migration, /22222222-2222-4222-8222-222222222222/);
  assert.doesNotMatch(migration, /SQUARE_ACCESS_TOKEN/);
  assert.doesNotMatch(migration, /encrypted_access_token/);
  assert.doesNotMatch(migration, /encrypted_refresh_token/);
});
