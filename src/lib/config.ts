// src/lib/config.ts

/**
 * Admin-facing operational fallback only.
 * Real customer pricing and booking duration rules come from pricing_settings.
 * Keep this aligned with the bootstrap pricing default so fresh tenants behave coherently.
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
