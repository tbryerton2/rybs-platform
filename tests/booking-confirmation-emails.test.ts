import test from "node:test";
import assert from "node:assert/strict";

import { buildAdminNewBookingEmail } from "../src/lib/email/templates/admin-new-booking.ts";
import { buildAdminIssueReportEmail } from "../src/lib/email/templates/admin-issue-report.ts";
import { buildCustomerBookingConfirmationEmail } from "../src/lib/email/templates/customer-booking-confirmation.ts";
import { buildPortalLoginEmail } from "../src/lib/email/templates/portal-login.ts";

const BASE_BOOKING_EMAIL_INPUT = {
  businessName: "Demo Dumpster Company",
  customerName: "Taylor Morgan",
  customerEmail: "taylor@example.com",
  customerPhone: "555-0100",
  bookingId: "BK-123456",
  dumpsterSize: "15 Yard Dumpster",
  deliveryDate: "2026-07-01",
  pickupDate: "2026-07-08",
  serviceAddress: "123 Main St, Columbus, OH, 43215",
};

test("customer booking confirmation email formats total cents as dollars", () => {
  const email = buildCustomerBookingConfirmationEmail({
    ...BASE_BOOKING_EMAIL_INPUT,
    totalPriceCents: 47500,
  });

  assert.match(email.text, /Total: \$475\.00/);
  assert.match(email.subject, /Demo Dumpster Company/);
  assert.match(email.text, /Thanks for booking with Demo Dumpster Company/);
  assert.match(email.html, />\$475\.00</);
  assert.doesNotMatch(email.text, /Tan Can Man/);
  assert.doesNotMatch(email.text, /Total: Not available/);
});

test("admin booking notification email formats total cents as dollars", () => {
  const email = buildAdminNewBookingEmail({
    ...BASE_BOOKING_EMAIL_INPUT,
    totalPriceCents: 47500,
    adminBookingUrl: "https://example.com/admin/bookings/booking-id",
  });

  assert.match(email.text, /Total: \$475\.00/);
  assert.match(email.subject, /New Demo Dumpster Company booking/);
  assert.match(email.text, /New Demo Dumpster Company booking received/);
  assert.match(email.html, />\$475\.00</);
  assert.doesNotMatch(email.text, /Tan Can Man/);
  assert.doesNotMatch(email.text, /Total: Not available/);
});

test("booking confirmation emails keep fallback when total is missing", () => {
  const customerEmail = buildCustomerBookingConfirmationEmail({
    ...BASE_BOOKING_EMAIL_INPUT,
    totalPriceCents: null,
  });
  const adminEmail = buildAdminNewBookingEmail({
    ...BASE_BOOKING_EMAIL_INPUT,
    totalPriceCents: null,
  });

  assert.match(customerEmail.text, /Total: Not available/);
  assert.match(customerEmail.html, />Not available</);
  assert.match(adminEmail.text, /Total: Not available/);
  assert.match(adminEmail.html, />Not available</);
});

test("portal login email is tenant branded and links to the tenant portal", () => {
  const email = buildPortalLoginEmail({
    businessName: "Demo Dumpster Company",
    loginUrl: "https://demo.rybsoftware.com/portal/auth/callback?token_hash=abc&type=magiclink",
    supportEmail: "support@demo.example",
  });

  assert.match(email.subject, /Demo Dumpster Company/);
  assert.match(email.text, /Demo Dumpster Company customer portal/);
  assert.match(email.text, /https:\/\/demo\.rybsoftware\.com\/portal\/auth\/callback/);
  assert.doesNotMatch(email.text, /Tan Can Man/);
});

test("portal issue report email is tenant branded", () => {
  const email = buildAdminIssueReportEmail({
    businessName: "Demo Dumpster Company",
    customerName: "Taylor Morgan",
    customerEmail: "taylor@example.com",
    bookingId: "BK-123456",
    issueCategory: "damage",
    urgency: "urgent_today",
    description: "There is a problem.",
    preferredContactMethod: "email",
    serviceAddress: "123 Main St",
    adminUrl: "https://demo.rybsoftware.com/admin/portal-requests?filter=issue_report",
  });

  assert.match(email.subject, /Demo Dumpster Company/);
  assert.match(email.text, /Demo Dumpster Company portal/);
  assert.doesNotMatch(email.text, /Tan Can Man/);
});
