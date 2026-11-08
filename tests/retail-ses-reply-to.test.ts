import test from "node:test";
import assert from "node:assert/strict";
import { SESClient } from "@aws-sdk/client-ses";

process.env.AWS_REGION = "us-east-1";
process.env.AWS_ACCESS_KEY_ID = "mock-access-key";
process.env.AWS_SECRET_ACCESS_KEY = "mock-secret";
process.env.SES_FROM_EMAIL = "global-from@gmail.com";
process.env.SES_REPLY_TO_EMAIL = "unrelated-default@gmail.com";

const { sendEmail } = await import("../src/lib/email/ses.ts");
const { tenantSenderSendEmailOptions } = await import("../src/lib/email/tenant-sender.ts");

test("SES command preserves authenticated sender and region while using external customer Reply-To", async t => {
  const commands: Array<Record<string, unknown>> = [];
  const regions: string[] = [];
  // Intercept the SDK at the transport boundary; no request reaches AWS.
  t.mock.method(SESClient.prototype, "send", async function (this: SESClient, command: { input: Record<string, unknown> }) {
    commands.push(command.input);
    regions.push(await this.config.region());
    return { MessageId: "mock-message" };
  });
  const sender = {
    businessId: "demo", source: "tenant_verified" as const, senderDisplayName: "Demo Dumpster Company",
    senderEmail: "bookings@demo-mail.rybsoftware.com", formattedFrom: "unused",
    replyToEmail: "demodumpstercompany@gmail.com", sesRegion: "us-west-2",
    providerStatus: "verified" as const, verificationStatus: "verified" as const,
  };
  await sendEmail({ to: "customer@example.com", subject: "Booking confirmed", text: "Booking", html: "<p>Booking</p>",
    ...tenantSenderSendEmailOptions(sender) });
  assert.equal(commands.length, 1);
  assert.equal(commands[0].Source, '"Demo Dumpster Company" <bookings@demo-mail.rybsoftware.com>');
  assert.deepEqual(commands[0].ReplyToAddresses, ["demodumpstercompany@gmail.com"]);
  assert.deepEqual(regions, ["us-west-2"]);
  assert.throws(() => tenantSenderSendEmailOptions({ ...sender, replyToEmail: null }), /delivery paused/);
  assert.equal(commands.length, 1);
});
