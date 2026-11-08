import test from "node:test";
import assert from "node:assert/strict";

// No environment file, database calls or SES network sends are used in these tests.
process.env.AWS_REGION = "us-east-1";
process.env.SES_FROM_EMAIL = "unused@gmail.com";
const { sendBookingEmails } = await import("../src/lib/email/booking-emails.ts");

const tenant = {
  id: "11111111-1111-4111-8111-111111111111", slug: "demo-dumpster-co", status: "active" as const,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};
const input = {
  tenant, bookingId: "BK-123456", customerName: "Customer", customerEmail: "customer@example.com",
  serviceAddress: "123 Main St",
};
const communication = {
  businessName: "Demo Dumpster Company", supportEmail: "different-support@gmail.com", supportPhone: null,
  publicBaseUrl: "https://demo.test", bookingNotificationRecipients: ["private-ops@gmail.com"],
};
const sender = {
  businessId: tenant.id, source: "tenant_verified" as const, senderDisplayName: "Demo Dumpster Company",
  senderEmail: "bookings@demo-mail.rybsoftware.com", formattedFrom: '"Demo Dumpster Company" <bookings@demo-mail.rybsoftware.com>',
  replyToEmail: "demodumpstercompany@gmail.com", sesRegion: "us-east-1",
  providerStatus: "verified" as const, verificationStatus: "verified" as const,
};

test("booking delivery uses the same external contact in SES options, HTML and text", async () => {
  const sent: Array<Record<string, unknown>> = [];
  await sendBookingEmails(input, {
    getCommunicationSettings: async () => communication,
    resolveSender: async options => { assert.equal(options.tenant?.id, tenant.id); return sender; },
    sendEmail: async message => { sent.push(message); return { MessageId: "mock", $metadata: {} }; },
  });
  assert.equal(sent.length, 2);
  for (const message of sent) {
    assert.equal(message.fromEmail, sender.senderEmail);
    assert.equal(message.fromDisplayName, sender.senderDisplayName);
    assert.equal(message.region, sender.sesRegion);
    assert.equal(message.replyTo, sender.replyToEmail);
    assert.equal(message.useDefaultReplyTo, false);
  }
  for (const body of [sent[0].text, sent[0].html]) {
    assert.match(String(body), /demodumpstercompany@gmail.com/);
    assert.doesNotMatch(String(body), /different-support@gmail.com|private-ops@gmail.com/);
  }
});

test("missing reply address rejects delivery before any SES call, even with internal recipients", async () => {
  let sends = 0;
  await assert.rejects(() => sendBookingEmails(input, {
    getCommunicationSettings: async () => ({ ...communication, supportEmail: null }),
    resolveSender: async () => ({ ...sender, replyToEmail: null }),
    sendEmail: async () => { sends++; return { $metadata: {} }; },
  }), /Customer email delivery paused/);
  assert.equal(sends, 0);
});
