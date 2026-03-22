"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePortalCustomer } from "@/lib/portal/auth";
import {
  getExtensionEligibility,
  getIssueReportEligibility,
  getPickupEligibility,
  sanitizeIssueReportDetails,
  sanitizeExtensionRequestDetails,
  sanitizePickupRequestDetails,
  validateIssueReportDetails,
  validateExtensionRequestDetails,
  validatePickupRequestDetails,
} from "@/lib/rental-action-requests";
import { isPortalSchemaError } from "@/lib/portal/schema";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function toSearchParams(input: Record<string, string>) {
  const params = new URLSearchParams();

  for (const [key, keyValue] of Object.entries(input)) {
    if (keyValue) params.set(key, keyValue);
  }

  return params.toString();
}

async function loadOwnedBookingWithRequests(customerId: string, bookingId: string) {
  const [{ data: booking, error: bookingError }, { data: requests, error: requestsError }] =
    await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select("id, customer_id, status, pickup_mode, customer_street, customer_city, customer_zip")
        .eq("id", bookingId)
        .eq("customer_id", customerId)
        .maybeSingle(),
      supabaseAdmin
        .from("rental_action_requests")
        .select("id, action_type, status")
        .eq("booking_id", bookingId),
    ]);

  if (bookingError) throw new Error(bookingError.message);
  if (requestsError && !isPortalSchemaError(requestsError)) throw new Error(requestsError.message);
  if (!booking) throw new Error("Booking not found.");

  return {
    booking,
    requests: requestsError ? [] : (requests ?? []),
  };
}

export async function submitPortalPickupRequestAction(formData: FormData) {
  const customer = await requirePortalCustomer();
  const bookingId = value(formData, "booking_id");
  const step = value(formData, "step");

  const details = sanitizePickupRequestDetails({
    timingPreference: value(formData, "timing_preference"),
    requestedDate: value(formData, "requested_pickup_date") || null,
    accessConfirmed: formData.get("access_confirmed") === "on",
    notes: value(formData, "notes"),
  });

  const validationError = validatePickupRequestDetails(details);
  if (validationError) {
    const params = toSearchParams({
      error: validationError,
      timing: details.timingPreference,
      requestedDate: details.requestedDate ?? "",
      accessConfirmed: details.accessConfirmed ? "1" : "",
      notes: details.notes ?? "",
    });
    redirect(`/portal/rentals/${bookingId}/pickup-request?${params}`);
  }

  if (step === "review") {
    const params = toSearchParams({
      step: "review",
      timing: details.timingPreference,
      requestedDate: details.requestedDate ?? "",
      accessConfirmed: details.accessConfirmed ? "1" : "",
      notes: details.notes ?? "",
    });
    redirect(`/portal/rentals/${bookingId}/pickup-request?${params}`);
  }

  const { booking, requests } = await loadOwnedBookingWithRequests(customer.id, bookingId);
  const eligibility = getPickupEligibility(booking, requests);

  if (!eligibility.eligible) {
    redirect(
      `/portal/rentals/${bookingId}/pickup-request?${toSearchParams({
        error: eligibility.reason ?? "This rental is not eligible for pickup requests.",
      })}`,
    );
  }

  const { error: insertError } = await supabaseAdmin.from("rental_action_requests").insert({
    booking_id: booking.id,
    customer_id: customer.id,
    action_type: "pickup_request",
    status: "submitted",
    customer_visible_status: "received",
    priority: details.timingPreference === "asap" ? "high" : "normal",
    details_json: details,
    submitted_at: new Date().toISOString(),
  });

  if (insertError) {
    if (isPortalSchemaError(insertError)) {
      redirect(
        `/portal/rentals/${bookingId}/pickup-request?${toSearchParams({
          error: "Portal requests are temporarily unavailable. Please contact support directly.",
        })}`,
      );
    }

    if (insertError.code === "23505") {
      redirect(
        `/portal/rentals/${bookingId}/pickup-request?${toSearchParams({
          error: "Pickup request already submitted",
        })}`,
      );
    }

    throw new Error(insertError.message);
  }

  revalidatePath(`/portal/rentals/${booking.id}`);
  revalidatePath(`/portal/rentals/${booking.id}/pickup-request`);
  revalidatePath("/portal");
  revalidatePath("/admin/portal-requests");
  redirect(`/portal/rentals/${booking.id}/pickup-request?submitted=1`);
}

export async function submitPortalExtensionRequestAction(formData: FormData) {
  const customer = await requirePortalCustomer();
  const bookingId = value(formData, "booking_id");
  const step = value(formData, "step");

  const details = sanitizeExtensionRequestDetails({
    requestedExtraDays: value(formData, "requested_extra_days"),
    reason: value(formData, "reason") || null,
    notes: value(formData, "notes"),
    acknowledgePossibleFees: formData.get("acknowledge_possible_fees") === "on",
  });

  const validationError = validateExtensionRequestDetails(details);
  if (validationError) {
    redirect(
      `/portal/rentals/${bookingId}/extension-request?${toSearchParams({
        error: validationError,
        requestedExtraDays: details.requestedExtraDays ? String(details.requestedExtraDays) : "",
        reason: details.reason ?? "",
        notes: details.notes ?? "",
        acknowledgePossibleFees: details.acknowledgePossibleFees ? "1" : "",
      })}`,
    );
  }

  if (step === "review") {
    redirect(
      `/portal/rentals/${bookingId}/extension-request?${toSearchParams({
        step: "review",
        requestedExtraDays: details.requestedExtraDays ? String(details.requestedExtraDays) : "",
        reason: details.reason ?? "",
        notes: details.notes ?? "",
        acknowledgePossibleFees: details.acknowledgePossibleFees ? "1" : "",
      })}`,
    );
  }

  const { booking, requests } = await loadOwnedBookingWithRequests(customer.id, bookingId);
  const eligibility = getExtensionEligibility(booking, requests);

  if (!eligibility.eligible) {
    redirect(
      `/portal/rentals/${bookingId}/extension-request?${toSearchParams({
        error: eligibility.reason ?? "This rental is not eligible for extension requests.",
      })}`,
    );
  }

  const { error: insertError } = await supabaseAdmin.from("rental_action_requests").insert({
    booking_id: booking.id,
    customer_id: customer.id,
    action_type: "extension_request",
    status: "submitted",
    customer_visible_status: "received",
    priority: "normal",
    details_json: details,
    submitted_at: new Date().toISOString(),
  });

  if (insertError) {
    if (isPortalSchemaError(insertError)) {
      redirect(
        `/portal/rentals/${bookingId}/extension-request?${toSearchParams({
          error: "Portal requests are temporarily unavailable. Please contact support directly.",
        })}`,
      );
    }

    if (insertError.code === "23505") {
      redirect(
        `/portal/rentals/${bookingId}/extension-request?${toSearchParams({
          error: "Extension request already submitted",
        })}`,
      );
    }

    throw new Error(insertError.message);
  }

  revalidatePath(`/portal/rentals/${booking.id}`);
  revalidatePath(`/portal/rentals/${booking.id}/extension-request`);
  revalidatePath("/portal");
  revalidatePath("/admin/portal-requests");
  redirect(`/portal/rentals/${booking.id}/extension-request?submitted=1`);
}

export async function submitPortalIssueReportAction(formData: FormData) {
  const customer = await requirePortalCustomer();
  const bookingId = value(formData, "booking_id");
  const step = value(formData, "step");

  const details = sanitizeIssueReportDetails({
    issueCategory: value(formData, "issue_category") || null,
    urgency: value(formData, "urgency") || null,
    description: value(formData, "description"),
    preferredContactMethod: value(formData, "preferred_contact_method") || null,
  });

  const validationError = validateIssueReportDetails(details);
  if (validationError) {
    redirect(
      `/portal/rentals/${bookingId}/issue-report?${toSearchParams({
        error: validationError,
        issueCategory: details.issueCategory ?? "",
        urgency: details.urgency ?? "",
        description: details.description,
        preferredContactMethod: details.preferredContactMethod ?? "",
      })}`,
    );
  }

  if (step === "review") {
    redirect(
      `/portal/rentals/${bookingId}/issue-report?${toSearchParams({
        step: "review",
        issueCategory: details.issueCategory ?? "",
        urgency: details.urgency ?? "",
        description: details.description,
        preferredContactMethod: details.preferredContactMethod ?? "",
      })}`,
    );
  }

  const { booking } = await loadOwnedBookingWithRequests(customer.id, bookingId);
  const eligibility = getIssueReportEligibility(booking);

  if (!eligibility.eligible) {
    redirect(
      `/portal/rentals/${bookingId}/issue-report?${toSearchParams({
        error: eligibility.reason ?? "This rental is not eligible for issue reporting.",
      })}`,
    );
  }

  const { error: insertError } = await supabaseAdmin.from("rental_action_requests").insert({
    booking_id: booking.id,
    customer_id: customer.id,
    action_type: "issue_report",
    status: "submitted",
    customer_visible_status: "received",
    priority: details.urgency === "urgent_today" ? "high" : "normal",
    details_json: details,
    submitted_at: new Date().toISOString(),
  });

  if (insertError) {
    if (isPortalSchemaError(insertError)) {
      redirect(
        `/portal/rentals/${bookingId}/issue-report?${toSearchParams({
          error: "Portal requests are temporarily unavailable. Please contact support directly.",
        })}`,
      );
    }

    throw new Error(insertError.message);
  }

  revalidatePath(`/portal/rentals/${booking.id}`);
  revalidatePath(`/portal/rentals/${booking.id}/issue-report`);
  revalidatePath("/portal");
  revalidatePath("/admin/portal-requests");
  redirect(`/portal/rentals/${booking.id}/issue-report?submitted=1`);
}
