import { getRentalDurationDays } from "@/lib/booking-pricing";
import {
  getPooledDumpsterAvailabilityBySize,
  type DumpsterAvailabilityResult,
} from "@/lib/admin/dumpster-availability";
import { getPricingSettingsSnapshot } from "@/lib/pricing-settings";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type DumpsterAvailabilityComparisonInput = {
  dumpsterSize: string;
  dumpsterProductId?: string | null;
  deliveryDate: string;
  pickupDate?: string | null;
  businessId: string;
};

export type LegacyRpcAvailabilityResult = {
  capacity: number;
  used: number;
  remaining: number;
  requestedDays: number;
};

export type DumpsterAvailabilityComparisonResult = {
  dumpsterSize: string;
  deliveryDate: string;
  pickupDate: string;
  legacyRpc: LegacyRpcAvailabilityResult;
  pooled: DumpsterAvailabilityResult;
  agree: boolean;
  mismatchReason: string | null;
};

function inferMismatchReason(
  legacy: LegacyRpcAvailabilityResult,
  pooled: DumpsterAvailabilityResult,
) {
  if (pooled.reservedFromHolds > 0 && legacy.used !== pooled.reservedOrInUse) {
    return "Usage differs. The new helper includes overlapping unexpired holds in addition to bookings, while the legacy RPC still uses its older pooled hold logic and global fleet model.";
  }

  if (
    legacy.capacity === pooled.totalBookable &&
    legacy.used !== pooled.reservedOrInUse
  ) {
    return "Usage differs. The legacy RPC counts pooled bookings and holds across the old fleet model, while the new helper counts overlapping bookings plus unexpired holds for the requested dumpster size.";
  }

  if (
    legacy.capacity !== pooled.totalBookable &&
    legacy.used === pooled.reservedOrInUse
  ) {
    return "Capacity differs. The legacy RPC uses the old global fleet capacity, while the new helper uses persistent bookable dumpsters for the requested size.";
  }

  if (
    legacy.capacity !== pooled.totalBookable &&
    legacy.used !== pooled.reservedOrInUse
  ) {
    return "Both capacity and usage differ. The legacy RPC is pooled across the old fleet model, while the new helper is size-specific, uses persistent dumpster inventory, and now includes overlapping unexpired holds.";
  }

  if (legacy.remaining !== pooled.available) {
    return "Remaining availability differs even though raw counts look close. Check requested rental length, booking size backfill, overlapping booking windows, and active hold timing.";
  }

  return null;
}

export async function compareLegacyRpcToPooledDumpsterAvailability(
  input: DumpsterAvailabilityComparisonInput,
): Promise<DumpsterAvailabilityComparisonResult> {
  const pricingSettings = await getPricingSettingsSnapshot(input.businessId);
  const pickupDate =
    input.pickupDate && input.pickupDate.trim()
      ? input.pickupDate.trim()
      : null;
  const requestedDays =
    getRentalDurationDays(input.deliveryDate, pickupDate) ??
    pricingSettings.standardRentalDays;

  const [legacyRpcResponse, pooled] = await Promise.all([
    supabaseAdmin.rpc("get_delivery_availability", {
      p_delivery_date: input.deliveryDate,
      p_days: requestedDays,
    }),
    getPooledDumpsterAvailabilityBySize(input),
  ]);

  if (legacyRpcResponse.error) {
    throw new Error(legacyRpcResponse.error.message);
  }

  const row = legacyRpcResponse.data?.[0];
  if (!row) {
    throw new Error("Legacy availability RPC returned no rows.");
  }

  const legacyRpc: LegacyRpcAvailabilityResult = {
    capacity: Number(row.capacity ?? 0),
    used: Number(row.used ?? 0),
    remaining: Math.max(0, Number(row.remaining ?? 0)),
    requestedDays,
  };

  const agree =
    legacyRpc.capacity === pooled.totalBookable &&
    legacyRpc.used === pooled.reservedOrInUse &&
    legacyRpc.remaining === pooled.available;

  return {
    dumpsterSize: pooled.dumpsterSize,
    deliveryDate: pooled.requestedDeliveryDate,
    pickupDate: pooled.requestedPickupDate,
    legacyRpc,
    pooled,
    agree,
    mismatchReason: agree ? null : inferMismatchReason(legacyRpc, pooled),
  };
}
