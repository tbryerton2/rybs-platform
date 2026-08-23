import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const {
  resolveTenantEmailSender,
  TenantEmailSenderError,
} = await import("../src/lib/email/tenant-sender.ts");
const {
  setTenantEmailIdentitySupabaseClientForTesting,
} = await import("../src/lib/email/tenant-email-identity.ts");

const TAN_BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const DEMO_BUSINESS_ID = "22222222-2222-4222-8222-222222222222";

type Row = Record<string, unknown>;
type Filter = { column: string; value: unknown };

function tenant(id: string, slug: string) {
  return {
    id,
    slug,
    status: "active" as const,
    created_at: "2026-08-19T12:00:00.000Z",
    updated_at: "2026-08-19T12:00:00.000Z",
  };
}

function identityRow(overrides: Row = {}): Row {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    business_id: TAN_BUSINESS_ID,
    sender_domain: "tancanman.com",
    sender_local_part: "bookings",
    sender_display_name: "Tan Can Man",
    reply_to_email: "support@tancanman.com",
    provider: "ses",
    provider_status: "verified",
    verification_status: "verified",
    ses_region: "us-east-1",
    dkim_tokens: [],
    dns_instructions: null,
    last_checked_at: "2026-08-19T12:00:00.000Z",
    last_error: null,
    created_at: "2026-08-19T12:00:00.000Z",
    updated_at: "2026-08-19T12:00:00.000Z",
    ...overrides,
  };
}

function matches(row: Row, filters: Filter[]) {
  return filters.every((filter) => row[filter.column] === filter.value);
}

function createMockSupabase(rows: Row[], options: { ignoreFilters?: boolean } = {}) {
  const filters: Filter[] = [];

  const client = {
    from(table: "tenant_email_identities") {
      assert.equal(table, "tenant_email_identities");
      return {
        select() {
          return {
            eq(column: string, value: string) {
              filters.push({ column, value });
              return this;
            },
            async maybeSingle() {
              return {
                data: options.ignoreFilters
                  ? rows[0] ?? null
                  : rows.find((row) => matches(row, filters)) ?? null,
                error: null,
              };
            },
          };
        },
      };
    },
  };

  return {
    client: client as never,
    filters,
  };
}

afterEach(() => {
  setTenantEmailIdentitySupabaseClientForTesting(null);
});

test("Tan Can Man verified identity resolves to branded From sender", async () => {
  const mock = createMockSupabase([identityRow()]);
  setTenantEmailIdentitySupabaseClientForTesting(mock.client);

  const sender = await resolveTenantEmailSender({
    tenant: tenant(TAN_BUSINESS_ID, "tan-can-man"),
    businessName: "Tan Can Man",
    supportEmail: "fallback@tancanman.com",
  });

  assert.equal(mock.filters[0]?.column, "business_id");
  assert.equal(mock.filters[0]?.value, TAN_BUSINESS_ID);
  assert.equal(sender.senderDisplayName, "Tan Can Man");
  assert.equal(sender.senderEmail, "bookings@tancanman.com");
  assert.equal(sender.formattedFrom, '"Tan Can Man" <bookings@tancanman.com>');
  assert.equal(sender.replyToEmail, "support@tancanman.com");
  assert.equal(sender.sesRegion, "us-east-1");
  assert.equal(sender.verificationStatus, "verified");
});

test("Demo without verified identity does not fall back to Tan Can Man", async () => {
  const mock = createMockSupabase([
    identityRow({
      business_id: DEMO_BUSINESS_ID,
      sender_domain: "demodumpstercompany.com",
      sender_display_name: "Demo Dumpster Company",
      provider_status: "pending",
      verification_status: "pending",
    }),
  ]);
  setTenantEmailIdentitySupabaseClientForTesting(mock.client);

  await assert.rejects(
    () => resolveTenantEmailSender({
      tenant: tenant(DEMO_BUSINESS_ID, "demo-dumpster-company"),
      businessName: "Demo Dumpster Company",
      supportEmail: "support@demo.example",
    }),
    (error) => {
      assert.ok(error instanceof TenantEmailSenderError);
      assert.equal(error.code, "not_verified");
      assert.equal(error.message, "Tenant email sender is not verified.");
      return true;
    },
  );
});

test("one tenant cannot use another tenant sender identity", async () => {
  const mock = createMockSupabase([identityRow({ business_id: TAN_BUSINESS_ID })], {
    ignoreFilters: true,
  });
  setTenantEmailIdentitySupabaseClientForTesting(mock.client);

  await assert.rejects(
    () => resolveTenantEmailSender({
      tenant: tenant(DEMO_BUSINESS_ID, "demo-dumpster-company"),
      businessName: "Demo Dumpster Company",
      supportEmail: "support@demo.example",
    }),
    /Tenant email sender is not verified/,
  );
});

test("Reply-To falls back to tenant support email when identity reply-to is empty", async () => {
  const mock = createMockSupabase([
    identityRow({
      reply_to_email: null,
    }),
  ]);
  setTenantEmailIdentitySupabaseClientForTesting(mock.client);

  const sender = await resolveTenantEmailSender({
    tenant: tenant(TAN_BUSINESS_ID, "tan-can-man"),
    businessName: "Tan Can Man",
    supportEmail: "support-fallback@tancanman.com",
  });

  assert.equal(sender.replyToEmail, "support-fallback@tancanman.com");
});
