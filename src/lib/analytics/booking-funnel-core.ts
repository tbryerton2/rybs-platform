export const BOOKING_FUNNEL_EVENT_NAMES = [
  "booking_started",
  "booking_step_viewed",
  "booking_resumed",
  "booking_completed",
] as const;

export type BookingFunnelEventName = (typeof BOOKING_FUNNEL_EVENT_NAMES)[number];

export const BOOKING_FUNNEL_STEP_KEYS = [
  "service_area",
  "rental_options",
  "rental_timing",
  "placement_details",
  "review",
  "checkout",
  "confirmation",
] as const;

export type BookingFunnelStepKey = (typeof BOOKING_FUNNEL_STEP_KEYS)[number];

export const BOOKING_FUNNEL_RESUME_AFTER_MS = 30 * 60 * 1000;
export const BOOKING_FUNNEL_SESSION_EXPIRES_AFTER_MS = 24 * 60 * 60 * 1000;

export type BookingFunnelDeviceType = "desktop" | "mobile" | "tablet" | "unknown";
export type BookingFunnelVisitorType = "new" | "returning";

export type BookingFunnelOwnershipVisitor = {
  id: string;
  visitorToken: string;
};

export type BookingFunnelOwnershipSession = {
  visitorId: string;
  visitorType: BookingFunnelVisitorType;
};

const EVENT_NAME_SET = new Set<string>(BOOKING_FUNNEL_EVENT_NAMES);
const STEP_KEY_SET = new Set<string>(BOOKING_FUNNEL_STEP_KEYS);
const SAFE_TOKEN_PATTERN = /^[a-zA-Z0-9._:-]{8,160}$/;

export function isBookingFunnelEventName(value: unknown): value is BookingFunnelEventName {
  return typeof value === "string" && EVENT_NAME_SET.has(value);
}

export function isBookingFunnelStepKey(value: unknown): value is BookingFunnelStepKey {
  return typeof value === "string" && STEP_KEY_SET.has(value);
}

export function isSafeAnalyticsToken(value: unknown): value is string {
  return typeof value === "string" && SAFE_TOKEN_PATTERN.test(value.trim());
}

export function classifyVisitorType(hasPriorVisitorRecord: boolean): BookingFunnelVisitorType {
  return hasPriorVisitorRecord ? "returning" : "new";
}

export function resolveAuthoritativeFunnelVisitor(input: {
  candidateVisitor: BookingFunnelOwnershipVisitor;
  candidateVisitorType: BookingFunnelVisitorType;
  visitorTokenFromCookie?: string | null;
  session?: BookingFunnelOwnershipSession | null;
  sessionVisitor?: BookingFunnelOwnershipVisitor | null;
}) {
  const sessionVisitorIsAuthoritative =
    !!input.session && !!input.sessionVisitor && input.session.visitorId === input.sessionVisitor.id;
  const visitor: BookingFunnelOwnershipVisitor =
    sessionVisitorIsAuthoritative && input.sessionVisitor
      ? input.sessionVisitor
      : input.candidateVisitor;
  const visitorType = sessionVisitorIsAuthoritative
    ? input.session?.visitorType ?? input.candidateVisitorType
    : input.candidateVisitorType;
  const visitorTokenFromCookie = input.visitorTokenFromCookie?.trim() || null;

  return {
    visitor,
    visitorType,
    setVisitorCookie: visitorTokenFromCookie !== visitor.visitorToken,
    sessionVisitorIsAuthoritative,
  };
}

export function shouldResumeBookingSession(
  lastEventAt: string | Date | null | undefined,
  now: Date,
  thresholdMs = BOOKING_FUNNEL_RESUME_AFTER_MS,
) {
  if (!lastEventAt) return false;
  const previous = lastEventAt instanceof Date ? lastEventAt : new Date(lastEventAt);
  const previousTime = previous.getTime();
  return Number.isFinite(previousTime) && now.getTime() - previousTime >= thresholdMs;
}

export function shouldStartNewBookingSession(input: {
  lastEventAt?: string | number | null;
  completedAt?: string | number | null;
  nowMs: number;
  expiresAfterMs?: number;
}) {
  if (input.completedAt) return true;
  if (!input.lastEventAt) return true;

  const lastEventMs =
    typeof input.lastEventAt === "number" ? input.lastEventAt : Date.parse(input.lastEventAt);

  if (!Number.isFinite(lastEventMs)) return true;

  return input.nowMs - lastEventMs > (input.expiresAfterMs ?? BOOKING_FUNNEL_SESSION_EXPIRES_AFTER_MS);
}

export function normalizeDeviceType(input: {
  userAgent?: string | null;
  secChUaMobile?: string | null;
  secChUaPlatform?: string | null;
}): BookingFunnelDeviceType {
  const mobileHint = String(input.secChUaMobile ?? "").trim();
  if (mobileHint === "?1") return "mobile";

  const platformHint = String(input.secChUaPlatform ?? "").toLowerCase();
  const ua = String(input.userAgent ?? "").toLowerCase();

  if (!ua && !platformHint) return "unknown";

  if (/\b(ipad|tablet|kindle|silk|playbook)\b/.test(ua)) return "tablet";
  if (/\bandroid\b/.test(ua) && !/\bmobile\b/.test(ua)) return "tablet";
  if (platformHint.includes("ipad")) return "tablet";

  if (
    /\b(mobi|iphone|ipod|android|blackberry|windows phone)\b/.test(ua) ||
    platformHint.includes("android")
  ) {
    return "mobile";
  }

  if (
    /\b(macintosh|windows nt|x11|linux x86_64|cros)\b/.test(ua) ||
    platformHint.includes("mac") ||
    platformHint.includes("windows") ||
    platformHint.includes("linux") ||
    platformHint.includes("chrome os")
  ) {
    return "desktop";
  }

  return "unknown";
}
