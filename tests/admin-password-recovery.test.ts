import test from "node:test";
import assert from "node:assert/strict";

import {
  getAdminPasswordRecoveryRedirectUrl,
  sendAdminPasswordRecoveryEmail,
  type SendAdminPasswordRecoveryDeps,
} from "../src/lib/admin/password-recovery.ts";

const TAN_BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const DEMO_BUSINESS_ID = "22222222-2222-4222-8222-222222222222";

function tenant(id: string, slug: string) {
  return {
    id,
    slug,
    status: "active" as const,
    created_at: "2026-08-19T12:00:00.000Z",
    updated_at: "2026-08-19T12:00:00.000Z",
  };
}

test("admin password recovery prefers the current tenant host over NEXT_PUBLIC_SITE_URL", () => {
  assert.equal(
    getAdminPasswordRecoveryRedirectUrl({
      forwardedHost: "demo-preview.rybsoftware.com",
      forwardedProto: "https",
      siteUrl: "http://localhost:3000",
      nodeEnv: "production",
    }),
    "https://demo-preview.rybsoftware.com/admin/update-password",
  );
});

test("admin password recovery keeps local development reset links local", () => {
  assert.equal(
    getAdminPasswordRecoveryRedirectUrl({
      host: "localhost:3000",
      siteUrl: "https://app.rybsoftware.com",
      nodeEnv: "development",
    }),
    "http://localhost:3000/admin/update-password",
  );
});

test("admin password recovery falls back to configured site url when no request host is available", () => {
  assert.equal(
    getAdminPasswordRecoveryRedirectUrl({
      siteUrl: "https://app.rybsoftware.com",
      nodeEnv: "production",
    }),
    "https://app.rybsoftware.com/admin/update-password",
  );
});

test("admin password recovery ignores malformed forwarded hosts", () => {
  assert.equal(
    getAdminPasswordRecoveryRedirectUrl({
      forwardedHost: "https://bad_host_name:3000/admin",
      host: null,
      siteUrl: "https://app.rybsoftware.com",
      nodeEnv: "production",
    }),
    "https://app.rybsoftware.com/admin/update-password",
  );
});

test("admin password recovery sends Demo reset through tenant sender fallback", async () => {
  const calls: Record<string, unknown>[] = [];
  const deps: SendAdminPasswordRecoveryDeps = {
    async resolveTenantFromHostname(hostname) {
      calls.push({ type: "resolveTenant", hostname });
      assert.equal(hostname, "demo-preview.rybsoftware.com");
      return tenant(DEMO_BUSINESS_ID, "demo-dumpster-co");
    },
    async findAuthUserByEmail(email) {
      calls.push({ type: "findUser", email });
      return { id: "demo-auth-user", email };
    },
    async hasActiveAdminMembership(input) {
      calls.push({ type: "membership", ...input });
      return input.businessId === DEMO_BUSINESS_ID && input.authUserId === "demo-auth-user";
    },
    async getTenantCommunicationSettings(currentTenant, context) {
      calls.push({ type: "communication", businessId: currentTenant.id, ...context });
      return {
        businessName: "Demo Dumpster Company",
        supportEmail: "support@demo.example",
        supportPhone: "555-0100",
        publicBaseUrl: "https://demo-preview.rybsoftware.com",
      };
    },
    async generateRecoveryLink(input) {
      calls.push({ type: "generateLink", ...input });
      return `https://auth.example/verify?type=recovery&redirect_to=${encodeURIComponent(input.redirectTo)}`;
    },
    async resolveTenantEmailSender(input) {
      calls.push({ type: "sender", businessId: input.tenant.id, businessName: input.businessName });
      return {
        businessId: input.tenant.id,
        source: "rybs_managed",
        senderDisplayName: "Demo Dumpster Company",
        senderEmail: "bookings@mail.rybsoftware.com",
        formattedFrom: '"Demo Dumpster Company" <bookings@mail.rybsoftware.com>',
        replyToEmail: "support@demo.example",
        sesRegion: "us-west-2",
        providerStatus: "verified",
        verificationStatus: "verified",
      };
    },
    tenantSenderSendEmailOptions(sender) {
      return {
        fromEmail: sender.senderEmail,
        fromDisplayName: sender.senderDisplayName,
        replyTo: sender.replyToEmail,
        region: sender.sesRegion ?? undefined,
        useDefaultReplyTo: false,
      };
    },
    async sendEmail(message) {
      calls.push({ type: "email", ...message });
    },
  };

  const result = await sendAdminPasswordRecoveryEmail({
    email: "demo.admin@example.com",
    forwardedHost: "demo-preview.rybsoftware.com",
    forwardedProto: "https",
    siteUrl: "http://localhost:3000",
    nodeEnv: "production",
  }, deps);

  assert.equal(result.status, "sent");
  assert.equal(result.redirectTo, "https://demo-preview.rybsoftware.com/admin/update-password");
  assert.equal(result.sender?.source, "rybs_managed");

  const generateLinkCall = calls.find((call) => call.type === "generateLink");
  assert.equal(generateLinkCall?.redirectTo, "https://demo-preview.rybsoftware.com/admin/update-password");

  const emailCall = calls.find((call) => call.type === "email");
  assert.equal(emailCall?.fromEmail, "bookings@mail.rybsoftware.com");
  assert.equal(emailCall?.fromDisplayName, "Demo Dumpster Company");
  assert.equal(emailCall?.replyTo, "support@demo.example");
  assert.match(String(emailCall?.text), /Demo Dumpster Company/);
  assert.doesNotMatch(String(emailCall?.subject), /Tan Can Man/);
  assert.doesNotMatch(String(emailCall?.text), /Tan Can Man/);
});

test("admin password recovery does not send when email lacks tenant admin membership", async () => {
  let generatedLink = false;
  let sentEmail = false;
  const result = await sendAdminPasswordRecoveryEmail({
    email: "owner@tancanman.com",
    forwardedHost: "demo-preview.rybsoftware.com",
    forwardedProto: "https",
    nodeEnv: "production",
  }, {
    async resolveTenantFromHostname() {
      return tenant(DEMO_BUSINESS_ID, "demo-dumpster-co");
    },
    async findAuthUserByEmail(email) {
      return { id: "tan-auth-user", email };
    },
    async hasActiveAdminMembership() {
      return false;
    },
    async generateRecoveryLink() {
      generatedLink = true;
      return "https://auth.example/verify";
    },
    async sendEmail() {
      sentEmail = true;
    },
  });

  assert.equal(result.status, "skipped");
  assert.equal(generatedLink, false);
  assert.equal(sentEmail, false);
});

test("admin password recovery preserves Tan Can Man verified sender", async () => {
  let generatedRedirectTo: string | null = null;
  let sentFrom: string | undefined;
  const result = await sendAdminPasswordRecoveryEmail({
    email: "owner@tancanman.com",
    host: "tancanman.com",
    forwardedProto: "https",
    nodeEnv: "production",
  }, {
    async resolveTenantFromHostname(hostname) {
      assert.equal(hostname, "tancanman.com");
      return tenant(TAN_BUSINESS_ID, "tan-can-man");
    },
    async findAuthUserByEmail(email) {
      return { id: "tan-auth-user", email };
    },
    async hasActiveAdminMembership(input) {
      return input.businessId === TAN_BUSINESS_ID;
    },
    async getTenantCommunicationSettings() {
      return {
        businessName: "Tan Can Man",
        supportEmail: "support@tancanman.com",
        supportPhone: null,
        publicBaseUrl: "https://tancanman.com",
      };
    },
    async generateRecoveryLink(input) {
      generatedRedirectTo = input.redirectTo;
      return "https://auth.example/verify?type=recovery";
    },
    async resolveTenantEmailSender(input) {
      return {
        businessId: input.tenant.id,
        source: "tenant_verified",
        senderDisplayName: "Tan Can Man",
        senderEmail: "bookings@tancanman.com",
        formattedFrom: '"Tan Can Man" <bookings@tancanman.com>',
        replyToEmail: "support@tancanman.com",
        sesRegion: "us-east-1",
        providerStatus: "verified",
        verificationStatus: "verified",
      };
    },
    tenantSenderSendEmailOptions(sender) {
      return {
        fromEmail: sender.senderEmail,
        fromDisplayName: sender.senderDisplayName,
        replyTo: sender.replyToEmail,
        region: sender.sesRegion ?? undefined,
        useDefaultReplyTo: false,
      };
    },
    async sendEmail(message) {
      sentFrom = message.fromEmail;
    },
  });

  assert.equal(result.status, "sent");
  assert.equal(result.sender?.source, "tenant_verified");
  assert.equal(generatedRedirectTo, "https://tancanman.com/admin/update-password");
  assert.equal(sentFrom, "bookings@tancanman.com");
});
