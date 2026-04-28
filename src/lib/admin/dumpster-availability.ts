import { addDaysYmd, isYmd } from "@/lib/booking-pricing";
import { getPricingSettingsSnapshot } from "@/lib/pricing-settings";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type DumpsterAvailabilityInput = {
  dumpsterSize: string;
  dumpsterProductId?: string | null;
  deliveryDate: string;
  pickupDate?: string | null;
};

export type OverlappingBookingDetail = {
  id: string;
  status: string | null;
  deliveryDate: string;
  effectivePickupDate: string;
};

export type OverlappingHoldDetail = {
  id: string;
  status: string | null;
  deliveryDate: string;
  expiresAt: string;
};

export type DumpsterAvailabilityResult = {
  dumpsterSize: string;
  dumpsterProductId: string | null;
  requestedDeliveryDate: string;
  requestedPickupDate: string;
  totalBookable: number;
  reservedOrInUseFromBookings: number;
  reservedFromHolds: number;
  reservedOrInUse: number;
  available: number;
  overlappingBookingCount: number;
  overlappingBookingIds: string[];
  overlappingBookings: OverlappingBookingDetail[];
  overlappingHoldCount: number;
  overlappingHoldIds: string[];
  overlappingHolds: OverlappingHoldDetail[];
};

type BookingWindowRow = {
  id: string;
  status: string | null;
  delivery_date: string | null;
  pickup_date: string | null;
  included_rental_days: number | null;
  dumpster_size: string | null;
};

type HoldRow = {
  id: string;
  status: string | null;
  delivery_date: string | null;
  expires_at: string | null;
  dumpster_size: string | null;
  dumpster_product_id: string | null;
};

const ACTIVE_BOOKING_STATUSES = new Set(["confirmed", "scheduled", "delivered", "paid"]);
const EXCLUDED_BOOKING_STATUSES = new Set(["cancelled", "picked_up", "draft", "void", "test"]);
const ACTIVE_HOLD_STATUSES = new Set(["active", "converting"]);
const EXCLUDED_HOLD_STATUSES = new Set(["expired", "converted", "cancelled", "released"]);

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function shouldCountBookingStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  if (!normalized) return false;
  if (EXCLUDED_BOOKING_STATUSES.has(normalized)) return false;
  return ACTIVE_BOOKING_STATUSES.has(normalized);
}

function shouldCountHoldStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  if (!normalized) return false;
  if (EXCLUDED_HOLD_STATUSES.has(normalized)) return false;
  return ACTIVE_HOLD_STATUSES.has(normalized);
}

function windowsOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA <= endB && endA >= startB;
}

function normalizeDumpsterSize(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function normalizeDumpsterProductId(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

export async function getPooledDumpsterAvailabilityBySize(
  input: DumpsterAvailabilityInput,
): Promise<DumpsterAvailabilityResult> {
  const dumpsterSize = normalizeDumpsterSize(input.dumpsterSize);
  const dumpsterProductId = normalizeDumpsterProductId(input.dumpsterProductId);
  if (!dumpsterSize) {
    throw new Error("dumpsterSize is required.");
  }

  if (!isYmd(input.deliveryDate)) {
    throw new Error("deliveryDate must use YYYY-MM-DD.");
  }

  const pricingSettings = await getPricingSettingsSnapshot();
  const requestedPickupDate =
    input.pickupDate && isYmd(input.pickupDate)
      ? input.pickupDate
      : addDaysYmd(input.deliveryDate, pricingSettings.standardRentalDays);

  if (!isYmd(requestedPickupDate)) {
    throw new Error("pickupDate must use YYYY-MM-DD.");
  }

  if (requestedPickupDate < input.deliveryDate) {
    throw new Error("pickupDate must be on or after deliveryDate.");
  }

  const nowIso = new Date().toISOString();

  const [dumpstersResult, bookingsResult, holdsResult] = await Promise.all([
    supabaseAdmin
      .from("dumpsters")
      .select("id", { count: "exact", head: true })
      .eq("size", dumpsterSize)
      .eq("active", true)
      .eq("service_status", "Ready")
      .neq("operational_status", "Maintenance hold"),
    supabaseAdmin
      .from("bookings")
      .select("id, status, delivery_date, pickup_date, included_rental_days, dumpster_size")
      .eq("dumpster_size", dumpsterSize)
      .not("delivery_date", "is", null)
      .order("delivery_date", { ascending: true }),
    supabaseAdmin
      .from("booking_holds")
      .select("id, status, delivery_date, expires_at, dumpster_size, dumpster_product_id")
      .eq("dumpster_size", dumpsterSize)
      .gt("expires_at", nowIso)
      .order("delivery_date", { ascending: true }),
  ]);

  if (dumpstersResult.error) {
    throw new Error(dumpstersResult.error.message);
  }

  if (bookingsResult.error) {
    throw new Error(bookingsResult.error.message);
  }

  if (holdsResult.error) {
    throw new Error(holdsResult.error.message);
  }

  const totalBookable = Number(dumpstersResult.count ?? 0);
  const bookings = (bookingsResult.data ?? []) as BookingWindowRow[];
  const holds = (holdsResult.data ?? []) as HoldRow[];
  const overlappingBookings: OverlappingBookingDetail[] = [];
  const overlappingHolds: OverlappingHoldDetail[] = [];

  for (const booking of bookings) {
    if (!shouldCountBookingStatus(booking.status)) continue;
    if (!isYmd(booking.delivery_date)) continue;

    const effectivePickupDate =
      booking.pickup_date && isYmd(booking.pickup_date)
        ? booking.pickup_date
        : addDaysYmd(
            booking.delivery_date,
            Math.max(1, booking.included_rental_days ?? pricingSettings.standardRentalDays),
          );

    if (
      windowsOverlap(
        booking.delivery_date,
        effectivePickupDate,
        input.deliveryDate,
        requestedPickupDate,
      )
    ) {
      overlappingBookings.push({
        id: booking.id,
        status: booking.status,
        deliveryDate: booking.delivery_date,
        effectivePickupDate,
      });
    }
  }

  for (const hold of holds) {
    if (!shouldCountHoldStatus(hold.status)) continue;
    if (!isYmd(hold.delivery_date)) continue;
    if (!hold.expires_at) continue;
    if (normalizeDumpsterSize(hold.dumpster_size) !== dumpsterSize) continue;

    const holdProductId = normalizeDumpsterProductId(hold.dumpster_product_id);
    if (dumpsterProductId && holdProductId && holdProductId !== dumpsterProductId) continue;

    if (windowsOverlap(hold.delivery_date, hold.delivery_date, input.deliveryDate, requestedPickupDate)) {
      overlappingHolds.push({
        id: hold.id,
        status: hold.status,
        deliveryDate: hold.delivery_date,
        expiresAt: hold.expires_at,
      });
    }
  }

  const reservedOrInUseFromBookings = overlappingBookings.length;
  const reservedFromHolds = overlappingHolds.length;
  const reservedOrInUse = reservedOrInUseFromBookings + reservedFromHolds;

  return {
    dumpsterSize,
    dumpsterProductId,
    requestedDeliveryDate: input.deliveryDate,
    requestedPickupDate,
    totalBookable,
    reservedOrInUseFromBookings,
    reservedFromHolds,
    reservedOrInUse,
    available: Math.max(totalBookable - reservedOrInUse, 0),
    overlappingBookingCount: overlappingBookings.length,
    overlappingBookingIds: overlappingBookings.map((booking) => booking.id),
    overlappingBookings,
    overlappingHoldCount: overlappingHolds.length,
    overlappingHoldIds: overlappingHolds.map((hold) => hold.id),
    overlappingHolds,
  };
}

export const INTERNAL_DUMPSTER_AVAILABILITY_RULES = {
  bookingStatusesIncluded: Array.from(ACTIVE_BOOKING_STATUSES),
  bookingStatusesExcluded: Array.from(EXCLUDED_BOOKING_STATUSES),
  holdStatusesIncluded: Array.from(ACTIVE_HOLD_STATUSES),
  holdStatusesExcluded: Array.from(EXCLUDED_HOLD_STATUSES),
  bookingOverlapRule:
    "existing.delivery_date <= requested_pickup_date AND existing.effective_pickup_date >= requested_delivery_date",
  holdOverlapRule:
    "hold.delivery_date BETWEEN requested_delivery_date AND requested_pickup_date",
  holdMatchingNotes:
    "Holds count only when dumpster_size matches the requested size. If both the request and the hold have dumpster_product_id, the product must also match. Holds still overlap by delivery date only because booking_holds does not yet persist a hold end date.",
} as const;
