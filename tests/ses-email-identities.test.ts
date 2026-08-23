import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSesDkimDnsInstructions,
  buildSesEmailIdentitySnapshot,
  mapSesEmailIdentityStatus,
  provisionSesEmailIdentity,
  type SesEmailIdentityClient,
} from "../src/lib/platform-admin/ses-email-identities.ts";

function commandName(command: unknown) {
  return (command as { constructor?: { name?: string } }).constructor?.name;
}

function commandInput(command: unknown) {
  return (command as { input?: Record<string, unknown> }).input ?? {};
}

test("SES DKIM DNS instructions are derived from Easy DKIM tokens", () => {
  const instructions = buildSesDkimDnsInstructions({
    senderDomain: "TanCanMan.COM",
    dkimTokens: [" token-a ", "token-b", "token-c"],
    signingHostedZone: "dkim.amazonses.com.",
  });

  assert.equal(instructions?.source, "ses");
  assert.deepEqual(instructions?.records, [
    {
      type: "CNAME",
      name: "token-a._domainkey.tancanman.com",
      value: "token-a.dkim.amazonses.com",
      reason: "Amazon SES Easy DKIM verification",
    },
    {
      type: "CNAME",
      name: "token-b._domainkey.tancanman.com",
      value: "token-b.dkim.amazonses.com",
      reason: "Amazon SES Easy DKIM verification",
    },
    {
      type: "CNAME",
      name: "token-c._domainkey.tancanman.com",
      value: "token-c.dkim.amazonses.com",
      reason: "Amazon SES Easy DKIM verification",
    },
  ]);
});

test("SES identity status mapping uses durable readiness values", () => {
  assert.equal(
    mapSesEmailIdentityStatus({
      verifiedForSending: true,
      verificationStatus: "SUCCESS",
      dkimStatus: "SUCCESS",
    }),
    "verified",
  );
  assert.equal(mapSesEmailIdentityStatus({ verificationStatus: "FAILED" }), "failed");
  assert.equal(mapSesEmailIdentityStatus({ dkimStatus: "TEMPORARY_FAILURE" }), "failed");
  assert.equal(mapSesEmailIdentityStatus({ dkimTokens: ["abc"] }), "dns_required");
  assert.equal(mapSesEmailIdentityStatus({}), "pending");
});

test("SES identity snapshot normalizes domains and exposes derived provider state", () => {
  const snapshot = buildSesEmailIdentitySnapshot({
    senderDomain: "TanCanMan.COM",
    verifiedForSending: false,
    verificationStatus: "PENDING",
    dkimStatus: "PENDING",
    dkimTokens: ["abc"],
    signingHostedZone: "dkim.amazonses.com",
    region: "us-east-1",
  });

  assert.equal(snapshot.provider, "ses");
  assert.equal(snapshot.providerStatus, "dns_required");
  assert.equal(snapshot.verificationStatus, "dns_required");
  assert.equal(snapshot.sesRegion, "us-east-1");
  assert.deepEqual(snapshot.dkimTokens, ["abc"]);
  assert.equal(snapshot.dnsInstructions?.records[0]?.name, "abc._domainkey.tancanman.com");
});

test("SES provisioning is idempotent when identity already exists", async () => {
  const calls: Array<{ name: string | undefined; input: Record<string, unknown> }> = [];
  const client: SesEmailIdentityClient = {
    async send(command) {
      calls.push({ name: commandName(command), input: commandInput(command) });

      if (commandName(command) === "CreateEmailIdentityCommand") {
        throw Object.assign(new Error("Email identity already exists."), {
          name: "AlreadyExistsException",
        });
      }

      return {
        VerifiedForSendingStatus: false,
        VerificationStatus: "PENDING",
        DkimAttributes: {
          Status: "PENDING",
          Tokens: ["abc", "def", "ghi"],
          SigningHostedZone: "dkim.amazonses.com",
        },
      };
    },
  };

  const snapshot = await provisionSesEmailIdentity({
    senderDomain: "tancanman.com",
    client,
    region: "us-east-1",
  });

  assert.deepEqual(calls.map((call) => call.name), [
    "CreateEmailIdentityCommand",
    "GetEmailIdentityCommand",
  ]);
  assert.equal(calls[0]?.input.EmailIdentity, "tancanman.com");
  assert.equal(calls[1]?.input.EmailIdentity, "tancanman.com");
  assert.equal(snapshot.providerStatus, "dns_required");
  assert.deepEqual(snapshot.dkimTokens, ["abc", "def", "ghi"]);
});
