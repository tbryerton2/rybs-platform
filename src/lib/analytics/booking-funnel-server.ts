import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";
import { getServerTenantStorageKeyForTenant } from "@/lib/tenant/server";
import {
  classifyVisitorType,
  isBookingFunnelEventName,
  isBookingFunnelStepKey,
  isSafeAnalyticsToken,
  normalizeDeviceType,
  resolveAuthoritativeFunnelVisitor,
  shouldResumeBookingSession,
  type BookingFunnelDeviceType,
  type BookingFunnelEventName,
  type BookingFunnelStepKey,
  type BookingFunnelVisitorType,
} from "./booking-funnel-core";

type AnalyticsVisitorRow = {
  id: string;
  visitor_token: string;
};

type AnalyticsBookingSessionRow = {
  id: string;
  visitor_id: string;
  last_event_at: string;
  visitor_type: BookingFunnelVisitorType;
  device_type: BookingFunnelDeviceType;
  resumed_count: number;
  first_resumed_at: string | null;
};

type ResolvedVisitorResult =
  | {
      visitor: AnalyticsVisitorRow;
      existed: boolean;
      setVisitorCookie: boolean;
    }
  | {
      error: string;
    };

export type BookingFunnelEventInput = {
  businessId: string;
  eventName: BookingFunnelEventName;
  bookingSessionToken: string;
  stepKey?: BookingFunnelStepKey | null;
  idempotencyKey?: string | null;
  bookingHoldId?: string | null;
  bookingId?: string | null;
  dumpsterProductId?: string | null;
  dumpsterSize?: string | null;
  metadata?: Record<string, unknown>;
};

export type BookingFunnelEventResult =
  | {
      ok: true;
      setVisitorCookie: boolean;
      visitorToken: string;
      visitorType: BookingFunnelVisitorType;
      deviceType: BookingFunnelDeviceType;
      resumed: boolean;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

const UNIQUE_VIOLATION = "23505";
const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function isUuid(value: string | null | undefined) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "").trim(),
  );
}

function getRequestDeviceType(request: Request) {
  return normalizeDeviceType({
    userAgent: request.headers.get("user-agent"),
    secChUaMobile: request.headers.get("sec-ch-ua-mobile"),
    secChUaPlatform: request.headers.get("sec-ch-ua-platform"),
  });
}

function getInsertIdempotencyKey(
  eventName: BookingFunnelEventName,
  sessionId: string,
  inputIdempotencyKey: string | null | undefined,
) {
  if (eventName === "booking_started") return `booking_started:${sessionId}`;
  if (eventName === "booking_completed") return `booking_completed:${sessionId}`;
  return normalizeNullableText(inputIdempotencyKey);
}

async function insertEventIgnoringDuplicate(input: {
  businessId: string;
  visitorId: string;
  sessionId: string;
  eventName: BookingFunnelEventName;
  stepKey?: BookingFunnelStepKey | null;
  deviceType: BookingFunnelDeviceType;
  visitorType: BookingFunnelVisitorType;
  bookingHoldId?: string | null;
  bookingId?: string | null;
  dumpsterProductId?: string | null;
  dumpsterSize?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("analytics_booking_events").insert({
    business_id: input.businessId,
    visitor_id: input.visitorId,
    booking_session_id: input.sessionId,
    event_name: input.eventName,
    step_key: input.stepKey ?? null,
    device_type: input.deviceType,
    visitor_type: input.visitorType,
    booking_hold_id: isUuid(input.bookingHoldId) ? input.bookingHoldId : null,
    booking_id: isUuid(input.bookingId) ? input.bookingId : null,
    dumpster_product_id: normalizeNullableText(input.dumpsterProductId),
    dumpster_size: normalizeNullableText(input.dumpsterSize),
    idempotency_key: getInsertIdempotencyKey(input.eventName, input.sessionId, input.idempotencyKey),
    metadata: input.metadata ?? {},
  });

  if (error && error.code !== UNIQUE_VIOLATION) {
    throw new Error(error.message);
  }
}

async function getExistingVisitor(businessId: string, visitorToken: string) {
  const { data, error } = await supabaseAdmin
    .from("analytics_visitors")
    .select("id, visitor_token")
    .eq("business_id", businessId)
    .eq("visitor_token", visitorToken)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as AnalyticsVisitorRow | null;
}

async function getVisitorById(businessId: string, visitorId: string) {
  const { data, error } = await supabaseAdmin
    .from("analytics_visitors")
    .select("id, visitor_token")
    .eq("business_id", businessId)
    .eq("id", visitorId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as AnalyticsVisitorRow | null;
}

async function getExistingSession(businessId: string, sessionToken: string) {
  const { data, error } = await supabaseAdmin
    .from("analytics_booking_sessions")
    .select("id, visitor_id, last_event_at, visitor_type, device_type, resumed_count, first_resumed_at")
    .eq("business_id", businessId)
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as AnalyticsBookingSessionRow | null;
}

async function createVisitor(businessId: string, visitorToken: string) {
  const { data, error } = await supabaseAdmin
    .from("analytics_visitors")
    .insert({
      business_id: businessId,
      visitor_token: visitorToken,
    })
    .select("id, visitor_token")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const existing = await getExistingVisitor(businessId, visitorToken);
      if (existing) return { visitor: existing, existed: true };
    }

    throw new Error(error.message);
  }

  return { visitor: data as AnalyticsVisitorRow, existed: false };
}

async function resolveVisitor(input: {
  businessId: string;
  visitorTokenFromCookie: string | null;
  existingSession: AnalyticsBookingSessionRow | null;
}): Promise<ResolvedVisitorResult> {
  if (input.existingSession) {
    const visitor = await getVisitorById(input.businessId, input.existingSession.visitor_id);
    if (!visitor) return { error: "Analytics visitor was not found." as const };

    return {
      visitor,
      existed: true,
      setVisitorCookie: input.visitorTokenFromCookie !== visitor.visitor_token,
    };
  }

  const visitorToken = input.visitorTokenFromCookie || crypto.randomUUID();
  const { visitor, existed } = await createVisitor(input.businessId, visitorToken);
  return {
    visitor,
    existed,
    setVisitorCookie: !input.visitorTokenFromCookie,
  };
}

async function createSession(input: {
  businessId: string;
  visitorId: string;
  sessionToken: string;
  deviceType: BookingFunnelDeviceType;
  visitorType: BookingFunnelVisitorType;
  bookingHoldId?: string | null;
  bookingId?: string | null;
  dumpsterProductId?: string | null;
  dumpsterSize?: string | null;
}): Promise<{ session: AnalyticsBookingSessionRow | null; created: boolean }> {
  const { data, error } = await supabaseAdmin
    .from("analytics_booking_sessions")
    .insert({
      business_id: input.businessId,
      visitor_id: input.visitorId,
      session_token: input.sessionToken,
      device_type: input.deviceType,
      visitor_type: input.visitorType,
      booking_hold_id: isUuid(input.bookingHoldId) ? input.bookingHoldId : null,
      booking_id: isUuid(input.bookingId) ? input.bookingId : null,
      dumpster_product_id: normalizeNullableText(input.dumpsterProductId),
      dumpster_size: normalizeNullableText(input.dumpsterSize),
    })
    .select("id, visitor_id, last_event_at, visitor_type, device_type, resumed_count, first_resumed_at")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        session: await getExistingSession(input.businessId, input.sessionToken),
        created: false,
      };
    }

    throw new Error(error.message);
  }

  return { session: data as AnalyticsBookingSessionRow, created: true };
}

async function updateSessionContext(input: {
  businessId: string;
  sessionId: string;
  eventName?: BookingFunnelEventName;
  bookingHoldId?: string | null;
  bookingId?: string | null;
  dumpsterProductId?: string | null;
  dumpsterSize?: string | null;
}) {
  const patch: Record<string, unknown> = {
    last_event_at: new Date().toISOString(),
  };

  if (isUuid(input.bookingHoldId)) patch.booking_hold_id = input.bookingHoldId;
  if (isUuid(input.bookingId)) patch.booking_id = input.bookingId;
  if (normalizeNullableText(input.dumpsterProductId)) {
    patch.dumpster_product_id = normalizeNullableText(input.dumpsterProductId);
  }
  if (normalizeNullableText(input.dumpsterSize)) {
    patch.dumpster_size = normalizeNullableText(input.dumpsterSize);
  }
  if (input.eventName === "booking_completed") {
    patch.completed_at = new Date().toISOString();
  }

  const { error } = await supabaseAdmin
    .from("analytics_booking_sessions")
    .update(patch)
    .eq("business_id", input.businessId)
    .eq("id", input.sessionId);

  if (error) throw new Error(error.message);
}

async function linkSessionContext(input: {
  businessId: string;
  sessionId: string;
  bookingHoldId?: string | null;
  bookingId?: string | null;
  dumpsterProductId?: string | null;
  dumpsterSize?: string | null;
}) {
  const patch: Record<string, unknown> = {};

  if (isUuid(input.bookingHoldId)) patch.booking_hold_id = input.bookingHoldId;
  if (isUuid(input.bookingId)) patch.booking_id = input.bookingId;
  if (normalizeNullableText(input.dumpsterProductId)) {
    patch.dumpster_product_id = normalizeNullableText(input.dumpsterProductId);
  }
  if (normalizeNullableText(input.dumpsterSize)) {
    patch.dumpster_size = normalizeNullableText(input.dumpsterSize);
  }

  if (!Object.keys(patch).length) return;

  const { error } = await supabaseAdmin
    .from("analytics_booking_sessions")
    .update(patch)
    .eq("business_id", input.businessId)
    .eq("id", input.sessionId);

  if (error) throw new Error(error.message);
}

export async function recordBookingFunnelEventFromRequest(
  request: Request,
  input: BookingFunnelEventInput,
): Promise<BookingFunnelEventResult> {
  try {
    if (!isBookingFunnelEventName(input.eventName)) {
      return { ok: false, status: 400, error: "Unsupported analytics event." };
    }

    if (!isSafeAnalyticsToken(input.bookingSessionToken)) {
      return { ok: false, status: 400, error: "Invalid analytics session token." };
    }

    if (input.eventName === "booking_step_viewed" && !isBookingFunnelStepKey(input.stepKey)) {
      return { ok: false, status: 400, error: "Unsupported booking funnel step." };
    }

    if (input.idempotencyKey && !isSafeAnalyticsToken(input.idempotencyKey)) {
      return { ok: false, status: 400, error: "Invalid analytics idempotency key." };
    }

    const deviceType = getRequestDeviceType(request);
    const visitorCookieName = await getServerTenantStorageKeyForTenant(
      input.businessId,
      TENANT_STORAGE_KEYS.analyticsVisitor,
    );
    const jar = await cookies();
    const visitorTokenFromCookie = isSafeAnalyticsToken(jar.get(visitorCookieName)?.value)
      ? jar.get(visitorCookieName)?.value.trim() ?? null
      : null;
    const existingSession = await getExistingSession(input.businessId, input.bookingSessionToken);
    const resolvedVisitor = await resolveVisitor({
      businessId: input.businessId,
      visitorTokenFromCookie,
      existingSession,
    });

    if ("error" in resolvedVisitor) {
      return { ok: false, status: 409, error: resolvedVisitor.error };
    }

    let visitor = resolvedVisitor.visitor;
    let visitorType = existingSession?.visitor_type ?? classifyVisitorType(resolvedVisitor.existed);
    let setVisitorCookie = resolvedVisitor.setVisitorCookie;
    let session = existingSession;
    let sessionCreated = false;

    if (!session) {
      const createdSession = await createSession({
        businessId: input.businessId,
        visitorId: visitor.id,
        sessionToken: input.bookingSessionToken,
        deviceType,
        visitorType,
        bookingHoldId: input.bookingHoldId,
        bookingId: input.bookingId,
        dumpsterProductId: input.dumpsterProductId,
        dumpsterSize: input.dumpsterSize,
      });

      session = createdSession.session;
      sessionCreated = createdSession.created;
    }

    if (!session) {
      return { ok: false, status: 500, error: "Analytics session could not be created." };
    }

    const sessionVisitor = session.visitor_id === visitor.id
      ? visitor
      : await getVisitorById(input.businessId, session.visitor_id);

    if (!sessionVisitor) {
      return { ok: false, status: 500, error: "Analytics session visitor could not be resolved." };
    }

    const authoritative = resolveAuthoritativeFunnelVisitor({
      candidateVisitor: {
        id: visitor.id,
        visitorToken: visitor.visitor_token,
      },
      candidateVisitorType: visitorType,
      visitorTokenFromCookie,
      session: {
        visitorId: session.visitor_id,
        visitorType: session.visitor_type,
      },
      sessionVisitor: {
        id: sessionVisitor.id,
        visitorToken: sessionVisitor.visitor_token,
      },
    });

    visitor = {
      id: authoritative.visitor.id,
      visitor_token: authoritative.visitor.visitorToken,
    };
    visitorType = authoritative.visitorType;
    setVisitorCookie = authoritative.setVisitorCookie;

    const now = new Date();
    const resumed = !!existingSession && shouldResumeBookingSession(existingSession.last_event_at, now);

    if (!existingSession) {
      await insertEventIgnoringDuplicate({
        businessId: input.businessId,
        visitorId: visitor.id,
        sessionId: session.id,
        eventName: "booking_started",
        deviceType,
        visitorType,
        bookingHoldId: input.bookingHoldId,
        bookingId: input.bookingId,
        dumpsterProductId: input.dumpsterProductId,
        dumpsterSize: input.dumpsterSize,
        metadata: { source: "session_created" },
      });
    } else if (resumed && input.eventName !== "booking_resumed") {
      const resumedAt = now.toISOString();
      await insertEventIgnoringDuplicate({
        businessId: input.businessId,
        visitorId: visitor.id,
        sessionId: session.id,
        eventName: "booking_resumed",
        deviceType: session.device_type ?? deviceType,
        visitorType,
        bookingHoldId: input.bookingHoldId,
        bookingId: input.bookingId,
        dumpsterProductId: input.dumpsterProductId,
        dumpsterSize: input.dumpsterSize,
        idempotencyKey: `booking_resumed:${session.id}:${existingSession.last_event_at}`,
        metadata: {
          resumedAfterMs: now.getTime() - new Date(existingSession.last_event_at).getTime(),
          previousLastEventAt: existingSession.last_event_at,
        },
      });

      const { error: resumeUpdateError } = await supabaseAdmin
        .from("analytics_booking_sessions")
        .update({
          resumed_count: Number(existingSession.resumed_count ?? 0) + 1,
          first_resumed_at: existingSession.first_resumed_at ?? resumedAt,
          last_resumed_at: resumedAt,
        })
        .eq("business_id", input.businessId)
        .eq("id", session.id);

      if (resumeUpdateError) throw new Error(resumeUpdateError.message);
    }

    if (input.eventName !== "booking_started" || !sessionCreated) {
      await insertEventIgnoringDuplicate({
        businessId: input.businessId,
        visitorId: visitor.id,
        sessionId: session.id,
        eventName: input.eventName,
        stepKey: input.stepKey ?? null,
        deviceType: session.device_type ?? deviceType,
        visitorType,
        bookingHoldId: input.bookingHoldId,
        bookingId: input.bookingId,
        dumpsterProductId: input.dumpsterProductId,
        dumpsterSize: input.dumpsterSize,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
      });
    }

    await updateSessionContext({
      businessId: input.businessId,
      sessionId: session.id,
      eventName: input.eventName,
      bookingHoldId: input.bookingHoldId,
      bookingId: input.bookingId,
      dumpsterProductId: input.dumpsterProductId,
      dumpsterSize: input.dumpsterSize,
    });

    const { error: visitorUpdateError } = await supabaseAdmin
      .from("analytics_visitors")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("business_id", input.businessId)
      .eq("id", visitor.id);

    if (visitorUpdateError) throw new Error(visitorUpdateError.message);

    return {
      ok: true,
      setVisitorCookie,
      visitorToken: visitor.visitor_token,
      visitorType,
      deviceType,
      resumed,
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: error instanceof Error ? error.message : "Analytics ingestion failed.",
    };
  }
}

export async function linkBookingHoldToFunnelSessionFromRequest(
  _request: Request,
  input: {
    businessId: string;
    bookingSessionToken?: string | null;
    bookingHoldId: string;
    dumpsterProductId?: string | null;
    dumpsterSize?: string | null;
  },
) {
  if (!isSafeAnalyticsToken(input.bookingSessionToken)) return;

  try {
    const session = await getExistingSession(input.businessId, input.bookingSessionToken);
    if (!session) return;

    await linkSessionContext({
      businessId: input.businessId,
      sessionId: session.id,
      bookingHoldId: input.bookingHoldId,
      dumpsterProductId: input.dumpsterProductId,
      dumpsterSize: input.dumpsterSize,
    });
  } catch (error) {
    console.warn("[booking-funnel-analytics] hold link skipped", {
      businessId: input.businessId,
      bookingHoldId: input.bookingHoldId,
      error: error instanceof Error ? error.message : "Unknown analytics error.",
    });
  }
}

export function attachAnalyticsVisitorCookie(
  response: NextResponse,
  businessId: string,
  visitorToken: string,
) {
  return getServerTenantStorageKeyForTenant(businessId, TENANT_STORAGE_KEYS.analyticsVisitor).then(
    (cookieName) => {
      response.cookies.set(cookieName, visitorToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
      });
      return response;
    },
  );
}
