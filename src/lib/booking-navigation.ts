import { getTenantStorageKey, TENANT_STORAGE_KEYS } from "./tenant/runtime";

const HISTORY_KEY = "retailBooking";

type BookingHistoryEntry = { storageKey: string; version: number };
type BookingNavigationBrowser = Pick<Window, "history" | "sessionStorage">;

// Keep navigation working in the current document when browser storage is unavailable.
const fallbackVersions = new Map<string, number>();

function readVersion(browser: BookingNavigationBrowser, storageKey: string) {
  try {
    const version = Number(browser.sessionStorage.getItem(storageKey));
    if (Number.isSafeInteger(version) && version >= 0) {
      return Math.max(version, fallbackVersions.get(storageKey) ?? 0);
    }
  } catch {
    // Some browsers disable session storage.
  }
  return fallbackVersions.get(storageKey) ?? 0;
}

function readEntry(state: unknown, storageKey: string): BookingHistoryEntry | null {
  if (!state || typeof state !== "object") return null;
  const entry = (state as Record<string, unknown>)[HISTORY_KEY];
  if (!entry || typeof entry !== "object") return null;
  const candidate = entry as Partial<BookingHistoryEntry>;
  return candidate.storageKey === storageKey &&
    typeof candidate.version === "number" &&
    Number.isSafeInteger(candidate.version) && candidate.version >= 0
    ? candidate as BookingHistoryEntry
    : null;
}

/** Validate before mounting a booking form, so its missing-draft redirects cannot run. */
export function enterBookingHistory(
  browser: BookingNavigationBrowser = window,
  storageKey = getTenantStorageKey(TENANT_STORAGE_KEYS.bookingHistoryVersion),
) {
  const version = readVersion(browser, storageKey);
  const entry = readEntry(browser.history.state, storageKey);
  if (entry && entry.version < version) return false;

  if (!entry) {
    // Preserve Next.js's history state and do not create an extra Back-button stop.
    browser.history.replaceState({
      ...browser.history.state,
      [HISTORY_KEY]: { storageKey, version },
    }, "");
  }
  return true;
}

/** Call only after the booking has been confirmed successfully. */
export function completeBookingHistory(
  browser: BookingNavigationBrowser = window,
  storageKey = getTenantStorageKey(TENANT_STORAGE_KEYS.bookingHistoryVersion),
) {
  const version = readVersion(browser, storageKey) + 1;
  fallbackVersions.set(storageKey, version);
  try {
    browser.sessionStorage.setItem(storageKey, String(version));
  } catch {
    // The in-memory version still protects cached pages in this document.
  }
}
