import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const {
  isSuitableTenantReplyToEmail,
  resolveTenantEmailSender,
  resolveTenantReplyToEmail,
  TenantEmailSenderError,
  tenantSenderSendEmailOptions,
} = await import("../src/lib/email/tenant-sender.ts");
const {
  setTenantEmailIdentitySupabaseClientForTesting,
} = await import("../src/lib/email/tenant-email-identity.ts");

const TAN_BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const DEMO_BUSINESS_ID = "22222222-2222-4222-8222-222222222222";
const originalRybManagedFromEmail = process.env.RYBS_MANAGED_SES_FROM_EMAIL;
const originalRybManagedRegion = process.env.RYBS_MANAGED_SES_REGION;

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
  if (originalRybManagedFromEmail === undefined) {
    delete process.env.RYBS_MANAGED_SES_FROM_EMAIL;
  } else {
    process.env.RYBS_MANAGED_SES_FROM_EMAIL = originalRybManagedFromEmail;
  }
  if (originalRybManagedRegion === undefined) {
    delete process.env.RYBS_MANAGED_SES_REGION;
  } else {
    process.env.RYBS_MANAGED_SES_REGION = originalRybManagedRegion;
  }
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
  assert.equal(sender.source, "tenant_verified");
  assert.equal(sender.senderDisplayName, "Tan Can Man");
  assert.equal(sender.senderEmail, "bookings@tancanman.com");
  assert.equal(sender.formattedFrom, '"Tan Can Man" <bookings@tancanman.com>');
  assert.equal(sender.replyToEmail, "support@tancanman.com");
  assert.equal(sender.sesRegion, "us-east-1");
  assert.equal(sender.verificationStatus, "verified");
});

test("Demo without verified identity uses explicit RYBS managed sender", async () => {
  process.env.RYBS_MANAGED_SES_FROM_EMAIL = "bookings@mail.rybsoftware.com";
  process.env.RYBS_MANAGED_SES_REGION = "us-west-2";
  const mock = createMockSupabase([
    identityRow({
      business_id: DEMO_BUSINESS_ID,
      sender_domain: "demodumpstercompany.com",
      sender_display_name: "Demo Dumpster Company",
      reply_to_email: "support@demo.example",
      provider_status: "pending",
      verification_status: "pending",
    }),
  ]);
  setTenantEmailIdentitySupabaseClientForTesting(mock.client);

  const sender = await resolveTenantEmailSender({
    tenant: tenant(DEMO_BUSINESS_ID, "demo-dumpster-company"),
    businessName: "Demo Dumpster Company",
    supportEmail: "support@demo-dumpster.com",
  });

  assert.equal(sender.source, "rybs_managed");
  assert.equal(sender.senderDisplayName, "Demo Dumpster Company");
  assert.equal(sender.senderEmail, "bookings@mail.rybsoftware.com");
  assert.equal(sender.formattedFrom, '"Demo Dumpster Company" <bookings@mail.rybsoftware.com>');
  assert.equal(sender.replyToEmail, "support@demo-dumpster.com");
  assert.equal(sender.sesRegion, "us-west-2");
  assert.equal(sender.providerStatus, "verified");
  assert.equal(sender.verificationStatus, "verified");
});

test("Demo without verified identity fails closed when RYBS managed sender is missing", async () => {
  const mock = createMockSupabase([
    identityRow({
      business_id: DEMO_BUSINESS_ID,
      sender_domain: "demodumpstercompany.com",
      sender_display_name: "Demo Dumpster Company",
      provider_status: "dns_required",
      verification_status: "dns_required",
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

test("configured external Reply-To is independent of the sending domain", () => {
  assert.equal(
    resolveTenantReplyToEmail({
      identityReplyToEmail: " DemoDumpsterCompany@gmail.com ",
      supportEmail: "test@test.com",
    }),
    "demodumpstercompany@gmail.com",
  );
});

test("missing contact never falls back to a sending address", () => {
  process.env.RYBS_MANAGED_SES_FROM_EMAIL = "notifications@rybsoftware.com";
  assert.equal(
    resolveTenantReplyToEmail({
      identityReplyToEmail: null,
      supportEmail: null,
    }),
    null,
  );

  assert.equal(
    resolveTenantReplyToEmail({
      identityReplyToEmail: "no-reply@demodumpstercompany.com",
      supportEmail: "owner@gmail.com",
    }),
    "owner@gmail.com",
  );
});

test("tenant support email is accepted while placeholder addresses are rejected", () => {
  assert.equal(isSuitableTenantReplyToEmail("dispatch@demo-dumpster.com"), "dispatch@demo-dumpster.com");
  assert.equal(isSuitableTenantReplyToEmail("test@test.com"), null);
  assert.equal(isSuitableTenantReplyToEmail("hello@example.com"), null);
  assert.equal(isSuitableTenantReplyToEmail("hello@demo.local"), null);
});

test("pending tenant identity keeps external Reply-To with unchanged managed sender", async () => {
  process.env.RYBS_MANAGED_SES_FROM_EMAIL = "notifications@rybsoftware.com";
  process.env.RYBS_MANAGED_SES_REGION = "us-west-2";
  setTenantEmailIdentitySupabaseClientForTesting(createMockSupabase([identityRow({
    provider_status: "pending", verification_status: "pending", reply_to_email: "owner@gmail.com",
  })]).client);
  const sender = await resolveTenantEmailSender({
    tenant: tenant(TAN_BUSINESS_ID, "tan-can-man"), businessName: "Tan Can Man",
    supportEmail: "support@tancanman.com",
  });
  assert.deepEqual(tenantSenderSendEmailOptions(sender), {
    fromEmail: "notifications@rybsoftware.com", fromDisplayName: "Tan Can Man",
    replyTo: "owner@gmail.com", region: "us-west-2", useDefaultReplyTo: false,
  });
});

test("verified Demo sender keeps From, name and region with Gmail Reply-To", async () => {
  setTenantEmailIdentitySupabaseClientForTesting(createMockSupabase([identityRow({
    business_id: DEMO_BUSINESS_ID, sender_domain: "demo-mail.rybsoftware.com",
    sender_display_name: "Demo Dumpster Company", reply_to_email: "demodumpstercompany@gmail.com",
  })]).client);
  const sender = await resolveTenantEmailSender({
    tenant: tenant(DEMO_BUSINESS_ID, "demo-dumpster-co"), businessName: "Demo Dumpster Company",
    supportEmail: "different@gmail.com",
  });
  assert.deepEqual(tenantSenderSendEmailOptions(sender), {
    fromEmail: "bookings@demo-mail.rybsoftware.com", fromDisplayName: "Demo Dumpster Company",
    replyTo: "demodumpstercompany@gmail.com", region: "us-east-1", useDefaultReplyTo: false,
  });
});

test("another tenant's external Reply-To is never used even with a managed sender", async () => {
  process.env.RYBS_MANAGED_SES_FROM_EMAIL = "notifications@rybsoftware.com";
  setTenantEmailIdentitySupabaseClientForTesting(createMockSupabase([
    identityRow({ reply_to_email: "other-company@gmail.com" }),
  ], { ignoreFilters: true }).client);
  const sender = await resolveTenantEmailSender({
    tenant: tenant(DEMO_BUSINESS_ID, "demo-dumpster-co"), businessName: "Demo Dumpster Company",
    supportEmail: "demo-support@gmail.com",
  });
  assert.equal(sender.replyToEmail, "demo-support@gmail.com");
});

test("missing reply contact blocks email options without changing sender configuration", async () => {
  setTenantEmailIdentitySupabaseClientForTesting(createMockSupabase([identityRow({ reply_to_email: null })]).client);
  const sender = await resolveTenantEmailSender({
    tenant: tenant(TAN_BUSINESS_ID, "tan-can-man"), businessName: "Tan Can Man",
    allowSupportReplyToFallback: false,
  });
  assert.equal(sender.replyToEmail, null);
  assert.equal(sender.senderEmail, "bookings@tancanman.com");
  assert.throws(() => tenantSenderSendEmailOptions(sender), /delivery paused/);
});

test("reply validation rejects no-reply, malformed and header-injection addresses", () => {
  for (const email of ["noreply@gmail.com", "no_reply@gmail.com", "do-not-reply@gmail.com",
    "owner@gmail.com\r\nBcc: victim@gmail.com", "owner@gmail.com,other@gmail.com", "bad..name@gmail.com",
    "<owner@gmail.com>", "owner@-bad.com", "test@test.com"]) {
    assert.equal(isSuitableTenantReplyToEmail(email), null, email);
  }
  assert.equal(isSuitableTenantReplyToEmail("Owner+bookings@Gmail.com"), "owner+bookings@gmail.com");
});
