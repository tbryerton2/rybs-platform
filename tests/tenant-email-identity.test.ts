import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  deriveTenantEmailFromAddress,
  getTenantEmailIdentityByBusinessId,
  normalizeTenantEmailSenderDomain,
  normalizeTenantEmailSenderLocalPart,
  setTenantEmailIdentitySupabaseClientForTesting,
} from "../src/lib/email/tenant-email-identity.ts";

const repoRoot = resolve(import.meta.dirname, "..");
const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";

type Row = Record<string, unknown>;
type Filter = { column: string; value: unknown };

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function tenantEmailIdentityRow(overrides: Row = {}): Row {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    business_id: BUSINESS_ID,
    sender_domain: "demodumpstercompany.com",
    sender_local_part: "bookings",
    sender_display_name: "Demo Dumpster Company",
    reply_to_email: "owner@demodumpstercompany.com",
    provider: "ses",
    provider_status: "pending",
    verification_status: "dns_required",
    ses_region: null,
    dkim_tokens: ["token-a", " token-b "],
    dns_instructions: { records: [] },
    last_checked_at: null,
    last_error: null,
    created_at: "2026-08-19T12:00:00.000Z",
    updated_at: "2026-08-19T12:00:00.000Z",
    ...overrides,
  };
}

function matches(row: Row, filters: Filter[]) {
  return filters.every((filter) => row[filter.column] === filter.value);
}

function createMockSupabase(rows: Row[]) {
  const filters: Filter[] = [];

  const client = {
    from(table: "tenant_email_identities") {
      assert.equal(table, "tenant_email_identities");
      return {
        select(columns: string) {
          assert.match(columns, /sender_domain/);
          return {
            eq(column: string, value: string) {
              filters.push({ column, value });
              return this;
            },
            async maybeSingle() {
              return {
                data: rows.find((row) => matches(row, filters)) ?? null,
                error: null,
              };
            },
          };
        },
      };
    },
  };

  return {
    client: client as Parameters<typeof setTenantEmailIdentitySupabaseClientForTesting>[0],
    filters,
  };
}

afterEach(() => {
  setTenantEmailIdentitySupabaseClientForTesting(null);
});

test("tenant email identity lookup is scoped by business_id and derives the From address", async () => {
  const mock = createMockSupabase([tenantEmailIdentityRow()]);
  setTenantEmailIdentitySupabaseClientForTesting(mock.client);

  const identity = await getTenantEmailIdentityByBusinessId(BUSINESS_ID);

  assert.equal(mock.filters[0]?.column, "business_id");
  assert.equal(mock.filters[0]?.value, BUSINESS_ID);
  assert.equal(identity?.businessId, BUSINESS_ID);
  assert.equal(identity?.senderDomain, "demodumpstercompany.com");
  assert.equal(identity?.senderLocalPart, "bookings");
  assert.equal(identity?.fromEmail, "bookings@demodumpstercompany.com");
  assert.equal(identity?.senderDisplayName, "Demo Dumpster Company");
  assert.equal(identity?.replyToEmail, "owner@demodumpstercompany.com");
  assert.equal(identity?.providerStatus, "pending");
  assert.equal(identity?.verificationStatus, "dns_required");
  assert.deepEqual(identity?.dkimTokens, ["token-a", "token-b"]);
});

test("tenant email identity lookup returns null when a business has no identity", async () => {
  const mock = createMockSupabase([]);
  setTenantEmailIdentitySupabaseClientForTesting(mock.client);

  await assert.doesNotReject(() => getTenantEmailIdentityByBusinessId(BUSINESS_ID));
  assert.equal(await getTenantEmailIdentityByBusinessId(BUSINESS_ID), null);
});

test("sender domain and local part normalization are conservative", () => {
  assert.equal(normalizeTenantEmailSenderDomain(" DemoDumpsterCompany.COM "), "demodumpstercompany.com");
  assert.equal(normalizeTenantEmailSenderDomain("https://demodumpstercompany.com"), null);
  assert.equal(normalizeTenantEmailSenderDomain("demo.example.com/path"), null);
  assert.equal(normalizeTenantEmailSenderDomain("localhost"), null);

  assert.equal(normalizeTenantEmailSenderLocalPart(" Bookings "), "bookings");
  assert.equal(normalizeTenantEmailSenderLocalPart("booking.alerts"), "booking.alerts");
  assert.equal(normalizeTenantEmailSenderLocalPart(".bookings"), null);
  assert.equal(normalizeTenantEmailSenderLocalPart("booking..alerts"), null);
  assert.equal(normalizeTenantEmailSenderLocalPart("bookings@demo.com"), null);
});

test("From address is derived only from valid sender parts", () => {
  assert.equal(
    deriveTenantEmailFromAddress({
      senderLocalPart: "Bookings",
      senderDomain: "DemoDumpsterCompany.COM",
    }),
    "bookings@demodumpstercompany.com",
  );
  assert.equal(
    deriveTenantEmailFromAddress({
      senderLocalPart: "bookings@demo.com",
      senderDomain: "demodumpstercompany.com",
    }),
    null,
  );
});

test("migration enforces tenant ownership, normalized unique domains, and one identity per tenant", () => {
  const migration = readRepoFile("supabase/migrations/202608190101_tenant_email_identities.sql");

  assert.match(migration, /create table if not exists public\.tenant_email_identities/);
  assert.match(migration, /business_id uuid not null references public\.tenants \(id\) on delete cascade/);
  assert.match(migration, /constraint tenant_email_identities_business_unique unique \(business_id\)/);
  assert.match(migration, /constraint tenant_email_identities_sender_domain_unique unique \(sender_domain\)/);
  assert.match(migration, /sender_domain = lower\(sender_domain\)/);
  assert.match(migration, /new\.sender_domain = lower\(btrim\(new\.sender_domain\)\)/);
  assert.match(migration, /sender_local_part ~ '\^\[a-z0-9\]\[a-z0-9\._\+-\]\{0,63\}\$'/);
  assert.match(migration, /provider_status in \('pending', 'dns_required', 'verified', 'failed', 'disabled'\)/);
  assert.match(migration, /verification_status in \('pending', 'dns_required', 'verified', 'failed', 'disabled'\)/);
  assert.match(migration, /alter table public\.tenant_email_identities enable row level security/);
  assert.match(migration, /revoke all on table public\.tenant_email_identities from authenticated/);
});

test("migration seeds Tan Can Man as pending without hardcoding a new Reply-To", () => {
  const migration = readRepoFile("supabase/migrations/202608190101_tenant_email_identities.sql");

  assert.match(migration, /where slug = 'tan-can-man'/);
  assert.match(migration, /'tancanman\.com'/);
  assert.match(migration, /'bookings'/);
  assert.match(migration, /'Tan Can Man'/);
  assert.match(migration, /where tenant_settings\.category = 'support'\s+and tenant_settings\.key = 'email'/);
  assert.match(migration, /'pending',\s+'pending'/);
  assert.doesNotMatch(migration, /info@tancanman\.com/);
  assert.doesNotMatch(migration, /verified',\s+'verified'/);
});
