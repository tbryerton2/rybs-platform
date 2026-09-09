import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("tenant payment provider connection migration stores Square ownership per business without seeded tokens", () => {
  const migration = readRepoFile(
    "supabase/migrations/20260909005031_tenant_payment_provider_connections.sql",
  );

  assert.match(migration, /create table if not exists public\.tenant_payment_provider_connections/);
  assert.match(migration, /business_id uuid not null references public\.tenants \(id\) on delete cascade/);
  assert.match(migration, /provider text not null default 'square'/);
  assert.match(migration, /provider_merchant_id text/);
  assert.match(migration, /provider_location_id text/);
  assert.match(migration, /encrypted_access_token text/);
  assert.match(migration, /encrypted_refresh_token text/);
  assert.match(migration, /token_cipher_key_id text/);
  assert.match(
    migration,
    /tenant_payment_provider_connections_active_business_provider_unique/,
  );
  assert.match(
    migration,
    /tenant_payment_provider_connections_active_merchant_unique/,
  );
  assert.doesNotMatch(migration, /insert\s+into\s+public\.tenant_payment_provider_connections/i);
  assert.doesNotMatch(migration, /SQUARE_ACCESS_TOKEN/);
});

test("tenant payment provider connection table is server-owned behind RLS", () => {
  const migration = readRepoFile(
    "supabase/migrations/20260909005031_tenant_payment_provider_connections.sql",
  );

  assert.match(
    migration,
    /alter table public\.tenant_payment_provider_connections enable row level security/,
  );
  assert.match(
    migration,
    /revoke all on table public\.tenant_payment_provider_connections from public/,
  );
  assert.match(
    migration,
    /revoke all on table public\.tenant_payment_provider_connections from anon/,
  );
  assert.match(
    migration,
    /revoke all on table public\.tenant_payment_provider_connections from authenticated/,
  );
  assert.match(
    migration,
    /grant all on table public\.tenant_payment_provider_connections to service_role/,
  );
});

test("Square payment records gain connection and merchant scoping", () => {
  const migration = readRepoFile(
    "supabase/migrations/20260909005031_tenant_payment_provider_connections.sql",
  );

  for (const table of [
    "booking_payments",
    "customer_provider_accounts",
    "customer_payment_methods",
    "booking_charges",
    "payment_exceptions",
    "square_webhook_events",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `alter table public\\.${table}[\\s\\S]*add column if not exists payment_provider_connection_id uuid references public\\.tenant_payment_provider_connections \\(id\\) on delete set null`,
      ),
      `${table} should reference tenant payment provider connections`,
    );
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table}[\\s\\S]*add column if not exists provider_merchant_id text`),
      `${table} should capture provider merchant ids`,
    );
  }

  assert.match(
    migration,
    /drop index if exists customer_provider_accounts_provider_customer_unique/,
  );
  assert.match(
    migration,
    /drop constraint if exists customer_payment_methods_provider_payment_method_unique/,
  );
  assert.match(
    migration,
    /customer_provider_accounts_connection_provider_customer_unique/,
  );
  assert.match(
    migration,
    /customer_payment_methods_connection_payment_method_unique/,
  );
  assert.match(migration, /square_webhook_events_merchant_payment_idx/);
});
