import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPostBookingChargePaidEmail,
  getPostBookingChargeTypeLabel,
  type BuildPostBookingChargePaidEmailInput,
  type PostBookingChargeType,
} from "../src/lib/messages/post-booking-charge-receipt.ts";

const PAID_AT = "2026-05-29T16:30:00.000Z";

function baseInput(overrides: Partial<BuildPostBookingChargePaidEmailInput> = {}) {
  return {
    businessName: "Tan Can Man",
    businessPhone: "555-0100",
    businessEmail: "support@example.com",
    customerName: "Taylor",
    bookingReference: "BK-123456",
    chargeType: "weight_overage" as const,
    chargeDescription: "Pickup weight exceeded the included limit.",
    amountCents: 51300,
    currency: "USD",
    paidAt: PAID_AT,
    cardBrand: "visa",
    cardLast4: "1111",
    ...overrides,
  };
}

test("buildPostBookingChargePaidEmail formats amount correctly", () => {
  const email = buildPostBookingChargePaidEmail(baseInput({ amountCents: 51300 }));

  assert.match(email.subject, /Additional charge for your dumpster rental/);
  assert.match(email.body, /charged \$513\.00/);
  assert.match(email.body, /Amount: \$513\.00/);
});

test("buildPostBookingChargePaidEmail includes booking reference when present", () => {
  const email = buildPostBookingChargePaidEmail(baseInput({ bookingReference: "BK-ABC123" }));

  assert.match(email.subject, /BK-ABC123/);
  assert.match(email.body, /Booking reference: BK-ABC123/);
});

test("buildPostBookingChargePaidEmail includes card brand and last 4 when present", () => {
  const email = buildPostBookingChargePaidEmail(baseInput({ cardBrand: "visa", cardLast4: "1111" }));

  assert.match(email.body, /Card: VISA ending 1111/);
});

test("buildPostBookingChargePaidEmail omits card line when card display data is missing", () => {
  const withoutBrand = buildPostBookingChargePaidEmail(baseInput({ cardBrand: null }));
  const withoutLast4 = buildPostBookingChargePaidEmail(baseInput({ cardLast4: null }));

  assert.doesNotMatch(withoutBrand.body, /Card:/);
  assert.doesNotMatch(withoutLast4.body, /Card:/);
});

test("buildPostBookingChargePaidEmail maps charge type labels", () => {
  const expected: Record<PostBookingChargeType, string> = {
    weight_overage: "Weight overage",
    damage: "Damage fee",
    extra_day: "Extra rental day",
    trip_fee: "Trip fee",
    prohibited_material: "Prohibited material fee",
    manual_adjustment: "Adjustment",
  };

  for (const [chargeType, label] of Object.entries(expected) as [PostBookingChargeType, string][]) {
    const email = buildPostBookingChargePaidEmail(baseInput({ chargeType }));
    assert.equal(getPostBookingChargeTypeLabel(chargeType), label);
    assert.match(email.body, new RegExp(`Charge type: ${label}`));
  }
});

test("BuildPostBookingChargePaidEmailInput does not accept evidence or internal fields", () => {
  const publicInput = {
    ...baseInput(),
    // @ts-expect-error evidence notes are intentionally not part of customer email input
    evidenceNotes: "Internal staff note that should never be sent.",
  } satisfies BuildPostBookingChargePaidEmailInput;

  const email = buildPostBookingChargePaidEmail(publicInput);

  assert.doesNotMatch(email.body, /Internal staff note/);
  assert.doesNotMatch(email.body, /evidence/i);
});

test("buildPostBookingChargePaidEmail does not expose admin charge description", () => {
  const email = buildPostBookingChargePaidEmail(
    baseInput({ chargeDescription: "Scale ticket note for internal staff review." }),
  );

  assert.doesNotMatch(email.body, /Scale ticket note/);
  assert.doesNotMatch(email.body, /Description:/);
});
