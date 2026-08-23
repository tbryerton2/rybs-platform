import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  BOOKING_FUNNEL_RESUME_AFTER_MS,
  BOOKING_FUNNEL_SESSION_EXPIRES_AFTER_MS,
  classifyVisitorType,
  isBookingFunnelEventName,
  isBookingFunnelStepKey,
  isSafeAnalyticsToken,
  normalizeDeviceType,
  resolveAuthoritativeFunnelVisitor,
  shouldResumeBookingSession,
  shouldStartNewBookingSession,
} from "../src/lib/analytics/booking-funnel-core.ts";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("booking funnel analytics validates event and step allowlists", () => {
  assert.equal(isBookingFunnelEventName("booking_started"), true);
  assert.equal(isBookingFunnelEventName("booking_completed"), true);
  assert.equal(isBookingFunnelEventName("pricing_abandoned"), false);

  assert.equal(isBookingFunnelStepKey("service_area"), true);
  assert.equal(isBookingFunnelStepKey("confirmation"), true);
  assert.equal(isBookingFunnelStepKey("pricing"), false);
});

test("booking funnel analytics classifies visitor type from tenant-scoped prior visitor record", () => {
  assert.equal(classifyVisitorType(false), "new");
  assert.equal(classifyVisitorType(true), "returning");
});

test("booking funnel analytics normalizes device type server-side from request headers", () => {
  assert.equal(
    normalizeDeviceType({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    }),
    "mobile",
  );
  assert.equal(
    normalizeDeviceType({
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/604.1",
    }),
    "tablet",
  );
  assert.equal(
    normalizeDeviceType({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
    }),
    "desktop",
  );
  assert.equal(normalizeDeviceType({ secChUaMobile: "?1" }), "mobile");
  assert.equal(normalizeDeviceType({}), "unknown");
});

test("booking funnel analytics treats a 30 minute gap as a resumed attempt", () => {
  const now = new Date("2026-08-13T12:00:00.000Z");

  assert.equal(
    shouldResumeBookingSession(
      new Date(now.getTime() - BOOKING_FUNNEL_RESUME_AFTER_MS + 1).toISOString(),
      now,
    ),
    false,
  );
  assert.equal(
    shouldResumeBookingSession(
      new Date(now.getTime() - BOOKING_FUNNEL_RESUME_AFTER_MS).toISOString(),
      now,
    ),
    true,
  );
});

test("booking funnel analytics expires active sessions after the configured attempt window", () => {
  const nowMs = Date.parse("2026-08-13T12:00:00.000Z");

  assert.equal(
    shouldStartNewBookingSession({
      lastEventAt: nowMs - BOOKING_FUNNEL_SESSION_EXPIRES_AFTER_MS,
      nowMs,
    }),
    false,
  );
  assert.equal(
    shouldStartNewBookingSession({
      lastEventAt: nowMs - BOOKING_FUNNEL_SESSION_EXPIRES_AFTER_MS - 1,
      nowMs,
    }),
    true,
  );
  assert.equal(
    shouldStartNewBookingSession({
      lastEventAt: nowMs - 1000,
      completedAt: new Date(nowMs - 500).toISOString(),
      nowMs,
    }),
    true,
  );
});

test("booking funnel analytics only accepts bounded opaque tokens", () => {
  assert.equal(isSafeAnalyticsToken("018df728-5295-4c60-9de0-fca58fa0324f"), true);
  assert.equal(isSafeAnalyticsToken("booking_step_viewed:018df728-5295-4c60-9de0-fca58fa0324f:review"), true);
  assert.equal(isSafeAnalyticsToken("short"), false);
  assert.equal(isSafeAnalyticsToken("bad token with spaces"), false);
  assert.equal(isSafeAnalyticsToken("x".repeat(161)), false);
});

test("booking funnel analytics makes an existing session visitor authoritative", () => {
  const ownership = resolveAuthoritativeFunnelVisitor({
    candidateVisitor: {
      id: "visitor-loser",
      visitorToken: "losing-cookie-token",
    },
    candidateVisitorType: "new",
    visitorTokenFromCookie: "losing-cookie-token",
    session: {
      visitorId: "visitor-winner",
      visitorType: "returning",
    },
    sessionVisitor: {
      id: "visitor-winner",
      visitorToken: "winning-cookie-token",
    },
  });

  assert.equal(ownership.sessionVisitorIsAuthoritative, true);
  assert.equal(ownership.visitor.id, "visitor-winner");
  assert.equal(ownership.visitor.visitorToken, "winning-cookie-token");
  assert.equal(ownership.visitorType, "returning");
  assert.equal(ownership.setVisitorCookie, true);
});

test("booking funnel analytics keeps the candidate visitor when no session exists", () => {
  const ownership = resolveAuthoritativeFunnelVisitor({
    candidateVisitor: {
      id: "visitor-new",
      visitorToken: "new-cookie-token",
    },
    candidateVisitorType: "new",
    visitorTokenFromCookie: null,
    session: null,
    sessionVisitor: null,
  });

  assert.equal(ownership.sessionVisitorIsAuthoritative, false);
  assert.equal(ownership.visitor.id, "visitor-new");
  assert.equal(ownership.visitorType, "new");
  assert.equal(ownership.setVisitorCookie, true);
});

test("booking funnel client no longer sends a separate booking_started event", () => {
  const source = readRepoFile("src/lib/analytics/booking-funnel-client.tsx");

  assert.equal(source.includes('eventName: "booking_started"'), false);
  assert.match(source, /eventName: "booking_step_viewed"/);
});

test("booking funnel client does not create a new session for repeated confirmation after completion", () => {
  const source = readRepoFile("src/lib/analytics/booking-funnel-client.tsx");

  assert.match(source, /stepKey === "confirmation" && existingSession\?\.completedAt/);
  assert.match(source, /return;/);
});

test("booking funnel server enforces authoritative session visitor for event writes", () => {
  const source = readRepoFile("src/lib/analytics/booking-funnel-server.ts");

  assert.match(source, /resolveAuthoritativeFunnelVisitor/);
  assert.match(source, /visitorId: visitor\.id/);
  assert.doesNotMatch(source, /visitorId: resolvedVisitor\.visitor\.id/);
  assert.match(source, /getExistingSession\(input\.businessId, input\.bookingSessionToken\)/);
});

test("booking funnel ownership migration protects future event/session visitor mismatches", () => {
  const source = readRepoFile(
    "supabase/migrations/202608130104_harden_booking_funnel_event_session_ownership.sql",
  );

  assert.match(source, /analytics_booking_events_session_visitor_match_fkey/);
  assert.match(source, /foreign key \(booking_session_id, business_id, visitor_id\)/);
  assert.match(source, /references public\.analytics_booking_sessions \(id, business_id, visitor_id\)/);
  assert.match(source, /not valid/i);
});
