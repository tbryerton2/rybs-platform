export type RentalActionType = "pickup_request" | "extension_request" | "issue_report";

export type RentalActionStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "denied"
  | "completed";

export type CustomerVisibleRequestStatus =
  | "received"
  | "under_review"
  | "pickup_scheduled"
  | "unable_to_confirm"
  | "completed";

export type PickupTimingPreference = "asap" | "specific_date";

export type PickupRequestDetails = {
  timingPreference: PickupTimingPreference;
  requestedDate: string | null;
  accessConfirmed: boolean;
  notes: string | null;
};

export type RentalActionRequestRow = {
  id: string;
  booking_id: string;
  customer_id: string;
  action_type: RentalActionType;
  status: RentalActionStatus;
  customer_visible_status: CustomerVisibleRequestStatus;
  priority: "low" | "normal" | "high" | "urgent";
  details_json: PickupRequestDetails | Record<string, unknown> | null;
  internal_notes: string | null;
  customer_update: string | null;
  reviewed_by: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type RentalEligibilityInput = {
  status: string | null;
};

const OPEN_PICKUP_REQUEST_STATUSES = new Set<RentalActionStatus>([
  "submitted",
  "under_review",
  "approved",
]);

export function isOpenPickupRequest(request: Pick<RentalActionRequestRow, "action_type" | "status">) {
  return request.action_type === "pickup_request" && OPEN_PICKUP_REQUEST_STATUSES.has(request.status);
}

export function getPickupEligibility(
  booking: RentalEligibilityInput,
  requests: Array<Pick<RentalActionRequestRow, "action_type" | "status">>,
) {
  const normalizedStatus = (booking.status ?? "").trim().toLowerCase();

  if (requests.some(isOpenPickupRequest)) {
    return {
      eligible: false,
      reason: "Pickup request already submitted",
    } as const;
  }

  if (normalizedStatus === "delivered") {
    return {
      eligible: true,
      reason: null,
    } as const;
  }

  if (normalizedStatus === "confirmed" || normalizedStatus === "scheduled") {
    return {
      eligible: false,
      reason: "Available after your dumpster has been delivered",
    } as const;
  }

  return {
    eligible: false,
    reason: "This rental is not currently eligible for pickup requests",
  } as const;
}

export function getActionTypeLabel(actionType: RentalActionType) {
  switch (actionType) {
    case "pickup_request":
      return "Pickup request";
    case "extension_request":
      return "Extension request";
    case "issue_report":
      return "Issue report";
  }
}

export function getCustomerVisibleStatusLabel(status: CustomerVisibleRequestStatus) {
  switch (status) {
    case "received":
      return "Received";
    case "under_review":
      return "Under review";
    case "pickup_scheduled":
      return "Pickup scheduled";
    case "unable_to_confirm":
      return "Unable to confirm";
    case "completed":
      return "Completed";
  }
}

export function getCustomerVisibleStatusTone(status: CustomerVisibleRequestStatus) {
  switch (status) {
    case "received":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "under_review":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "pickup_scheduled":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "unable_to_confirm":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "completed":
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export function getInternalRequestStatusLabel(status: RentalActionStatus) {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "under_review":
      return "Under review";
    case "approved":
      return "Approved";
    case "denied":
      return "Denied";
    case "completed":
      return "Completed";
  }
}

export function getInternalRequestStatusTone(status: RentalActionStatus) {
  switch (status) {
    case "submitted":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "under_review":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "approved":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "denied":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "completed":
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export function formatRequestSummary(request: Pick<RentalActionRequestRow, "action_type" | "details_json">) {
  if (request.action_type !== "pickup_request") {
    return "Customer request submitted.";
  }

  const details = (request.details_json ?? {}) as Partial<PickupRequestDetails>;

  if (details.timingPreference === "specific_date" && details.requestedDate) {
    return `Requested pickup on ${details.requestedDate}.`;
  }

  return "Requested pickup as soon as possible.";
}

export function sanitizePickupRequestDetails(input: {
  timingPreference: string;
  requestedDate?: string | null;
  accessConfirmed: boolean;
  notes?: string | null;
}) {
  const timingPreference: PickupTimingPreference =
    input.timingPreference === "specific_date" ? "specific_date" : "asap";

  return {
    timingPreference,
    requestedDate: timingPreference === "specific_date" ? input.requestedDate ?? null : null,
    accessConfirmed: input.accessConfirmed,
    notes: input.notes?.trim() ? input.notes.trim() : null,
  } satisfies PickupRequestDetails;
}

export function validatePickupRequestDetails(details: PickupRequestDetails) {
  if (!details.accessConfirmed) {
    return "Confirm that the dumpster is accessible for pickup.";
  }

  if (details.timingPreference === "specific_date") {
    if (!details.requestedDate) {
      return "Choose a requested pickup date.";
    }

    const today = new Date();
    const todayYmd = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
      .toISOString()
      .slice(0, 10);

    if (details.requestedDate < todayYmd) {
      return "Requested pickup date cannot be in the past.";
    }
  }

  return null;
}
