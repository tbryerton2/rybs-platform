"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePortalCustomer } from "@/lib/portal/auth";
import { sendEmail } from "@/lib/email/ses";
import { buildAdminPortalRequestEmail } from "@/lib/email/templates/admin-portal-request";
import { buildAdminIssueReportEmail } from "@/lib/email/templates/admin-issue-report";
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
import { getCurrentTenant } from "@/lib/tenant/server";

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
  const tenant = await getCurrentTenant();
  const [{ data: booking, error: bookingError }, { data: requests, error: requestsError }] =
    await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select("id, business_id, customer_id, status, pickup_mode, customer_street, customer_city, customer_zip")
        .eq("id", bookingId)
        .eq("business_id", tenant.id)
        .eq("customer_id", customerId)
        .maybeSingle(),
      supabaseAdmin
        .from("rental_action_requests")
        .select("id, action_type, status")
        .eq("business_id", tenant.id)
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

async function sendAdminPortalRequestEmail({
  requestType,
  customer,
  booking,
  priority,
  details,
}: {
  requestType: string;
  customer: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
  booking: {
    id: string;
    customer_street?: string | null;
    customer_city?: string | null;
    customer_zip?: string | null;
  };
  priority?: string | null;
  details: Record<string, string | number | boolean | null | undefined>;
}) {
  const adminBookingEmail = process.env.ADMIN_BOOKING_EMAIL;

  if (!adminBookingEmail) {
    console.error(`[portal] skipped ${requestType} email because ADMIN_BOOKING_EMAIL is missing.`);
    return;
  }

  const serviceAddress = [
    booking.customer_street,
    booking.customer_city,
    booking.customer_zip,
  ]
    .filter(Boolean)
    .join(", ");

  const adminUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/admin/portal-requests`
    : null;

  const adminNotification = buildAdminPortalRequestEmail({
    requestType,
    customerName: customer.name,
    customerEmail: customer.email,
    bookingId: booking.id,
    priority,
    serviceAddress,
    details,
    adminUrl,
  });

  try {
    await sendEmail({
      to: adminBookingEmail,
      subject: adminNotification.subject,
      text: adminNotification.text,
      html: adminNotification.html,
    });
  } catch (portalRequestEmailError) {
    console.error(`[portal] ${requestType} email send failed:`, {
      bookingId: booking.id,
      customerId: customer.id,
      error: portalRequestEmailError,
    });
  }
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
    business_id: booking.business_id,
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

  await sendAdminPortalRequestEmail({
    requestType: "pickup_request",
    customer,
    booking,
    priority: details.timingPreference === "asap" ? "high" : "normal",
    details: {
      timingPreference: details.timingPreference,
      requestedDate: details.requestedDate,
      accessConfirmed: details.accessConfirmed,
      notes: details.notes,
    },
  });

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
    business_id: booking.business_id,
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

  await sendAdminPortalRequestEmail({
    requestType: "extension_request",
    customer,
    booking,
    priority: "normal",
    details: {
      requestedExtraDays: details.requestedExtraDays,
      reason: details.reason,
      notes: details.notes,
      acknowledgePossibleFees: details.acknowledgePossibleFees,
    },
  });

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
    business_id: booking.business_id,
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

    const adminBookingEmail = process.env.ADMIN_BOOKING_EMAIL;

  if (adminBookingEmail) {
    const serviceAddress = [
      booking.customer_street,
      booking.customer_city,
      booking.customer_zip,
    ]
      .filter(Boolean)
      .join(", ");

    const adminUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/admin/portal-requests?filter=issue_report`
      : null;

    const issueReportEmail = buildAdminIssueReportEmail({
      customerName: customer.name,
      customerEmail: customer.email,
      bookingId: booking.id,
      issueCategory: details.issueCategory,
      urgency: details.urgency,
      description: details.description,
      preferredContactMethod: details.preferredContactMethod,
      serviceAddress,
      adminUrl,
    });

    try {
      await sendEmail({
        to: adminBookingEmail,
        subject: issueReportEmail.subject,
        text: issueReportEmail.text,
        html: issueReportEmail.html,
      });
    } catch (issueReportEmailError) {
      console.error("[portal] issue report email send failed:", {
        bookingId: booking.id,
        customerId: customer.id,
        error: issueReportEmailError,
      });
    }
  } else {
    console.error("[portal] skipped issue report email because ADMIN_BOOKING_EMAIL is missing.");
  }

  revalidatePath(`/portal/rentals/${booking.id}`);
  revalidatePath(`/portal/rentals/${booking.id}/issue-report`);
  revalidatePath("/portal");
  revalidatePath("/admin/portal-requests");
  redirect(`/portal/rentals/${booking.id}/issue-report?submitted=1`);
}
