import { addDaysYmd, isYmd } from "@/lib/booking-pricing";
import { getPricingSettingsSnapshot } from "@/lib/pricing-settings";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTenant } from "@/lib/tenant/server";

export type AssignableDumpsterOption = {
  id: string;
  displayName: string;
  equipmentId: string;
  size: string;
  yardLocation: string | null;
  serviceStatus: string;
  operationalStatus: string;
  active: boolean;
  isCurrentlyAssigned: boolean;
  isCompatible: boolean;
};

type AssignableDumpsterRow = {
  id: string;
  display_name: string;
  equipment_id: string;
  size: string;
  yard_location: string | null;
  service_status: string;
  operational_status: string;
  active: boolean;
};

type AssignedBookingRow = {
  id: string;
  dumpster_id: string | null;
  delivery_date: string | null;
  pickup_date: string | null;
  included_rental_days: number | null;
  status: string | null;
};

const ACTIVE_ASSIGNMENT_BOOKING_STATUSES = new Set([
  "confirmed",
  "scheduled",
  "delivered",
  "paid",
]);

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function shouldBlockDumpsterAssignment(status: string | null | undefined) {
  return ACTIVE_ASSIGNMENT_BOOKING_STATUSES.has(normalizeStatus(status));
}

function isBookableDumpster(row: AssignableDumpsterRow) {
  return row.active && row.service_status === "Ready" && row.operational_status !== "Maintenance hold";
}

function windowsOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA <= endB && endA >= startB;
}

function mapOption(
  row: AssignableDumpsterRow,
  input: { isCurrentlyAssigned: boolean; isCompatible: boolean },
): AssignableDumpsterOption {
  return {
    id: row.id,
    displayName: row.display_name,
    equipmentId: row.equipment_id,
    size: row.size,
    yardLocation: row.yard_location,
    serviceStatus: row.service_status,
    operationalStatus: row.operational_status,
    active: row.active,
    isCurrentlyAssigned: input.isCurrentlyAssigned,
    isCompatible: input.isCompatible,
  };
}

export async function getAssignableDumpstersForBooking(input: {
  bookingId: string;
  dumpsterSize: string | null;
  deliveryDate: string | null;
  pickupDate: string | null;
  includedRentalDays: number | null;
  currentDumpsterId?: string | null;
}) {
  const tenant = await getCurrentTenant();
  const dumpsterSize = String(input.dumpsterSize ?? "").trim();
  if (!dumpsterSize || !isYmd(input.deliveryDate)) {
    return {
      compatibleDumpsters: [] as AssignableDumpsterOption[],
      currentAssignedDumpster: null as AssignableDumpsterOption | null,
      requestedPickupDate: null as string | null,
    };
  }

  const pricingSettings = await getPricingSettingsSnapshot();
  const requestedPickupDate =
    input.pickupDate && isYmd(input.pickupDate)
      ? input.pickupDate
      : addDaysYmd(
          input.deliveryDate,
          Math.max(1, input.includedRentalDays ?? pricingSettings.standardRentalDays),
        );

  const dumpstersQuery = supabaseAdmin
    .from("dumpsters")
    .select("id, display_name, equipment_id, size, yard_location, service_status, operational_status, active")
    .eq("size", dumpsterSize)
    .eq("active", true)
    .eq("service_status", "Ready")
    .neq("operational_status", "Maintenance hold")
    .order("display_name", { ascending: true });

  const currentDumpsterId = String(input.currentDumpsterId ?? "").trim() || null;
  const currentDumpsterQuery = currentDumpsterId
    ? supabaseAdmin
        .from("dumpsters")
        .select("id, display_name, equipment_id, size, yard_location, service_status, operational_status, active")
        .eq("id", currentDumpsterId)
        .maybeSingle<AssignableDumpsterRow>()
    : Promise.resolve({ data: null, error: null });

  const { data: bookableDumpsters, error: dumpstersError } = await dumpstersQuery;
  if (dumpstersError) {
    throw new Error(dumpstersError.message);
  }

  const currentDumpsterResult = await currentDumpsterQuery;
  if (currentDumpsterResult.error) {
    throw new Error(currentDumpsterResult.error.message);
  }

  const dumpsterRows = (bookableDumpsters ?? []) as AssignableDumpsterRow[];
  const candidateDumpsterIds = new Set(dumpsterRows.map((row) => row.id));
  if (currentDumpsterResult.data?.id) {
    candidateDumpsterIds.add(currentDumpsterResult.data.id);
  }

  if (candidateDumpsterIds.size === 0) {
    return {
      compatibleDumpsters: [] as AssignableDumpsterOption[],
      currentAssignedDumpster: currentDumpsterResult.data
        ? mapOption(currentDumpsterResult.data, {
            isCurrentlyAssigned: true,
            isCompatible: false,
          })
        : null,
      requestedPickupDate,
    };
  }

  const { data: assignedBookings, error: assignedBookingsError } = await supabaseAdmin
    .from("bookings")
    .select("id, dumpster_id, delivery_date, pickup_date, included_rental_days, status")
    .eq("business_id", tenant.id)
    .in("dumpster_id", Array.from(candidateDumpsterIds))
    .neq("id", input.bookingId)
    .not("delivery_date", "is", null)
    .order("delivery_date", { ascending: true });

  if (assignedBookingsError) {
    throw new Error(assignedBookingsError.message);
  }

  const blockedDumpsterIds = new Set<string>();
  for (const booking of (assignedBookings ?? []) as AssignedBookingRow[]) {
    if (!booking.dumpster_id || !shouldBlockDumpsterAssignment(booking.status) || !isYmd(booking.delivery_date)) {
      continue;
    }

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
      blockedDumpsterIds.add(booking.dumpster_id);
    }
  }

  const compatibleDumpsters = dumpsterRows
    .filter((row) => isBookableDumpster(row) && !blockedDumpsterIds.has(row.id))
    .map((row) =>
      mapOption(row, {
        isCurrentlyAssigned: row.id === currentDumpsterId,
        isCompatible: true,
      }),
    );

  const currentAssignedDumpster =
    currentDumpsterResult.data
      ? mapOption(currentDumpsterResult.data, {
          isCurrentlyAssigned: true,
          isCompatible:
            isBookableDumpster(currentDumpsterResult.data) &&
            !blockedDumpsterIds.has(currentDumpsterResult.data.id),
        })
      : null;

  return {
    compatibleDumpsters,
    currentAssignedDumpster,
    requestedPickupDate,
  };
}
