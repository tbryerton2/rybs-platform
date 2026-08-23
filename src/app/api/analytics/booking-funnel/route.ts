import { NextResponse } from "next/server";
import {
  attachAnalyticsVisitorCookie,
  recordBookingFunnelEventFromRequest,
} from "@/lib/analytics/booking-funnel-server";
import {
  isBookingFunnelEventName,
  isBookingFunnelStepKey,
  isSafeAnalyticsToken,
  type BookingFunnelEventName,
  type BookingFunnelStepKey,
} from "@/lib/analytics/booking-funnel-core";
import { isTenantResolutionError } from "@/lib/tenant/resolution";
import { getCurrentTenant } from "@/lib/tenant/server";

type BookingFunnelRequestBody = {
  eventName?: unknown;
  stepKey?: unknown;
  bookingSessionToken?: unknown;
  idempotencyKey?: unknown;
  bookingHoldId?: unknown;
  bookingId?: unknown;
  dumpsterProductId?: unknown;
  dumpsterSize?: unknown;
  metadata?: unknown;
};

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key.length <= 40)
      .slice(0, 20)
      .map(([key, nestedValue]) => {
        if (typeof nestedValue === "string") return [key, nestedValue.slice(0, 160)];
        if (typeof nestedValue === "number" || typeof nestedValue === "boolean") {
          return [key, nestedValue];
        }
        return [key, null];
      }),
  );
}

export async function POST(request: Request) {
  try {
    const tenant = await getCurrentTenant();
    const body = (await request.json().catch(() => ({}))) as BookingFunnelRequestBody;
    const eventName = isBookingFunnelEventName(body.eventName)
      ? (body.eventName as BookingFunnelEventName)
      : null;
    const stepKey = isBookingFunnelStepKey(body.stepKey)
      ? (body.stepKey as BookingFunnelStepKey)
      : null;
    const bookingSessionToken = nullableString(body.bookingSessionToken);
    const idempotencyKey = nullableString(body.idempotencyKey);

    if (!eventName) {
      return NextResponse.json({ ok: false, error: "Unsupported analytics event." }, { status: 400 });
    }

    if (eventName === "booking_step_viewed" && !stepKey) {
      return NextResponse.json({ ok: false, error: "Unsupported booking funnel step." }, { status: 400 });
    }

    if (!isSafeAnalyticsToken(bookingSessionToken)) {
      return NextResponse.json({ ok: false, error: "Invalid analytics session token." }, { status: 400 });
    }

    if (idempotencyKey && !isSafeAnalyticsToken(idempotencyKey)) {
      return NextResponse.json({ ok: false, error: "Invalid analytics idempotency key." }, { status: 400 });
    }

    const result = await recordBookingFunnelEventFromRequest(request, {
      businessId: tenant.id,
      eventName,
      stepKey,
      bookingSessionToken,
      idempotencyKey,
      bookingHoldId: nullableString(body.bookingHoldId),
      bookingId: nullableString(body.bookingId),
      dumpsterProductId: nullableString(body.dumpsterProductId),
      dumpsterSize: nullableString(body.dumpsterSize),
      metadata: safeMetadata(body.metadata),
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }

    const response = NextResponse.json({
      ok: true,
      visitorType: result.visitorType,
      deviceType: result.deviceType,
      resumed: result.resumed,
    });

    return result.setVisitorCookie
      ? attachAnalyticsVisitorCookie(response, tenant.id, result.visitorToken)
      : response;
  } catch (error) {
    if (isTenantResolutionError(error)) {
      return NextResponse.json({ ok: false, error: error.publicMessage }, { status: 503 });
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Analytics ingestion failed." },
      { status: 500 },
    );
  }
}
