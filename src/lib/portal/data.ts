import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  formatRequestSummary,
  getPickupEligibility,
  isOpenPickupRequest,
  type RentalActionRequestRow,
} from "@/lib/rental-action-requests";
import { getNextPortalAction, getPortalStage, type PortalStage } from "./status";

export type PortalBooking = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string | null;
  pickup_date: string | null;
  pickup_mode: string | null;
  status: string | null;
  total_price_cents: number | null;
  service_town: string | null;
  service_county: string | null;
  notes: string | null;
  created_at: string | null;
};

export type PortalBookingRequest = {
  id: string;
  booking_id?: string;
  action_type: RentalActionRequestRow["action_type"];
  status: RentalActionRequestRow["status"];
  customer_visible_status: RentalActionRequestRow["customer_visible_status"];
  details_json: RentalActionRequestRow["details_json"];
  customer_update: string | null;
  submitted_at: string;
};

export type PortalLocation = {
  id: string;
  label: string;
  street: string;
  city: string;
  zip: string;
  delivery_notes: string | null;
  is_default: boolean;
};

export type PortalBookingSummary = PortalBooking & {
  portalStage: PortalStage;
  nextAction: string;
};

const ACTIVE_STATUSES = new Set(["confirmed", "scheduled", "delivered"]);

function withPortalRequestSummary(
  booking: PortalBooking,
  requests: PortalBookingRequest[] = [],
): PortalBookingSummary {
  const latestPickupRequest = requests.find((request) => request.action_type === "pickup_request") ?? null;
  const portalStage = getPortalStage({
    ...booking,
    hasOpenPickupRequest: requests.some((request) =>
      isOpenPickupRequest({
        action_type: request.action_type,
        status: request.status,
      }),
    ),
    hasScheduledPickupRequest: latestPickupRequest?.customer_visible_status === "pickup_scheduled",
  });

  return {
    ...booking,
    portalStage,
    nextAction: getNextPortalAction(portalStage),
  };
}

function isMissingRelationError(message: string | undefined) {
  return (message ?? "").toLowerCase().includes("does not exist");
}

export async function getPortalDashboardData(customerId: string) {
  const [{ data: bookings, error: bookingsError }, { data: locations, error: locationsError }] =
    await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select(
          "id, customer_id, customer_name, customer_email, customer_phone, customer_street, customer_city, customer_zip, delivery_date, pickup_date, pickup_mode, status, total_price_cents, service_town, service_county, notes, created_at",
        )
        .eq("customer_id", customerId)
        .order("delivery_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("customer_locations")
        .select("id, label, street, city, zip, delivery_notes, is_default")
        .eq("customer_id", customerId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true }),
    ]);

  if (bookingsError) throw new Error(bookingsError.message);
  if (locationsError && !isMissingRelationError(locationsError.message)) {
    throw new Error(locationsError.message);
  }

  const bookingRowsRaw = (bookings ?? []) as PortalBooking[];
  let requestRows: PortalBookingRequest[] = [];

  if (bookingRowsRaw.length) {
    const requestLookup = await supabaseAdmin
      .from("rental_action_requests")
      .select(
        "id, booking_id, action_type, status, customer_visible_status, details_json, customer_update, submitted_at",
      )
      .in(
        "booking_id",
        bookingRowsRaw.map((booking) => booking.id),
      )
      .order("submitted_at", { ascending: false });

    if (requestLookup.error && !isMissingRelationError(requestLookup.error.message)) {
      throw new Error(requestLookup.error.message);
    }

    requestRows = requestLookup.error ? [] : ((requestLookup.data ?? []) as (PortalBookingRequest & { booking_id: string })[]);
  }

  const requestsByBooking = new Map<string, PortalBookingRequest[]>();
  for (const request of requestRows as Array<PortalBookingRequest & { booking_id: string }>) {
    const existing = requestsByBooking.get(request.booking_id) ?? [];
    existing.push(request);
    requestsByBooking.set(request.booking_id, existing);
  }

  const bookingRows = bookingRowsRaw.map((booking) =>
    withPortalRequestSummary(booking, requestsByBooking.get(booking.id) ?? []),
  );
  const activeRental =
    bookingRows.find((booking) => ACTIVE_STATUSES.has((booking.status ?? "").toLowerCase())) ?? null;

  return {
    activeRental,
    recentBookings: bookingRows.slice(0, 6),
    locations: locationsError ? [] : ((locations ?? []) as PortalLocation[]),
  };
}

export async function getPortalRental(customerId: string, bookingId: string) {
  const [{ data: booking, error: bookingError }, { data: requests, error: requestsError }] =
    await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select(
          "id, customer_id, customer_name, customer_email, customer_phone, customer_street, customer_city, customer_zip, delivery_date, pickup_date, pickup_mode, status, total_price_cents, service_town, service_county, notes, created_at",
        )
        .eq("id", bookingId)
        .eq("customer_id", customerId)
        .maybeSingle(),
      supabaseAdmin
        .from("rental_action_requests")
        .select(
          "id, action_type, status, customer_visible_status, details_json, customer_update, submitted_at, created_at, updated_at",
        )
        .eq("booking_id", bookingId)
        .order("submitted_at", { ascending: false }),
    ]);

  if (bookingError) throw new Error(bookingError.message);
  if (requestsError && !isMissingRelationError(requestsError.message)) {
    throw new Error(requestsError.message);
  }

  if (!booking) return null;

  const requestRows = requestsError ? [] : ((requests ?? []) as PortalBookingRequest[]);
  const pickupEligibility = getPickupEligibility(
    booking as PortalBooking,
    requestRows.map((request) => ({
      action_type: request.action_type,
      status: request.status,
    })),
  );

  return {
    booking: withPortalRequestSummary(booking as PortalBooking, requestRows),
    requests: requestRows,
    pickupEligibility,
  };
}

export function getPortalRequestSummary(request: PortalBookingRequest) {
  return request.customer_update?.trim() || formatRequestSummary(request);
}
