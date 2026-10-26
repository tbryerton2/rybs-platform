import { getTenantStorageKey, TENANT_STORAGE_KEYS } from "./tenant/runtime";

const HISTORY_KEY = "retailBooking";
type BookingHistoryEntry = { storageKey: string; version: number };
type BookingNavigationBrowser = Pick<Window, "history" | "sessionStorage">;
type BookingNavigationState = {
  version: number;
  completed: boolean;
  confirmedBookingIds: string[];
};

// Also protect cached pages in this document if browser storage is unavailable.
const fallbackStates = new Map<string, BookingNavigationState>();
const emptyState = (): BookingNavigationState => ({ version: 0, completed: false, confirmedBookingIds: [] });

function readState(browser: BookingNavigationBrowser, storageKey: string): BookingNavigationState {
  const fallback = fallbackStates.get(storageKey);
  if (fallback) return fallback;
  try {
    const raw = browser.sessionStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    // Upgrade the first release's counter: a nonzero version means a booking completed.
    if (typeof parsed === "number" && Number.isSafeInteger(parsed) && parsed >= 0) {
      return { version: parsed, completed: parsed > 0, confirmedBookingIds: [] };
    }
    if (parsed && typeof parsed === "object") {
      const state = parsed as Partial<BookingNavigationState>;
      if (typeof state.version === "number" && Number.isSafeInteger(state.version) && state.version >= 0 &&
          typeof state.completed === "boolean" && Array.isArray(state.confirmedBookingIds) &&
          state.confirmedBookingIds.every((id) => typeof id === "string")) {
        return state as BookingNavigationState;
      }
    }
  } catch {
    // Some browsers disable session storage.
  }
  return emptyState();
}

function writeState(browser: BookingNavigationBrowser, storageKey: string, state: BookingNavigationState) {
  try {
    browser.sessionStorage.setItem(storageKey, JSON.stringify(state));
    fallbackStates.delete(storageKey);
  } catch {
    // The in-memory state still protects cached pages in this document.
    fallbackStates.set(storageKey, state);
  }
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

/** Validate before mounting a form or running its missing-draft redirects. */
export function enterBookingHistory(
  browser: BookingNavigationBrowser = window,
  storageKey = getTenantStorageKey(TENANT_STORAGE_KEYS.bookingHistoryVersion),
) {
  const { version, completed } = readState(browser, storageKey);
  const entry = readEntry(browser.history.state, storageKey);
  // Completion is independent of history metadata, which may be missing on older entries.
  if (completed || (entry && entry.version < version)) return false;

  if (!entry) {
    browser.history.replaceState({
      ...browser.history.state,
      [HISTORY_KEY]: { storageKey, version },
    }, "");
  }
  return true;
}

/** Only an intentional new-booking action reopens the flow. */
export function beginBookingHistory(
  browser: BookingNavigationBrowser = window,
  storageKey = getTenantStorageKey(TENANT_STORAGE_KEYS.bookingHistoryVersion),
) {
  const state = readState(browser, storageKey);
  writeState(browser, storageKey, { ...state, completed: false });
}

/** Successful checkout and its confirmation page may both call this for the same booking. */
export function completeBookingHistory(
  browser: BookingNavigationBrowser = window,
  storageKey = getTenantStorageKey(TENANT_STORAGE_KEYS.bookingHistoryVersion),
  bookingId?: string,
) {
  const state = readState(browser, storageKey);
  if (bookingId && state.confirmedBookingIds.includes(bookingId)) return;
  writeState(browser, storageKey, {
    version: state.version + 1,
    completed: true,
    confirmedBookingIds: bookingId ? [...state.confirmedBookingIds, bookingId] : state.confirmedBookingIds,
  });
}

export function isBookingStep(pathname: string) {
  return pathname === "/book" || pathname.startsWith("/book/") ||
    pathname === "/confirm" || pathname === "/checkout";
}

export function hasCompletedBooking(
  browser: BookingNavigationBrowser = window,
  storageKey = getTenantStorageKey(TENANT_STORAGE_KEYS.bookingHistoryVersion),
) {
  return readState(browser, storageKey).completed;
}
