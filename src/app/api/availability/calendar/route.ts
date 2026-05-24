import { NextResponse } from "next/server";
import { getDeliveryAvailabilitySnapshot } from "@/lib/booking-availability";
import { resolveSelectedDumpster } from "@/lib/booking-product";
import { getDumpsterRentalPolicy } from "@/lib/dumpster-rental-policy";
import {
  getRetailCalendarClosureForDate,
  getRetailSiteSettings,
} from "@/lib/tenant/retail-site-settings";

function isYmd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseYmd(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function addDaysYmd(value: string, days: number) {
  const date = parseYmd(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayYmdUtc() {
  return new Date().toISOString().slice(0, 10);
}

const CALENDAR_RPC_BATCH_SIZE = 14;
const ENABLE_AVAILABILITY_DEBUG_LOGS = process.env.ENABLE_AVAILABILITY_DEBUG_LOGS === "true";

type CalendarAvailabilityResult = {
  date: string;
  remaining: number;
  capacity: number;
  used: number;
  requestedPickupDate: string | null;
  state: "available" | "limited" | "unavailable" | "past";
  label?: string;
  debug?: {
    requestedSelection?: unknown;
    compatibleInventory?: unknown;
    blockingBookings?: unknown;
    blockingHolds?: unknown;
    availableDumpsterIds?: string[];
  };
};

async function getAvailabilityEntry(
  date: string,
  today: string,
  blockedLabel: string | null,
  standardRentalDays: number,
  dumpsterSize: string,
  dumpsterProductId: string | null,
  fixedDeliveryDate: string | null = null,
  activeHoldContext: { holdId: string; deliveryDate: string; pickupDate: string } | null = null,
): Promise<CalendarAvailabilityResult> {
  if (blockedLabel) {
    return {
      date,
      capacity: 0,
      used: 0,
      remaining: 0,
      requestedPickupDate: null,
      state: date < today ? "past" : "unavailable",
      label: blockedLabel,
    };
  }

  if (fixedDeliveryDate && date < fixedDeliveryDate) {
    return {
      date,
      capacity: 0,
      used: 0,
      remaining: 0,
      requestedPickupDate: date,
      state: date < today ? "past" : "unavailable",
      label: "Blocked",
    };
  }

  const requestedDeliveryDate = fixedDeliveryDate ?? date;
  const requestedPickupDate = fixedDeliveryDate ? date : addDaysYmd(date, standardRentalDays);
  const excludeHoldIds =
    activeHoldContext &&
    activeHoldContext.deliveryDate === requestedDeliveryDate &&
    activeHoldContext.pickupDate === requestedPickupDate
      ? [activeHoldContext.holdId]
      : undefined;

  const availability = await getDeliveryAvailabilitySnapshot({
    deliveryDate: requestedDeliveryDate,
    rpcDays: standardRentalDays,
    dumpsterSize,
    dumpsterProductId,
    pickupDate: fixedDeliveryDate ? date : null,
    excludeHoldIds,
    logContext: "api/availability/calendar",
  });

  const capacity = availability.capacity;
  const used = availability.used;
  const remaining = availability.remaining;

  let state: "available" | "limited" | "unavailable" | "past" = "unavailable";
  if (date < today) {
    state = "past";
  } else if (remaining <= 0) {
    state = "unavailable";
  } else if (remaining <= 1) {
    state = "limited";
  } else {
    state = "available";
  }

  return {
    date,
    capacity,
    used,
    remaining,
    requestedPickupDate: availability.requestedPickupDate,
    state,
    debug:
      availability.source === "unit-window"
        ? {
            requestedSelection:
              (availability.debugSummary as { requestedSelection?: unknown } | undefined)
                ?.requestedSelection,
            compatibleInventory:
              (availability.debugSummary as { compatibleInventory?: unknown } | undefined)
                ?.compatibleInventory,
            blockingBookings: availability.overlappingBookings,
            blockingHolds: availability.overlappingHolds,
            availableDumpsterIds: availability.availableDumpsterIds,
          }
        : undefined,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = (url.searchParams.get("start") || "").trim();
  const selectedDumpster = resolveSelectedDumpster({
    dumpsterSize: url.searchParams.get("dumpsterSize"),
    dumpsterProductId: url.searchParams.get("dumpsterProductId"),
  });
  const fixedDeliveryDate = (url.searchParams.get("deliveryDate") || "").trim();
  const rawHoldId = url.searchParams.get("holdId");
  const holdId = (rawHoldId || "").trim();
  const holdDeliveryDate = (url.searchParams.get("holdDeliveryDate") || "").trim();
  const holdPickupDate = (url.searchParams.get("holdPickupDate") || "").trim();
  const rawDays = Number(url.searchParams.get("days") || 0);
  const days = Math.min(186, Math.max(28, Math.floor(rawDays || 112)));

  if (rawHoldId !== null && !holdId) {
    return NextResponse.json({ ok: false, error: "Invalid holdId" }, { status: 400 });
  }

  if (!isYmd(start)) {
    return NextResponse.json({ ok: false, error: "Invalid start date" }, { status: 400 });
  }

  if (fixedDeliveryDate && !isYmd(fixedDeliveryDate)) {
    return NextResponse.json({ ok: false, error: "Invalid deliveryDate" }, { status: 400 });
  }

  if ((holdDeliveryDate || holdPickupDate) && (!isYmd(holdDeliveryDate) || !isYmd(holdPickupDate))) {
    return NextResponse.json({ ok: false, error: "Invalid hold date" }, { status: 400 });
  }

  const activeHoldContext =
    holdId && isYmd(holdDeliveryDate) && isYmd(holdPickupDate)
      ? { holdId, deliveryDate: holdDeliveryDate, pickupDate: holdPickupDate }
      : null;

  const today = todayYmdUtc();

  try {
    const retailSiteSettings = await getRetailSiteSettings();
    const rentalPolicy = await getDumpsterRentalPolicy(selectedDumpster);
    const dates = Array.from({ length: days }, (_, index) => addDaysYmd(start, index));
    const results: CalendarAvailabilityResult[] = [];

    for (let index = 0; index < dates.length; index += CALENDAR_RPC_BATCH_SIZE) {
      const batch = dates.slice(index, index + CALENDAR_RPC_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((date) => {
          const closure = getRetailCalendarClosureForDate(date, retailSiteSettings);
          return getAvailabilityEntry(
            date,
            today,
            closure.blocked ? closure.label : null,
            rentalPolicy.standardRentalDays,
            selectedDumpster.dumpsterSize,
            selectedDumpster.dumpsterProductId,
            fixedDeliveryDate || null,
            activeHoldContext,
          );
        }),
      );
      results.push(...batchResults);
    }

    const nextAvailableDate =
      results.find((entry) => entry.state === "available" || entry.state === "limited")?.date ?? null;

    if (ENABLE_AVAILABILITY_DEBUG_LOGS) {
      console.info("[api/availability/calendar] window availability", {
        requestedDumpsterSize: selectedDumpster.dumpsterSize,
        requestedDumpsterProductId: selectedDumpster.dumpsterProductId,
        fixedDeliveryDate: fixedDeliveryDate || null,
        dates: results.map((entry) => ({
          date: entry.date,
          requestedPickupDate: entry.requestedPickupDate,
          remaining: entry.remaining,
          state: entry.state,
          debug: entry.debug,
        })),
      });
    }

    return NextResponse.json({
      ok: true,
      start,
      days,
      nextAvailableDate,
      dates: results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar availability check failed.";
    console.error("[api/availability/calendar] Delivery calendar request failed.", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
