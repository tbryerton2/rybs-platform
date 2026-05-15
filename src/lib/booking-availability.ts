import { getPooledDumpsterAvailabilityBySize } from "@/lib/admin/dumpster-availability";

export type DeliveryAvailabilitySnapshot = {
  capacity: number;
  used: number;
  remaining: number;
  requestedPickupDate: string | null;
  blockingRule: string | null;
  availableDumpsterIds?: string[];
  debugSummary?: unknown;
  overlappingBookings?: unknown;
  overlappingHolds?: unknown;
  source: "unit-window";
};

type DeliveryAvailabilityInput = {
  deliveryDate: string;
  rpcDays?: number;
  dumpsterSize: string;
  dumpsterProductId: string | null;
  pickupDate?: string | null;
  excludeHoldIds?: string[];
  excludeBookingIds?: string[];
  logContext: string;
};

export async function getDeliveryAvailabilitySnapshot(
  input: DeliveryAvailabilityInput,
): Promise<DeliveryAvailabilitySnapshot> {
  const availability = await getPooledDumpsterAvailabilityBySize({
    dumpsterSize: input.dumpsterSize,
    dumpsterProductId: input.dumpsterProductId,
    deliveryDate: input.deliveryDate,
    pickupDate: input.pickupDate ?? null,
    excludeHoldIds: input.excludeHoldIds,
    excludeBookingIds: input.excludeBookingIds,
  });

  return {
    capacity: Number(availability.totalBookable ?? 0),
    used: Math.max(0, Number(availability.totalBookable ?? 0) - Number(availability.available ?? 0)),
    remaining: Math.max(0, Number(availability.available ?? 0)),
    requestedPickupDate: availability.requestedPickupDate,
    blockingRule: availability.blockingRule,
    availableDumpsterIds: availability.availableDumpsterIds,
    debugSummary: availability.debugSummary,
    overlappingBookings: availability.overlappingBookings,
    overlappingHolds: availability.overlappingHolds,
    source: "unit-window",
  };
}
