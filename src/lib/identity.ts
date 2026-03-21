export const DEFAULT_BOOKING_REF_PREFIX = "BK";

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeEmail(value: string | null | undefined) {
  const trimmed = clean(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

export function isValidEmail(value: string | null | undefined) {
  const normalized = normalizeEmail(value);
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function getCustomerFacingBookingLabel(bookingRef: string | null | undefined) {
  return bookingRef?.trim() || "Booking pending";
}
