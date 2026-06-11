import { addDaysYmd, isYmd } from "@/lib/booking-pricing";
import { getDumpsterRentalPolicy } from "@/lib/dumpster-rental-policy";
import {
  evaluateRentalWindowAvailability,
  RENTAL_WINDOW_BLOCKING_RULE,
  type RentalWindowBlocker,
  type RentalWindowDumpster,
} from "@/lib/rental-window-availability";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTenant } from "@/lib/tenant/server";

export type DumpsterAvailabilityInput = {
  dumpsterSize: string;
  dumpsterProductId?: string | null;
  deliveryDate: string;
  pickupDate?: string | null;
  excludeHoldIds?: string[];
  excludeBookingIds?: string[];
  businessId?: string;
};

export type OverlappingBookingDetail = {
  id: string;
  status: string | null;
  deliveryDate: string;
  effectivePickupDate: string;
  assignedDumpsterId: string | null;
  dumpsterProductId: string | null;
};

export type OverlappingHoldDetail = {
  id: string;
  status: string | null;
  deliveryDate: string;
  effectivePickupDate: string;
  expiresAt: string;
  dumpsterProductId: string | null;
};

export type DumpsterAvailabilityResult = {
  dumpsterSize: string;
  dumpsterProductId: string | null;
  productName: string | null;
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
  blockingRule: string;
  compatibleDumpstersConsidered: RentalWindowDumpster[];
  availableDumpsterIds: string[];
  dumpsterDebug: ReturnType<typeof evaluateRentalWindowAvailability>["dumpsters"];
  debugSummary: {
    requestedSelection: {
      dumpsterSize: string;
      dumpsterProductId: string | null;
      productName: string | null;
      normalizedSizeKey: string;
      capacityYards: number | null;
    };
    compatibleInventory: Array<{
      dumpsterId: string;
      label: string;
      rawSize: string;
      normalizedSizeKey: string;
      capacityYards: number | null;
      active: boolean;
      operationalStatus: string | null;
      maintenanceStatus: string | null;
      serviceStatus: string | null;
      assetTag: string | null;
      matchedBy: "size";
    }>;
  };
};

type BookingWindowRow = {
  id: string;
  status: string | null;
  delivery_date: string | null;
  pickup_date: string | null;
  included_rental_days: number | null;
  dumpster_size: string | null;
  dumpster_product_id: string | null;
  dumpster_id: string | null;
};

type DumpsterRow = {
  id: string;
  display_name: string | null;
  size: string | null;
  active: boolean | null;
  operational_status: string | null;
  maintenance_status: string | null;
  service_status: string | null;
  asset_tag: string | null;
};

type HoldRow = {
  id: string;
  status: string | null;
  delivery_date: string | null;
  pickup_date: string | null;
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

function normalizeDumpsterSize(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function extractCapacityYards(value: string | null | undefined) {
  const match = String(value ?? "").trim().match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function normalizeSizeKey(value: string | null | undefined) {
  const capacity = extractCapacityYards(value);
  return capacity == null ? normalizeDumpsterSize(value).toLowerCase() : `${capacity}-yard`;
}

function canUseDumpsterForAvailability(row: DumpsterRow) {
  return (
    Boolean(row.active) &&
    normalizeStatus(row.operational_status) !== "maintenance hold" &&
    normalizeStatus(row.service_status) !== "out of service"
  );
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

  const rentalPolicy = await getDumpsterRentalPolicy({
    dumpsterSize,
    dumpsterProductId,
  });
  const requestedPickupDate =
    input.pickupDate && isYmd(input.pickupDate)
      ? input.pickupDate
      : addDaysYmd(input.deliveryDate, rentalPolicy.standardRentalDays);

  if (!isYmd(requestedPickupDate)) {
    throw new Error("pickupDate must use YYYY-MM-DD.");
  }

  if (requestedPickupDate < input.deliveryDate) {
    throw new Error("pickupDate must be on or after deliveryDate.");
  }

  const nowIso = new Date().toISOString();
  const businessId = input.businessId ?? (await getCurrentTenant()).id;

  const [dumpstersResult, bookingsResult, holdsResult] = await Promise.all([
    supabaseAdmin
      .from("dumpsters")
      .select("id, display_name, size, active, operational_status, maintenance_status, service_status, asset_tag")
      .eq("active", true),
    supabaseAdmin
      .from("bookings")
      .select(
        "id, status, delivery_date, pickup_date, included_rental_days, dumpster_size, dumpster_product_id, dumpster_id",
      )
      .eq("business_id", businessId)
      .eq("dumpster_size", dumpsterSize)
      .not("delivery_date", "is", null)
      .order("delivery_date", { ascending: true }),
    supabaseAdmin
      .from("booking_holds")
      .select("id, status, delivery_date, pickup_date, expires_at, dumpster_size, dumpster_product_id")
      .eq("business_id", businessId)
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

  const requestedSelectionDebug = {
    dumpsterSize,
    dumpsterProductId,
    productName: rentalPolicy.productName,
    normalizedSizeKey: normalizeSizeKey(dumpsterSize),
    capacityYards: extractCapacityYards(dumpsterSize),
  };
  const inventoryRows = ((dumpstersResult.data ?? []) as DumpsterRow[])
    .filter((dumpster) => canUseDumpsterForAvailability(dumpster))
    .filter((dumpster) => normalizeSizeKey(dumpster.size) === requestedSelectionDebug.normalizedSizeKey);
  const compatibleDumpstersConsidered = inventoryRows.map((dumpster) => ({
    id: dumpster.id,
    label: dumpster.display_name?.trim() || dumpster.asset_tag?.trim() || dumpster.id,
  }));
  const totalBookable = compatibleDumpstersConsidered.length;
  const bookings = (bookingsResult.data ?? []) as BookingWindowRow[];
  const holds = (holdsResult.data ?? []) as HoldRow[];
  const overlappingBookings: OverlappingBookingDetail[] = [];
  const overlappingHolds: OverlappingHoldDetail[] = [];
  const blockers: RentalWindowBlocker[] = [];

  for (const booking of bookings) {
    if (!shouldCountBookingStatus(booking.status)) continue;
    if (!isYmd(booking.delivery_date)) continue;
    const bookingDeliveryDate = String(booking.delivery_date);

    const effectivePickupDate =
      booking.pickup_date && isYmd(booking.pickup_date)
        ? booking.pickup_date
        : addDaysYmd(
            bookingDeliveryDate,
            Math.max(1, booking.included_rental_days ?? rentalPolicy.standardRentalDays),
          );

    const detail: OverlappingBookingDetail = {
      id: booking.id,
      status: booking.status,
      deliveryDate: bookingDeliveryDate,
      effectivePickupDate,
      assignedDumpsterId: booking.dumpster_id ?? null,
      dumpsterProductId: normalizeDumpsterProductId(booking.dumpster_product_id),
    };

    overlappingBookings.push(detail);
    blockers.push({
      id: booking.id,
      type: "booking",
      status: booking.status,
      deliveryDate: bookingDeliveryDate,
      effectivePickupDate,
      assignedDumpsterId: booking.dumpster_id ?? null,
      dumpsterSize,
      dumpsterProductId: normalizeDumpsterProductId(booking.dumpster_product_id),
    });
  }

  for (const hold of holds) {
    if (!shouldCountHoldStatus(hold.status)) continue;
    if (!isYmd(hold.delivery_date)) continue;
    if (!hold.expires_at) continue;
    if (normalizeDumpsterSize(hold.dumpster_size) !== dumpsterSize) continue;
    const holdDeliveryDate = String(hold.delivery_date);
    const effectivePickupDate =
      hold.pickup_date && isYmd(hold.pickup_date)
        ? hold.pickup_date
        : addDaysYmd(holdDeliveryDate, rentalPolicy.standardRentalDays);
    const holdProductId = normalizeDumpsterProductId(hold.dumpster_product_id);

    const detail: OverlappingHoldDetail = {
      id: hold.id,
      status: hold.status,
      deliveryDate: holdDeliveryDate,
      effectivePickupDate,
      expiresAt: hold.expires_at,
      dumpsterProductId: holdProductId,
    };

    overlappingHolds.push(detail);
    blockers.push({
      id: hold.id,
      type: "hold",
      status: hold.status,
      deliveryDate: holdDeliveryDate,
      effectivePickupDate,
      assignedDumpsterId: null,
      dumpsterSize,
      dumpsterProductId: holdProductId,
    });
  }

  const windowAvailability = evaluateRentalWindowAvailability({
    requestedDeliveryDate: input.deliveryDate,
    requestedPickupDate,
    dumpsters: compatibleDumpstersConsidered,
    blockers,
    excludeBlockerIds: [...(input.excludeBookingIds ?? []), ...(input.excludeHoldIds ?? [])],
  });

  return {
    dumpsterSize,
    dumpsterProductId,
    productName: rentalPolicy.productName,
    requestedDeliveryDate: input.deliveryDate,
    requestedPickupDate,
    totalBookable,
    reservedOrInUseFromBookings: overlappingBookings.length,
    reservedFromHolds: overlappingHolds.length,
    reservedOrInUse: totalBookable - windowAvailability.availableCount,
    available: windowAvailability.availableCount,
    overlappingBookingCount: windowAvailability.blockersConsidered.filter((blocker) => blocker.type === "booking").length,
    overlappingBookingIds: windowAvailability.blockersConsidered
      .filter((blocker) => blocker.type === "booking")
      .map((blocker) => blocker.id),
    overlappingBookings: overlappingBookings.filter((booking) =>
      windowAvailability.blockersConsidered.some((blocker) => blocker.id === booking.id && blocker.type === "booking"),
    ),
    overlappingHoldCount: windowAvailability.blockersConsidered.filter((blocker) => blocker.type === "hold").length,
    overlappingHoldIds: windowAvailability.blockersConsidered
      .filter((blocker) => blocker.type === "hold")
      .map((blocker) => blocker.id),
    overlappingHolds: overlappingHolds.filter((hold) =>
      windowAvailability.blockersConsidered.some((blocker) => blocker.id === hold.id && blocker.type === "hold"),
    ),
    blockingRule: windowAvailability.blockingRule,
    compatibleDumpstersConsidered: windowAvailability.compatibleDumpstersConsidered,
    availableDumpsterIds: windowAvailability.availableDumpsterIds,
    dumpsterDebug: windowAvailability.dumpsters,
    debugSummary: {
      requestedSelection: requestedSelectionDebug,
      compatibleInventory: inventoryRows.map((dumpster) => ({
        dumpsterId: dumpster.id,
        label: dumpster.display_name?.trim() || dumpster.asset_tag?.trim() || dumpster.id,
        rawSize: dumpster.size?.trim() || "",
        normalizedSizeKey: normalizeSizeKey(dumpster.size),
        capacityYards: extractCapacityYards(dumpster.size),
        active: Boolean(dumpster.active),
        operationalStatus: dumpster.operational_status,
        maintenanceStatus: dumpster.maintenance_status,
        serviceStatus: dumpster.service_status,
        assetTag: dumpster.asset_tag,
        matchedBy: "size" as const,
      })),
    },
  };
}

export const INTERNAL_DUMPSTER_AVAILABILITY_RULES = {
  bookingStatusesIncluded: Array.from(ACTIVE_BOOKING_STATUSES),
  bookingStatusesExcluded: Array.from(EXCLUDED_BOOKING_STATUSES),
  holdStatusesIncluded: Array.from(ACTIVE_HOLD_STATUSES),
  holdStatusesExcluded: Array.from(EXCLUDED_HOLD_STATUSES),
  bookingOverlapRule: "booking blocks a dumpster when its delivery-through-pickup window overlaps the requested window",
  holdOverlapRule: "hold blocks a dumpster window when its reserved delivery-through-pickup window overlaps the requested window",
  holdMatchingNotes:
    "Compatibility is enforced by dumpster size. dumpster_product_id is preserved for the selected request, pricing, and debug output, but physical unit availability resolves against compatible dumpsters of the requested size.",
  rentalWindowBlockingRule: RENTAL_WINDOW_BLOCKING_RULE,
} as const;
