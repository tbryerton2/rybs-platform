// src/app/api/hold/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDeliveryAvailabilitySnapshot } from "@/lib/booking-availability";
import { resolveSelectedDumpster } from "@/lib/booking-product";
import { addDaysYmd, getRentalPeriodDetails } from "@/lib/booking-pricing";
import { getDumpsterRentalPolicy } from "@/lib/dumpster-rental-policy";
import { supabase } from "@/lib/supabase";
import {
  getRetailCalendarClosureForDate,
  getRetailSiteSettings,
} from "@/lib/tenant/retail-site-settings";
import { getServerTenantStorageKey } from "@/lib/tenant/server";
import { TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";
import { getHoldMinutes } from "@/lib/config";

async function getOrCreateClientId() {
  const jar = await cookies(); // ✅ await fixes "jar.get is not a function"
  const clientCookieKey = await getServerTenantStorageKey(TENANT_STORAGE_KEYS.portalClientId);
  const existing = (jar.get(clientCookieKey)?.value || "").trim();
  if (existing) return { clientId: existing, setCookie: false };

  const clientId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return { clientId, setCookie: true };
}

function attachClientIdCookie(res: NextResponse, clientId: string) {
  const cookieNamePromise = getServerTenantStorageKey(TENANT_STORAGE_KEYS.portalClientId);
  return cookieNamePromise.then((cookieName) => {
  // 30 days
    res.cookies.set(cookieName, clientId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: `POST to this endpoint with { deliveryDate: 'YYYY-MM-DD' } to create a ${getHoldMinutes()}-minute hold.`,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const deliveryDate = (body?.deliveryDate || "").trim();
    const rentalDaysRaw = body?.rentalDays;
    const zip = (body?.zip || "").trim();
    const selectedDumpster = resolveSelectedDumpster({
      dumpsterSize: body?.dumpsterSize,
      dumpsterProductId: body?.dumpsterProductId,
    });
    const rentalPolicy = await getDumpsterRentalPolicy(selectedDumpster);
    const requestedRentalDays =
      Number.isFinite(Number(rentalDaysRaw)) && Number(rentalDaysRaw) > 0
        ? Math.floor(Number(rentalDaysRaw))
        : rentalPolicy.standardRentalDays;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
      return NextResponse.json(
        { ok: false, error: "Invalid deliveryDate. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const requestedPickupDate = addDaysYmd(deliveryDate, requestedRentalDays);
    const rentalPeriod = getRentalPeriodDetails({
      deliveryDate,
      pickupDate: requestedPickupDate,
      pickupMode: "date",
      standardRentalDays: rentalPolicy.standardRentalDays,
      dailyOveragePrice: rentalPolicy.dailyOveragePrice,
      maxRentalDays: rentalPolicy.maxRentalDays,
      allowExtendedRentalAtBooking: rentalPolicy.allowExtendedRentalAtBooking,
    });

    if (rentalPeriod.validationError || rentalPeriod.bookedRentalDays == null) {
      return NextResponse.json(
        { ok: false, error: rentalPeriod.validationError || "Invalid rental length." },
        { status: 400 }
      );
    }

    const retailSiteSettings = await getRetailSiteSettings();
    const closure = getRetailCalendarClosureForDate(deliveryDate, retailSiteSettings);
    if (closure.blocked) {
      return NextResponse.json(
        { ok: false, error: closure.label || "That delivery date is blocked." },
        { status: 409 }
      );
    }

    // ✅ Client/session guard (prevents one browser from spamming holds)
    const { clientId, setCookie } = await getOrCreateClientId();
    const nowIso = new Date().toISOString();


    // 0) If this client already has an active hold for THIS date, reuse it.
    const existingHold = await supabase
      .from("booking_holds")
      .select("id, delivery_date, pickup_date, expires_at, zip, dumpster_size, dumpster_product_id")
      .eq("client_id", clientId)
      .eq("delivery_date", deliveryDate)
      .eq("pickup_date", requestedPickupDate)
      .eq("dumpster_size", selectedDumpster.dumpsterSize)
      .eq("dumpster_product_id", selectedDumpster.dumpsterProductId)
      .eq("status", "active")
      .gt("expires_at", nowIso)
      .limit(1)
      .maybeSingle();

    if (existingHold.error) {
      return NextResponse.json(
        { ok: false, error: existingHold.error.message || "Hold lookup failed." },
        { status: 500 }
      );
    }

    if (existingHold.data?.id) {
      const holdMinutes = getHoldMinutes();
      const res = NextResponse.json({
        ok: true,
        reused: true,
        holdId: existingHold.data.id,
        deliveryDate: existingHold.data.delivery_date,
        expiresAt: existingHold.data.expires_at,
        holdMinutes,
      });

      return setCookie ? await attachClientIdCookie(res, clientId) : res;
    }

    // 🔒 Basic rate limit: 1 new hold per 10 seconds per client
    const tenSecondsAgoIso = new Date(Date.now() - 10_000).toISOString();

    const recentHold = await supabase
      .from("booking_holds")
      .select("id")
      .eq("client_id", clientId)
      .gte("created_at", tenSecondsAgoIso)
      .limit(1);

    if (recentHold.error) {
      return NextResponse.json(
        { ok: false, error: "Rate limit check failed." },
        { status: 500 }
      );
    }

    if (recentHold.data && recentHold.data.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Please wait a few seconds before trying again." },
        { status: 429 }
      );
    }


    // 1) Expire any OTHER active holds for this client (so one client can't hold many dates)
    const expireRes = await supabase.rpc("expire_active_holds_for_client", {
      p_client_id: clientId,
    });

    if (expireRes.error) {
      return NextResponse.json(
        { ok: false, error: expireRes.error.message || "Could not clear previous holds." },
        { status: 500 }
      );
    }

    // 2) Check current remaining capacity for this date
    let remaining = 0;

    try {
      const availability = await getDeliveryAvailabilitySnapshot({
        deliveryDate,
        rpcDays: rentalPeriod.bookedRentalDays,
        dumpsterSize: selectedDumpster.dumpsterSize,
        dumpsterProductId: selectedDumpster.dumpsterProductId,
        pickupDate: requestedPickupDate,
        logContext: "api/hold",
      });

      remaining = availability.remaining;
    } catch (error) {
      console.error("[api/hold] Delivery availability request failed.", error);
      const message = error instanceof Error ? error.message : "Availability check failed.";
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }

    if (!Number.isFinite(remaining) || remaining <= 0) {
      return NextResponse.json(
        { ok: false, error: "No dumpsters available for that date." },
        { status: 409 }
      );
    }

    // 3) Create hold with configurable expiration
    const holdMinutes = getHoldMinutes();
    const expiresAtIso = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString();

    if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) {
      return NextResponse.json(
        { ok: false, error: "Invalid zip." },
        { status: 400 }
      );
    }

    const insert = await supabase
      .from("booking_holds")
      .insert({
        delivery_date: deliveryDate,
        pickup_date: requestedPickupDate,
        status: "active",
        expires_at: expiresAtIso,
        client_id: clientId, // ✅ important
        zip: zip || null,
        dumpster_size: selectedDumpster.dumpsterSize,
        dumpster_product_id: selectedDumpster.dumpsterProductId,
      })
      .select("id, delivery_date, pickup_date, expires_at, zip, dumpster_size, dumpster_product_id")
      .single();

    if (insert.error) {
      return NextResponse.json(
        { ok: false, error: insert.error.message || "Hold failed." },
        { status: 500 }
      );
    }

    const availAfter = await getDeliveryAvailabilitySnapshot({
      deliveryDate,
      rpcDays: rentalPeriod.bookedRentalDays,
      dumpsterSize: selectedDumpster.dumpsterSize,
      dumpsterProductId: selectedDumpster.dumpsterProductId,
      pickupDate: requestedPickupDate,
      logContext: "api/hold/post-insert",
    }).catch(() => ({ remaining: Math.max(0, remaining - 1) }));
    const remainingAfterHold = Number(availAfter.remaining ?? Math.max(0, remaining - 1));

    const res = NextResponse.json({
      ok: true,
      holdId: insert.data.id,
      deliveryDate: insert.data.delivery_date,
      expiresAt: insert.data.expires_at,
      zip: insert.data.zip,   // 👈 ADD THIS
      remainingAfterHold,
      holdMinutes,
    });

    return setCookie ? await attachClientIdCookie(res, clientId) : res;

  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Hold failed." },
      { status: 500 }
    );
  }
}
