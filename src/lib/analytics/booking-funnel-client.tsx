"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BOOKING_FUNNEL_SESSION_EXPIRES_AFTER_MS,
  isBookingFunnelStepKey,
  shouldStartNewBookingSession,
  type BookingFunnelEventName,
  type BookingFunnelStepKey,
} from "@/lib/analytics/booking-funnel-core";
import { getTenantStorageKey, TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";

type BookingAnalyticsSessionState = {
  sessionToken: string;
  startedAt: string;
  lastEventAt: string;
  completedAt?: string | null;
};

type BookingDraftContext = {
  holdId?: string | null;
  dumpsterProductId?: string | null;
  dumpsterSize?: string | null;
};

const RECENT_STEP_SUPPRESSION_MS = 1500;
const recentStepEvents = new Map<string, number>();

function getAnalyticsStorageKey() {
  return getTenantStorageKey(TENANT_STORAGE_KEYS.analyticsBookingSession);
}

function getBookingStorageKey() {
  return getTenantStorageKey(TENANT_STORAGE_KEYS.booking);
}

function createToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseSessionState(raw: string | null): BookingAnalyticsSessionState | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<BookingAnalyticsSessionState>;
    if (!parsed.sessionToken || !parsed.lastEventAt || !parsed.startedAt) return null;
    return {
      sessionToken: String(parsed.sessionToken),
      startedAt: String(parsed.startedAt),
      lastEventAt: String(parsed.lastEventAt),
      completedAt: parsed.completedAt ? String(parsed.completedAt) : null,
    };
  } catch {
    return null;
  }
}

function writeSessionState(state: BookingAnalyticsSessionState) {
  try {
    localStorage.setItem(getAnalyticsStorageKey(), JSON.stringify(state));
  } catch {
    // Analytics storage is best-effort.
  }
}

function readSessionStateFromStorage() {
  try {
    return parseSessionState(localStorage.getItem(getAnalyticsStorageKey()));
  } catch {
    return null;
  }
}

function getOrCreateSessionState(nowMs: number) {
  const existing = typeof localStorage === "undefined" ? null : readSessionStateFromStorage();
  const shouldCreate = shouldStartNewBookingSession({
    lastEventAt: existing?.lastEventAt ?? null,
    completedAt: existing?.completedAt ?? null,
    nowMs,
    expiresAfterMs: BOOKING_FUNNEL_SESSION_EXPIRES_AFTER_MS,
  });

  if (!existing || shouldCreate) {
    const nowIso = new Date(nowMs).toISOString();
    const created = {
      sessionToken: createToken(),
      startedAt: nowIso,
      lastEventAt: nowIso,
      completedAt: null,
    };
    writeSessionState(created);
    return { state: created, created: true };
  }

  return { state: existing, created: false };
}

function updateLastEventAt(state: BookingAnalyticsSessionState, nowMs: number) {
  const updated = {
    ...state,
    lastEventAt: new Date(nowMs).toISOString(),
  };
  writeSessionState(updated);
  return updated;
}

function readBookingDraftContext(): BookingDraftContext {
  try {
    const raw = sessionStorage.getItem(getBookingStorageKey());
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const holdId = typeof parsed.holdId === "string" ? parsed.holdId : null;
    const dumpsterProductId =
      typeof parsed.dumpsterProductId === "string" ? parsed.dumpsterProductId : null;
    const dumpsterSize = typeof parsed.dumpsterSize === "string" ? parsed.dumpsterSize : null;

    return {
      holdId,
      dumpsterProductId,
      dumpsterSize,
    };
  } catch {
    return {};
  }
}

async function postBookingFunnelEvent(input: {
  eventName: BookingFunnelEventName;
  stepKey?: BookingFunnelStepKey;
  bookingSessionToken: string;
  idempotencyKey: string;
  context?: BookingDraftContext;
}) {
  const context = input.context ?? readBookingDraftContext();

  await fetch("/api/analytics/booking-funnel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventName: input.eventName,
      stepKey: input.stepKey,
      bookingSessionToken: input.bookingSessionToken,
      idempotencyKey: input.idempotencyKey,
      bookingHoldId: context.holdId ?? null,
      dumpsterProductId: context.dumpsterProductId ?? null,
      dumpsterSize: context.dumpsterSize ?? null,
    }),
    keepalive: true,
  }).catch(() => {
    // Analytics failures must not affect booking flow.
  });
}

export function getActiveBookingAnalyticsSessionToken() {
  if (typeof window === "undefined") return null;

  const existing = readSessionStateFromStorage();
  if (!existing) return null;

  const expired = shouldStartNewBookingSession({
    lastEventAt: existing.lastEventAt,
    completedAt: existing.completedAt ?? null,
    nowMs: Date.now(),
    expiresAfterMs: BOOKING_FUNNEL_SESSION_EXPIRES_AFTER_MS,
  });

  return expired ? null : existing.sessionToken;
}

export function markBookingFunnelCompletedLocally() {
  if (typeof window === "undefined") return;

  const existing = readSessionStateFromStorage();
  if (!existing) return;

  writeSessionState({
    ...existing,
    lastEventAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });
}

export function trackBookingStepViewed(stepKey: BookingFunnelStepKey) {
  if (typeof window === "undefined" || !isBookingFunnelStepKey(stepKey)) return;

  const nowMs = Date.now();
  const existingSession = readSessionStateFromStorage();
  if (stepKey === "confirmation" && existingSession?.completedAt) return;

  const { state } = getOrCreateSessionState(nowMs);
  const locationKey = `${state.sessionToken}:${stepKey}:${window.location.pathname}:${window.location.search}`;
  const recentAt = recentStepEvents.get(locationKey);

  if (recentAt && nowMs - recentAt < RECENT_STEP_SUPPRESSION_MS) return;
  recentStepEvents.set(locationKey, nowMs);

  const updatedState = updateLastEventAt(state, nowMs);
  const pageViewId = createToken();
  const context = readBookingDraftContext();

  void postBookingFunnelEvent({
    eventName: "booking_step_viewed",
    stepKey,
    bookingSessionToken: updatedState.sessionToken,
    idempotencyKey: `booking_step_viewed:${updatedState.sessionToken}:${stepKey}:${pageViewId}`,
    context,
  });

  if (stepKey === "confirmation") {
    markBookingFunnelCompletedLocally();
  }
}

export function BookingFunnelStepTracker({ stepKey }: { stepKey: BookingFunnelStepKey }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    trackBookingStepViewed(stepKey);
  }, [pathname, searchParams, stepKey]);

  return null;
}
