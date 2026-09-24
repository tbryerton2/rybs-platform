import test from "node:test";
import assert from "node:assert/strict";

import {
  getAdminPasswordRecoveryRedirectUrl,
  sendAdminPasswordRecoveryEmail,
  type SendAdminPasswordRecoveryDeps,
} from "../src/lib/admin/password-recovery.ts";

test("admin password recovery prefers the configured admin app", () => {
  assert.equal(
    getAdminPasswordRecoveryRedirectUrl({
      adminAppUrl: "https://app.rybsoftware.com",
      forwardedHost: "customer.example.com",
      forwardedProto: "https",
      siteUrl: "https://customer.example.com",
      nodeEnv: "production",
    }),
    "https://app.rybsoftware.com/admin/update-password",
  );
});

test("admin password recovery keeps local development links local when unconfigured", () => {
  assert.equal(
    getAdminPasswordRecoveryRedirectUrl({
      host: "localhost:3000",
      siteUrl: "https://app.rybsoftware.com",
      nodeEnv: "development",
    }),
    "http://localhost:3000/admin/update-password",
  );
});

test("admin password recovery works centrally for any active business membership", async () => {
  const calls: Record<string, unknown>[] = [];
  const deps: SendAdminPasswordRecoveryDeps = {
    async findAuthUserByEmail(email) {
      calls.push({ type: "findUser", email });
      return { id: "multi-business-user", email };
    },
    async hasActiveAdminMembership(authUserId) {
      calls.push({ type: "membership", authUserId });
      return authUserId === "multi-business-user";
    },
    async generateRecoveryLink(input) {
      calls.push({ type: "generateLink", ...input });
      return `https://auth.example/verify?type=recovery&redirect_to=${encodeURIComponent(input.redirectTo)}`;
    },
    getRybManagedEmailSenderConfig() {
      return {
        senderEmail: "admin@mail.rybsoftware.com",
        sesRegion: "us-east-1",
      };
    },
    async sendEmail(message) {
      calls.push({ type: "email", ...message });
    },
  };

  const result = await sendAdminPasswordRecoveryEmail({
    email: "admin@example.com",
    adminAppUrl: "https://app.rybsoftware.com",
    nodeEnv: "production",
  }, deps);

  assert.equal(result.status, "sent");
  assert.equal(result.redirectTo, "https://app.rybsoftware.com/admin/update-password");

  const generateLinkCall = calls.find((call) => call.type === "generateLink");
  assert.equal(
    generateLinkCall?.redirectTo,
    "https://app.rybsoftware.com/admin/update-password",
  );

  const emailCall = calls.find((call) => call.type === "email");
  assert.equal(emailCall?.fromEmail, "admin@mail.rybsoftware.com");
  assert.equal(emailCall?.fromDisplayName, "RYBS Platform");
  assert.equal(emailCall?.region, "us-east-1");
  assert.match(String(emailCall?.subject), /RYBS Platform/);
  assert.match(String(emailCall?.text), /RYBS Platform/);
});

test("admin password recovery does not send when email lacks active business access", async () => {
  let generatedLink = false;
  let sentEmail = false;

  const result = await sendAdminPasswordRecoveryEmail({
    email: "former-admin@example.com",
    adminAppUrl: "https://app.rybsoftware.com",
    nodeEnv: "production",
  }, {
    async findAuthUserByEmail(email) {
      return { id: "disabled-user", email };
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

test("admin password recovery does not reveal an unknown account", async () => {
  let membershipChecked = false;

  const result = await sendAdminPasswordRecoveryEmail({
    email: "missing@example.com",
    adminAppUrl: "https://app.rybsoftware.com",
    nodeEnv: "production",
  }, {
    async findAuthUserByEmail() {
      return null;
    },
    async hasActiveAdminMembership() {
      membershipChecked = true;
      return true;
    },
  });

  assert.equal(result.status, "skipped");
  assert.equal(membershipChecked, false);
});

test("admin password recovery requires an RYBS-managed sender", async () => {
  await assert.rejects(
    () => sendAdminPasswordRecoveryEmail({
      email: "admin@example.com",
      adminAppUrl: "https://app.rybsoftware.com",
      nodeEnv: "production",
    }, {
      async findAuthUserByEmail(email) {
        return { id: "active-user", email };
      },
      async hasActiveAdminMembership() {
        return true;
      },
      getRybManagedEmailSenderConfig() {
        return { senderEmail: null, sesRegion: null };
      },
    }),
    /RYBS_MANAGED_SES_FROM_EMAIL/,
  );
});
