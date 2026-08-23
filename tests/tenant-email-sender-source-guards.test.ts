import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("production send paths resolve tenant sender before sending email", () => {
  const bookingEmails = readRepoFile("src/lib/email/booking-emails.ts");
  const portalLogin = readRepoFile("src/app/portal/login/actions.ts");
  const portalRentals = readRepoFile("src/app/portal/rentals/[id]/actions.ts");

  for (const source of [bookingEmails, portalLogin, portalRentals]) {
    assert.match(source, /resolveTenantEmailSender/);
    assert.match(source, /tenantSenderSendEmailOptions/);
    assert.match(source, /sendEmail\(/);
  }

  assert.match(bookingEmails, /tenant: input\.tenant/);
  assert.match(portalLogin, /tenant,/);
  assert.match(portalRentals, /tenant,/);
});

test("booking creation remains successful when tenant email cannot be sent", () => {
  const confirmBooking = readRepoFile("src/app/api/confirm-booking/route.ts");

  assert.match(confirmBooking, /try \{\s+await sendBookingEmails/);
  assert.match(confirmBooking, /bookingEmailWarning/);
  assert.match(confirmBooking, /booking email send failed/);
  assert.match(confirmBooking, /ok: true/);
});

test("queued email processing resolves sender by queued business_id", () => {
  const source = readRepoFile("src/lib/messages/process-booking-messages.ts");

  assert.match(source, /resolveTenantEmailSender\?: \(businessId: string\)/);
  assert.match(source, /Tenant email sender requires queued message business_id/);
  assert.match(source, /options\.resolveTenantEmailSender\(message\.business_id\)/);
  assert.match(source, /provider: "ses"/);
  assert.doesNotMatch(source, /no-reply@yourdomain\.com/);
  assert.doesNotMatch(source, /EXPECTED_SES_FROM_EMAIL/);
  assert.doesNotMatch(source, /EXPECTED_SES_REPLY_TO_EMAIL/);
});

test("production email code no longer hardcodes Tan sender assumptions", () => {
  const productionSources = [
    "src/lib/email/booking-emails.ts",
    "src/lib/messages/process-booking-messages.ts",
    "src/app/portal/login/actions.ts",
    "src/app/portal/rentals/[id]/actions.ts",
    "src/app/api/admin/bookings/[id]/route.ts",
    "src/app/api/confirm-booking/route.ts",
  ].map(readRepoFile);

  for (const source of productionSources) {
    assert.doesNotMatch(source, /bookings@tancanman\.com/);
    assert.doesNotMatch(source, /info@tancanman\.com/);
    assert.doesNotMatch(source, /no-reply@yourdomain\.com/);
    assert.doesNotMatch(source, /Tin Can Man/);
    assert.doesNotMatch(source, /Tan Can Man/);
  }
});
