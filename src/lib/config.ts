// src/lib/config.ts

/**
 * Central place for owner-configurable defaults.
 * For now: hardcoded.
 * Later: read from DB/admin settings.
 */

export function getDefaultRentalDays(): number {
  return 7;
}

/**
 * How long we reserve a delivery date while the customer completes checkout.
 * This MUST match what we actually write into booking_holds.expires_at.
 */
export function getHoldMinutes(): number {
  return 15;
}

/**
 * Business rule: earliest pickup is delivery + N days.
 * (24-hour notice = 1 day)
 */
export function getMinPickupLeadDays(): number {
  return 1;
}