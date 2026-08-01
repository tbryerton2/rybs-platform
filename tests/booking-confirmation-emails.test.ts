import test from "node:test";
import assert from "node:assert/strict";

import { buildAdminNewBookingEmail } from "../src/lib/email/templates/admin-new-booking.ts";
import { buildCustomerBookingConfirmationEmail } from "../src/lib/email/templates/customer-booking-confirmation.ts";

const BASE_BOOKING_EMAIL_INPUT = {
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
  assert.match(email.html, />\$475\.00</);
  assert.doesNotMatch(email.text, /Total: Not available/);
});

test("admin booking notification email formats total cents as dollars", () => {
  const email = buildAdminNewBookingEmail({
    ...BASE_BOOKING_EMAIL_INPUT,
    totalPriceCents: 47500,
    adminBookingUrl: "https://example.com/admin/bookings/booking-id",
  });

  assert.match(email.text, /Total: \$475\.00/);
  assert.match(email.html, />\$475\.00</);
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
