import {
  type CustomerVisibleRequestStatus,
  type ExtensionRequestDetails,
  type IssueReportDetails,
  type PickupRequestDetails,
  type RentalActionStatus,
  type RentalActionType,
} from "@/lib/rental-action-requests";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PortalRequestBaseRow = {
  id: string;
  booking_id: string;
  customer_id: string;
  action_type: RentalActionType;
  status: RentalActionStatus;
  customer_visible_status: CustomerVisibleRequestStatus;
  priority: "low" | "normal" | "high" | "urgent";
  submitted_at: string;
  details_json: PickupRequestDetails | ExtensionRequestDetails | IssueReportDetails | null;
  internal_notes: string | null;
  customer_update: string | null;
  reviewed_at: string | null;
  resolved_at: string | null;
};

type PortalRequestBookingRow = {
  id: string;
  customer_id: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  status: string | null;
  delivery_date?: string | null;
  pickup_date?: string | null;
};

type PortalRequestCustomerRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone?: string | null;
};

export type PortalRequestListRow = {
  id: string;
  booking_id: string;
  action_type: RentalActionType;
  status: RentalActionStatus;
  customer_visible_status: CustomerVisibleRequestStatus;
  priority: "low" | "normal" | "high" | "urgent";
  submitted_at: string;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
	  booking: {
	    id: string;
	    customer_first_name: string | null;
	    customer_last_name: string | null;
    customer_street: string | null;
    customer_city: string | null;
    customer_zip: string | null;
    status: string | null;
  } | null;
};

export type PortalRequestDetail = {
  id: string;
  booking_id: string;
  customer_id: string;
  action_type: RentalActionType;
  status: RentalActionStatus;
  customer_visible_status: CustomerVisibleRequestStatus;
  priority: "low" | "normal" | "high" | "urgent";
  details_json: PickupRequestDetails | ExtensionRequestDetails | IssueReportDetails | null;
  internal_notes: string | null;
  customer_update: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  resolved_at: string | null;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
	  booking: {
	    id: string;
	    status: string | null;
	    customer_first_name: string | null;
	    customer_last_name: string | null;
    customer_street: string | null;
    customer_city: string | null;
    customer_zip: string | null;
    delivery_date: string | null;
    pickup_date: string | null;
  } | null;
};

type PortalRequestListLoadResult = {
  requests: PortalRequestListRow[];
  loadError: string | null;
};

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function logPortalRequestError(scope: string, details: Record<string, unknown>) {
  console.error(`[admin/portal-requests] ${scope}`, details);
}

async function loadBookings(bookingIds: string[], businessId: string) {
  if (bookingIds.length === 0) {
    return new Map<string, PortalRequestBookingRow>();
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, customer_id, customer_first_name, customer_last_name, customer_street, customer_city, customer_zip, status, delivery_date, pickup_date")
    .eq("business_id", businessId)
    .in("id", bookingIds);

  if (error) {
    logPortalRequestError("bookings-query-failed", {
      bookingIds,
      message: error.message,
    });
    return new Map<string, PortalRequestBookingRow>();
  }

  return new Map((data ?? []).map((booking) => [booking.id, booking as PortalRequestBookingRow]));
}

async function loadCustomers(customerIds: string[], businessId: string) {
  if (customerIds.length === 0) {
    return new Map<string, PortalRequestCustomerRow>();
  }

  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("id, name, email, phone")
    .eq("business_id", businessId)
    .in("id", customerIds);

  if (error) {
    logPortalRequestError("customers-query-failed", {
      customerIds,
      message: error.message,
    });
    return new Map<string, PortalRequestCustomerRow>();
  }

  return new Map((data ?? []).map((customer) => [customer.id, customer as PortalRequestCustomerRow]));
}

function getRelatedCustomerId(request: Pick<PortalRequestBaseRow, "customer_id" | "booking_id">, booking?: PortalRequestBookingRow | null) {
  return booking?.customer_id ?? request.customer_id ?? null;
}

export async function getPortalRequests(filter: string, businessId: string): Promise<PortalRequestListLoadResult> {
  let query = supabaseAdmin
    .from("rental_action_requests")
    .select("id, booking_id, customer_id, action_type, status, customer_visible_status, priority, submitted_at")
    .eq("business_id", businessId)
    .order("submitted_at", { ascending: false })
    .limit(200);

  if (filter === "submitted" || filter === "under_review" || filter === "completed") {
    query = query.eq("status", filter);
  }

  if (filter === "attention") {
    query = query.in("status", ["submitted", "under_review", "approved"]);
  }

  if (filter === "pickup_request" || filter === "extension_request" || filter === "issue_report") {
    query = query.eq("action_type", filter);
  }

  const { data, error } = await query;

  if (error) {
    const loadError = `Failed to load portal requests from rental_action_requests: ${error.message}`;
    logPortalRequestError("requests-query-failed", { filter, message: error.message });
    return { requests: [], loadError };
  }

  let requests = (data ?? []) as PortalRequestBaseRow[];

  if (filter === "attention") {
    const now = Date.now();
    requests = requests.filter((request) => {
      if (request.status === "submitted" || request.status === "under_review") {
        return true;
      }

      if (request.status !== "approved") {
        return false;
      }

      return now - new Date(request.submitted_at).getTime() >= 24 * 60 * 60 * 1000;
    });
  }
  const bookingsById = await loadBookings(uniqueIds(requests.map((request) => request.booking_id)), businessId);
  const customersById = await loadCustomers(
    uniqueIds(requests.map((request) => getRelatedCustomerId(request, bookingsById.get(request.booking_id)))),
    businessId,
  );

  return {
    requests: requests.map((request) => {
      const booking = bookingsById.get(request.booking_id) ?? null;
      const customer = customersById.get(getRelatedCustomerId(request, booking) ?? "") ?? null;

      return {
        id: request.id,
        booking_id: request.booking_id,
        action_type: request.action_type,
        status: request.status,
        customer_visible_status: request.customer_visible_status,
        priority: request.priority,
        submitted_at: request.submitted_at,
        customer: customer
          ? {
              id: customer.id,
              name: customer.name,
              email: customer.email,
            }
          : null,
        booking: booking
	          ? {
	              id: booking.id,
	              customer_first_name: booking.customer_first_name,
	              customer_last_name: booking.customer_last_name,
	              customer_street: booking.customer_street,
              customer_city: booking.customer_city,
              customer_zip: booking.customer_zip,
              status: booking.status,
            }
          : null,
      };
    }),
    loadError: null,
  };
}

export async function getPortalRequestDetail(id: string, businessId: string): Promise<PortalRequestDetail | null> {
  const { data, error } = await supabaseAdmin
    .from("rental_action_requests")
    .select(
      "id, booking_id, customer_id, action_type, status, customer_visible_status, priority, details_json, internal_notes, customer_update, submitted_at, reviewed_at, resolved_at",
    )
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    const message = `Failed to load portal request ${id} from rental_action_requests: ${error.message}`;
    logPortalRequestError("request-detail-query-failed", { id, message: error.message });
    throw new Error(message);
  }

  if (!data) {
    return null;
  }

  const request = data as PortalRequestBaseRow;
  const booking = (await loadBookings(uniqueIds([request.booking_id]), businessId)).get(request.booking_id) ?? null;
  const customerId = getRelatedCustomerId(request, booking);
  const customer = customerId ? (await loadCustomers([customerId], businessId)).get(customerId) ?? null : null;

  return {
    ...request,
    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone ?? null,
        }
      : null,
    booking: booking
	      ? {
	          id: booking.id,
	          status: booking.status,
	          customer_first_name: booking.customer_first_name,
	          customer_last_name: booking.customer_last_name,
	          customer_street: booking.customer_street,
          customer_city: booking.customer_city,
          customer_zip: booking.customer_zip,
          delivery_date: booking.delivery_date ?? null,
          pickup_date: booking.pickup_date ?? null,
        }
      : null,
  };
}
