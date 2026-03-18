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

export const PICKUP_REQUEST_NOTES_MAX_LENGTH = 500;

export const EXTENSION_REQUEST_NOTES_MAX_LENGTH = 500;
export const EXTENSION_REQUEST_MIN_DAYS = 1;
export const EXTENSION_REQUEST_MAX_DAYS = 14;
export const ISSUE_REPORT_DESCRIPTION_MIN_LENGTH = 10;
export const ISSUE_REPORT_DESCRIPTION_MAX_LENGTH = 1000;

export type ExtensionRequestReason =
  | "project_running_long"
  | "weather_delay"
  | "waiting_on_contractor"
  | "more_cleanup_needed"
  | "other";

export type ExtensionRequestDetails = {
  requestedExtraDays: number | null;
  reason: ExtensionRequestReason | null;
  notes: string | null;
  acknowledgePossibleFees: boolean;
};

export type IssueCategory =
  | "delivery_issue"
  | "pickup_issue"
  | "placement_problem"
  | "damage_concern"
  | "billing_question"
  | "usage_question"
  | "other";

export type IssueUrgency = "standard" | "urgent_today";

export type IssuePreferredContactMethod = "phone" | "email";

export type IssueReportDetails = {
  issueCategory: IssueCategory | null;
  urgency: IssueUrgency | null;
  description: string;
  preferredContactMethod: IssuePreferredContactMethod | null;
};

export type RentalActionRequestRow = {
  id: string;
  booking_id: string;
  customer_id: string;
  action_type: RentalActionType;
  status: RentalActionStatus;
  customer_visible_status: CustomerVisibleRequestStatus;
  priority: "low" | "normal" | "high" | "urgent";
  details_json:
    | PickupRequestDetails
    | ExtensionRequestDetails
    | IssueReportDetails
    | Record<string, unknown>
    | null;
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

const OPEN_REQUEST_STATUSES = new Set<RentalActionStatus>([
  "submitted",
  "under_review",
  "approved",
]);

const OPERATIONAL_ACTION_TYPES: RentalActionType[] = ["pickup_request", "extension_request"];

export function isOpenRentalActionRequest(request: Pick<RentalActionRequestRow, "status">) {
  return OPEN_REQUEST_STATUSES.has(request.status);
}

export function isOpenPickupRequest(request: Pick<RentalActionRequestRow, "action_type" | "status">) {
  return request.action_type === "pickup_request" && isOpenRentalActionRequest(request);
}

export function isOpenExtensionRequest(request: Pick<RentalActionRequestRow, "action_type" | "status">) {
  return request.action_type === "extension_request" && isOpenRentalActionRequest(request);
}

export function hasOpenOperationalRequest(
  requests: Array<Pick<RentalActionRequestRow, "action_type" | "status">>,
) {
  return requests.some(
    (request) =>
      OPERATIONAL_ACTION_TYPES.includes(request.action_type) && isOpenRentalActionRequest(request),
  );
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

  if (requests.some(isOpenExtensionRequest)) {
    return {
      eligible: false,
      reason: "Extension request already submitted. We’ll review that before pickup can be requested.",
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

export function getExtensionEligibility(
  booking: RentalEligibilityInput,
  requests: Array<Pick<RentalActionRequestRow, "action_type" | "status">>,
) {
  const normalizedStatus = (booking.status ?? "").trim().toLowerCase();

  if (requests.some(isOpenExtensionRequest)) {
    return {
      eligible: false,
      reason: "Extension request already submitted",
    } as const;
  }

  if (requests.some(isOpenPickupRequest)) {
    return {
      eligible: false,
      reason: "Pickup request already submitted. We’ll review that before more time can be requested.",
    } as const;
  }

  if (normalizedStatus === "confirmed" || normalizedStatus === "scheduled" || normalizedStatus === "delivered") {
    return {
      eligible: true,
      reason: null,
    } as const;
  }

  return {
    eligible: false,
    reason: "This rental is not currently eligible for extension requests",
  } as const;
}

export function getIssueReportEligibility(booking: RentalEligibilityInput) {
  const normalizedStatus = (booking.status ?? "").trim().toLowerCase();

  if (normalizedStatus === "confirmed" || normalizedStatus === "scheduled" || normalizedStatus === "delivered") {
    return {
      eligible: true,
      reason: null,
    } as const;
  }

  return {
    eligible: false,
    reason: "Issue reporting is only available for active rentals.",
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

export function getActionTypeShortDescription(actionType: RentalActionType) {
  switch (actionType) {
    case "pickup_request":
      return "Pickup coordination";
    case "extension_request":
      return "More rental time";
    case "issue_report":
      return "Support request";
  }
}

export function getCustomerVisibleStatusLabel(
  status: CustomerVisibleRequestStatus,
  actionType?: RentalActionType,
) {
  switch (status) {
    case "received":
      return actionType === "issue_report" ? "Issue received" : "Request received";
    case "under_review":
      return actionType === "issue_report" ? "Investigating" : "Under review";
    case "pickup_scheduled":
      return actionType === "pickup_request" ? "Pickup scheduled" : "Scheduled";
    case "unable_to_confirm":
      return "Need follow-up";
    case "completed":
      return actionType === "issue_report" ? "Resolved" : "Completed";
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

export function getRequestPriorityLabel(priority: RentalActionRequestRow["priority"]) {
  switch (priority) {
    case "urgent":
      return "Urgent";
    case "high":
      return "High";
    case "normal":
      return "Normal";
    case "low":
      return "Low";
  }
}

export function getRequestPriorityTone(priority: RentalActionRequestRow["priority"]) {
  switch (priority) {
    case "urgent":
      return "bg-rose-100 text-rose-700 ring-rose-200";
    case "high":
      return "bg-amber-100 text-amber-700 ring-amber-200";
    case "normal":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "low":
      return "bg-blue-50 text-blue-700 ring-blue-200";
  }
}

export function formatRequestSummary(request: Pick<RentalActionRequestRow, "action_type" | "details_json">) {
  if (request.action_type === "issue_report") {
    const details = (request.details_json ?? {}) as Partial<IssueReportDetails>;
    const issueCategory = details.issueCategory;
    if (issueCategory) {
      return `Reported ${getIssueCategoryLabel(issueCategory).toLowerCase()} and requested help.`;
    }

    return "Reported a rental issue.";
  }

  if (request.action_type === "extension_request") {
    const details = (request.details_json ?? {}) as Partial<ExtensionRequestDetails>;
    const requestedExtraDays = details.requestedExtraDays;

    if (typeof requestedExtraDays === "number" && Number.isFinite(requestedExtraDays)) {
      return `Requested ${requestedExtraDays} extra day${requestedExtraDays === 1 ? "" : "s"} for the rental.`;
    }

    return "Requested more rental time.";
  }

  if (request.action_type !== "pickup_request") {
    return "Customer request submitted.";
  }

  const details = (request.details_json ?? {}) as Partial<PickupRequestDetails>;

  if (details.timingPreference === "specific_date" && details.requestedDate) {
    return `Requested pickup on ${details.requestedDate}.`;
  }

  return "Requested pickup as soon as possible.";
}

const EXTENSION_REQUEST_REASONS = new Set<ExtensionRequestReason>([
  "project_running_long",
  "weather_delay",
  "waiting_on_contractor",
  "more_cleanup_needed",
  "other",
]);

const ISSUE_CATEGORIES = new Set<IssueCategory>([
  "delivery_issue",
  "pickup_issue",
  "placement_problem",
  "damage_concern",
  "billing_question",
  "usage_question",
  "other",
]);

const ISSUE_URGENCY_OPTIONS = new Set<IssueUrgency>(["standard", "urgent_today"]);
const ISSUE_CONTACT_METHODS = new Set<IssuePreferredContactMethod>(["phone", "email"]);

function parseRequestedExtraDays(input: string | number | null | undefined) {
  if (typeof input === "number") {
    return Number.isInteger(input) ? input : null;
  }

  const cleaned = String(input ?? "").trim();
  if (!cleaned) return null;
  if (!/^\d+$/.test(cleaned)) return null;

  const parsed = Number.parseInt(cleaned, 10);
  return Number.isInteger(parsed) ? parsed : null;
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
    notes: input.notes?.trim() ? input.notes.trim().slice(0, PICKUP_REQUEST_NOTES_MAX_LENGTH) : null,
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

  if ((details.notes?.length ?? 0) > PICKUP_REQUEST_NOTES_MAX_LENGTH) {
    return `Notes must be ${PICKUP_REQUEST_NOTES_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}

export function sanitizeExtensionRequestDetails(input: {
  requestedExtraDays?: string | number | null;
  reason?: string | null;
  notes?: string | null;
  acknowledgePossibleFees: boolean;
}) {
  const normalizedReason = (input.reason ?? "").trim();
  const reason = EXTENSION_REQUEST_REASONS.has(normalizedReason as ExtensionRequestReason)
    ? (normalizedReason as ExtensionRequestReason)
    : null;

  return {
    requestedExtraDays: parseRequestedExtraDays(input.requestedExtraDays),
    reason,
    notes: input.notes?.trim() ? input.notes.trim().slice(0, EXTENSION_REQUEST_NOTES_MAX_LENGTH) : null,
    acknowledgePossibleFees: input.acknowledgePossibleFees,
  } satisfies ExtensionRequestDetails;
}

export function getExtensionReasonLabel(reason: ExtensionRequestReason | null | undefined) {
  switch (reason) {
    case "project_running_long":
      return "Project running long";
    case "weather_delay":
      return "Weather delay";
    case "waiting_on_contractor":
      return "Waiting on contractor";
    case "more_cleanup_needed":
      return "More cleanup needed";
    case "other":
      return "Other";
    default:
      return "—";
  }
}

export function validateExtensionRequestDetails(details: ExtensionRequestDetails) {
  if (!details.acknowledgePossibleFees) {
    return "Acknowledge that added rental time may include additional charges.";
  }

  if (details.requestedExtraDays === null) {
    return "Choose how many extra days you need.";
  }

  if (
    !Number.isInteger(details.requestedExtraDays) ||
    details.requestedExtraDays < EXTENSION_REQUEST_MIN_DAYS ||
    details.requestedExtraDays > EXTENSION_REQUEST_MAX_DAYS
  ) {
    return `Extra days must be between ${EXTENSION_REQUEST_MIN_DAYS} and ${EXTENSION_REQUEST_MAX_DAYS}.`;
  }

  if ((details.notes?.length ?? 0) > EXTENSION_REQUEST_NOTES_MAX_LENGTH) {
    return `Notes must be ${EXTENSION_REQUEST_NOTES_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}

export function sanitizeIssueReportDetails(input: {
  issueCategory?: string | null;
  urgency?: string | null;
  description?: string | null;
  preferredContactMethod?: string | null;
}) {
  const normalizedIssueCategory = (input.issueCategory ?? "").trim();
  const issueCategory = ISSUE_CATEGORIES.has(normalizedIssueCategory as IssueCategory)
    ? (normalizedIssueCategory as IssueCategory)
    : null;

  const normalizedUrgency = (input.urgency ?? "").trim();
  const urgency = ISSUE_URGENCY_OPTIONS.has(normalizedUrgency as IssueUrgency)
    ? (normalizedUrgency as IssueUrgency)
    : null;

  const normalizedPreferredContactMethod = (input.preferredContactMethod ?? "").trim();
  const preferredContactMethod = ISSUE_CONTACT_METHODS.has(
    normalizedPreferredContactMethod as IssuePreferredContactMethod,
  )
    ? (normalizedPreferredContactMethod as IssuePreferredContactMethod)
    : null;

  return {
    issueCategory,
    urgency,
    description: input.description?.trim() ? input.description.trim().slice(0, ISSUE_REPORT_DESCRIPTION_MAX_LENGTH) : "",
    preferredContactMethod,
  } satisfies IssueReportDetails;
}

export function validateIssueReportDetails(details: IssueReportDetails) {
  if (!details.issueCategory) {
    return "Choose the type of issue you need help with.";
  }

  if (!details.urgency) {
    return "Choose how urgent this issue is.";
  }

  if (details.description.length < ISSUE_REPORT_DESCRIPTION_MIN_LENGTH) {
    return `Description must be at least ${ISSUE_REPORT_DESCRIPTION_MIN_LENGTH} characters.`;
  }

  if (details.description.length > ISSUE_REPORT_DESCRIPTION_MAX_LENGTH) {
    return `Description must be ${ISSUE_REPORT_DESCRIPTION_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}

export function getIssueCategoryLabel(category: IssueCategory | null | undefined) {
  switch (category) {
    case "delivery_issue":
      return "Delivery issue";
    case "pickup_issue":
      return "Pickup issue";
    case "placement_problem":
      return "Placement problem";
    case "damage_concern":
      return "Damage concern";
    case "billing_question":
      return "Billing question";
    case "usage_question":
      return "Usage question";
    case "other":
      return "Other";
    default:
      return "—";
  }
}

export function getIssueUrgencyLabel(urgency: IssueUrgency | null | undefined) {
  switch (urgency) {
    case "standard":
      return "Standard";
    case "urgent_today":
      return "Need help today";
    default:
      return "—";
  }
}

export function getIssuePreferredContactMethodLabel(
  preferredContactMethod: IssuePreferredContactMethod | null | undefined,
) {
  switch (preferredContactMethod) {
    case "phone":
      return "Phone";
    case "email":
      return "Email";
    default:
      return "—";
  }
}

export function getAvailableCustomerVisibleStatuses(actionType: RentalActionType) {
  switch (actionType) {
    case "pickup_request":
      return ["received", "under_review", "pickup_scheduled", "unable_to_confirm", "completed"] as const;
    case "extension_request":
    case "issue_report":
      return ["received", "under_review", "unable_to_confirm", "completed"] as const;
  }
}
