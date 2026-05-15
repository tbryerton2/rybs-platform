import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateRentalWindowAvailability,
  RENTAL_WINDOW_BLOCKING_RULE,
} from "../src/lib/rental-window-availability.ts";
import { ensureRentalWindowAvailability } from "../src/lib/ensure-rental-window-availability.ts";

const fifteenYardDumpsters = [
  { id: "d15-a", label: "15A" },
  { id: "d15-b", label: "15B" },
];

const twentyYardDumpsters = [{ id: "d20-a", label: "20A" }];

test("same date range can differ by dumpster size", () => {
  const fifteenYard = evaluateRentalWindowAvailability({
    requestedDeliveryDate: "2026-05-27",
    requestedPickupDate: "2026-06-03",
    dumpsters: fifteenYardDumpsters,
    blockers: [
      {
        id: "booking-15",
        type: "booking",
        status: "confirmed",
        deliveryDate: "2026-05-30",
        effectivePickupDate: "2026-06-02",
        assignedDumpsterId: "d15-a",
        dumpsterSize: "15 yard",
        dumpsterProductId: "15-yard",
      },
    ],
  });

  const twentyYard = evaluateRentalWindowAvailability({
    requestedDeliveryDate: "2026-05-27",
    requestedPickupDate: "2026-06-03",
    dumpsters: twentyYardDumpsters,
    blockers: [
      {
        id: "booking-20",
        type: "booking",
        status: "confirmed",
        deliveryDate: "2026-05-27",
        effectivePickupDate: "2026-06-03",
        assignedDumpsterId: "d20-a",
        dumpsterSize: "20 yard",
        dumpsterProductId: "20-yard",
      },
    ],
  });

  assert.equal(fifteenYard.availableCount, 1);
  assert.equal(twentyYard.availableCount, 0);
});

test("a date can look globally open but be sold out for the selected dumpster size", () => {
  const result = evaluateRentalWindowAvailability({
    requestedDeliveryDate: "2026-05-27",
    requestedPickupDate: "2026-06-03",
    dumpsters: twentyYardDumpsters,
    blockers: [
      {
        id: "booking-20",
        type: "booking",
        status: "confirmed",
        deliveryDate: "2026-05-31",
        effectivePickupDate: "2026-06-04",
        assignedDumpsterId: "d20-a",
        dumpsterSize: "20 yard",
        dumpsterProductId: "20-yard",
      },
    ],
  });

  assert.equal(result.availableCount, 0);
  assert.equal(result.blockingRule, RENTAL_WINDOW_BLOCKING_RULE);
});

test("future dates stay available when compatible inventory exists and no bookings overlap", () => {
  const result = evaluateRentalWindowAvailability({
    requestedDeliveryDate: "2026-07-01",
    requestedPickupDate: "2026-07-08",
    dumpsters: [{ id: "d14-a", label: "14A" }],
    blockers: [
      {
        id: "june-booking",
        type: "booking",
        status: "confirmed",
        deliveryDate: "2026-06-07",
        effectivePickupDate: "2026-06-14",
        assignedDumpsterId: "d14-a",
        dumpsterSize: "14 yard",
        dumpsterProductId: "default",
      },
    ],
  });

  assert.equal(result.availableCount, 1);
});

test("no single dumpster is available for the entire window when assigned blockers split the range", () => {
  const result = evaluateRentalWindowAvailability({
    requestedDeliveryDate: "2026-05-27",
    requestedPickupDate: "2026-06-03",
    dumpsters: fifteenYardDumpsters,
    blockers: [
      {
        id: "early-blocker",
        type: "booking",
        status: "confirmed",
        deliveryDate: "2026-05-27",
        effectivePickupDate: "2026-05-27",
        assignedDumpsterId: "d15-a",
        dumpsterSize: "15 yard",
        dumpsterProductId: "15-yard",
      },
      {
        id: "late-blocker",
        type: "booking",
        status: "confirmed",
        deliveryDate: "2026-05-31",
        effectivePickupDate: "2026-05-31",
        assignedDumpsterId: "d15-b",
        dumpsterSize: "15 yard",
        dumpsterProductId: "15-yard",
      },
    ],
  });

  assert.equal(result.availableCount, 0);
  assert.deepEqual(
    result.dumpsters.map((dumpster) => dumpster.availableForEntireWindow),
    [false, false],
  );
});

test("pickup-date checks reject a later pickup when the extended window conflicts", () => {
  const standardWindow = evaluateRentalWindowAvailability({
    requestedDeliveryDate: "2026-05-27",
    requestedPickupDate: "2026-06-03",
    dumpsters: fifteenYardDumpsters,
    blockers: [
      {
        id: "base-booking",
        type: "booking",
        status: "confirmed",
        deliveryDate: "2026-05-28",
        effectivePickupDate: "2026-06-02",
        assignedDumpsterId: "d15-a",
        dumpsterSize: "15 yard",
        dumpsterProductId: "15-yard",
      },
      {
        id: "future-blocker",
        type: "hold",
        status: "active",
        deliveryDate: "2026-06-05",
        effectivePickupDate: "2026-06-07",
        assignedDumpsterId: "d15-b",
        dumpsterSize: "15 yard",
        dumpsterProductId: "15-yard",
      },
    ],
  });

  const extendedWindow = evaluateRentalWindowAvailability({
    requestedDeliveryDate: "2026-05-27",
    requestedPickupDate: "2026-06-06",
    dumpsters: fifteenYardDumpsters,
    blockers: [
      {
        id: "future-blocker",
        type: "hold",
        status: "active",
        deliveryDate: "2026-06-05",
        effectivePickupDate: "2026-06-07",
        assignedDumpsterId: "d15-b",
        dumpsterSize: "15 yard",
        dumpsterProductId: "15-yard",
      },
      {
        id: "base-booking",
        type: "booking",
        status: "confirmed",
        deliveryDate: "2026-05-28",
        effectivePickupDate: "2026-06-02",
        assignedDumpsterId: "d15-a",
        dumpsterSize: "15 yard",
        dumpsterProductId: "15-yard",
      },
    ],
  });

  assert.equal(standardWindow.availableCount, 1);
  assert.equal(extendedWindow.availableCount, 0);
});

test("backend booking guard rejects an unavailable rental window", async () => {
  await assert.rejects(
    () =>
      ensureRentalWindowAvailability({
        unavailableMessage: "That rental window is no longer available. Please choose another delivery date.",
        check: async () => ({ remaining: 0 }),
      }),
    /That rental window is no longer available/,
  );
});

test("mismatched labels do not break compatibility when capacity matches", () => {
  const result = evaluateRentalWindowAvailability({
    requestedDeliveryDate: "2026-07-01",
    requestedPickupDate: "2026-07-08",
    dumpsters: [{ id: "d14-a", label: "14 Yard Dumpster A" }],
    blockers: [],
  });

  assert.equal(result.availableCount, 1);
});
