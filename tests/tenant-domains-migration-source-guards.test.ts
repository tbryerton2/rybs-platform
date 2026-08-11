import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("tenant_domains migration is additive and enforces exact hostname ownership", () => {
  const source = readRepoFile("supabase/migrations/202608100101_tenant_domains.sql");

  assert.match(source, /create table if not exists public\.tenant_domains/);
  assert.match(source, /tenant_id uuid not null references public\.tenants \(id\)/);
  assert.match(source, /constraint tenant_domains_hostname_unique unique \(hostname\)/);
  assert.match(source, /hostname = lower\(hostname\)/);
  assert.match(source, /hostname !~ '\[:\/\?#\]'/);
  assert.match(source, /domain_type in \('platform_subdomain', 'custom_domain', 'booking_domain'\)/);
  assert.match(source, /status in \('active', 'pending', 'disabled'\)/);
  assert.match(source, /tenant_domains_one_primary_per_tenant_idx/);
  assert.doesNotMatch(source, /\binsert\s+into\s+public\.(tenants|tenant_domains)\b/i);
  assert.doesNotMatch(source, /\bupdate\s+public\.tenants\b/i);
  assert.doesNotMatch(source, /\bdelete\s+from\s+public\.tenants\b/i);
});

test("active and disabled domain resolution are explicit in server code", () => {
  const source = readRepoFile("src/lib/tenant/server.ts");

  assert.match(source, /\.from\("tenant_domains"\)/);
  assert.match(source, /\.eq\("hostname", hostname\)/);
  assert.match(source, /throw createHostnameUnknownError\(hostname\)/);
  assert.match(source, /throw createDomainDisabledError\(hostname\)/);
  assert.match(source, /throw createDomainTenantInactiveError\(hostname\)/);
  assert.doesNotMatch(source, /order\("created_at"/);
  assert.doesNotMatch(source, /limit\(1\)/);
});
