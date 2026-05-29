import { NextResponse } from "next/server";
import { isIP } from "node:net";
import {
  CARD_ON_FILE_CONSENT_TEXT,
  CARD_ON_FILE_CONSENT_VERSION,
  RENTAL_TERMS_CONSENT_TEXT,
  RENTAL_TERMS_VERSION,
} from "@/lib/booking-terms";
import { recordBookingConsent } from "@/lib/booking-consents";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTenant } from "@/lib/tenant/server";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getRequestIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipAddress = forwardedFor || req.headers.get("x-real-ip")?.trim();
  return ipAddress && isIP(ipAddress) ? ipAddress : null;
}

function getConsentConfig(consentType: string, sourcePage: string) {
  if (consentType === "rental_terms" && sourcePage === "confirm") {
    return {
      consentType: "rental_terms" as const,
      sourcePage: "confirm" as const,
      consentVersion: RENTAL_TERMS_VERSION,
      consentText: RENTAL_TERMS_CONSENT_TEXT,
    };
  }

  if (consentType === "card_on_file" && sourcePage === "checkout") {
    return {
      consentType: "card_on_file" as const,
      sourcePage: "checkout" as const,
      consentVersion: CARD_ON_FILE_CONSENT_VERSION,
      consentText: CARD_ON_FILE_CONSENT_TEXT,
    };
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const bookingHoldId = clean(body?.bookingHoldId);
    const consentType = clean(body?.consentType);
    const consentVersion = clean(body?.consentVersion);
    const acceptedAt = clean(body?.acceptedAt);
    const sourcePage = clean(body?.sourcePage);
    const consentConfig = getConsentConfig(consentType, sourcePage);

    if (!bookingHoldId) {
      return NextResponse.json({ ok: false, error: "Missing booking hold." }, { status: 400 });
    }

    if (!consentConfig) {
      return NextResponse.json({ ok: false, error: "Invalid consent request." }, { status: 400 });
    }

    if (consentVersion && consentVersion !== consentConfig.consentVersion) {
      return NextResponse.json({ ok: false, error: "Please review the consent details again." }, { status: 400 });
    }

    if (!acceptedAt || Number.isNaN(Date.parse(acceptedAt))) {
      return NextResponse.json({ ok: false, error: "Invalid acceptance timestamp." }, { status: 400 });
    }

    const hold = await supabaseAdmin
      .from("booking_holds")
      .select("id, status, expires_at")
      .eq("id", bookingHoldId)
      .maybeSingle();

    if (hold.error) {
      return NextResponse.json(
        { ok: false, error: hold.error.message || "Could not verify booking hold." },
        { status: 500 },
      );
    }

    if (!hold.data || hold.data.status !== "active" || Date.parse(hold.data.expires_at) <= Date.now()) {
      return NextResponse.json(
        { ok: false, error: "Your hold has expired. Please choose a new delivery date." },
        { status: 409 },
      );
    }

    const tenant = await getCurrentTenant();
    const consent = await recordBookingConsent({
      businessId: tenant.id,
      bookingHoldId,
      consentType: consentConfig.consentType,
      consentVersion: consentConfig.consentVersion,
      consentText: consentConfig.consentText,
      acceptedAt,
      sourcePage: consentConfig.sourcePage,
      ipAddress: getRequestIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, consentId: consent.id });
  } catch (error) {
    console.error("[booking-consents] failed to record booking consent:", error);
    return NextResponse.json(
      { ok: false, error: "We could not record your acceptance. Please try again." },
      { status: 500 },
    );
  }
}
