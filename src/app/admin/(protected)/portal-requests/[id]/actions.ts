"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminOwner } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RentalActionStatus = "submitted" | "under_review" | "approved" | "denied" | "completed";
type CustomerVisibleRequestStatus =
  | "received"
  | "under_review"
  | "pickup_scheduled"
  | "unable_to_confirm"
  | "completed";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function emptyToNull(value: string) {
  return value ? value : null;
}

export async function updatePortalRequestAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const id = asString(formData.get("id"));
  const status = asString(formData.get("status")) as RentalActionStatus;
  const customerVisibleStatus = asString(
    formData.get("customer_visible_status"),
  ) as CustomerVisibleRequestStatus;
  const internalNotes = emptyToNull(asString(formData.get("internal_notes")));
  const customerUpdate = emptyToNull(asString(formData.get("customer_update")));

  if (!id) throw new Error("Missing request id");
  if (!status) throw new Error("Missing internal status");
  if (!customerVisibleStatus) throw new Error("Missing customer-visible status");

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("rental_action_requests")
    .select("id, booking_id, status")
    .eq("id", id)
    .eq("business_id", adminSession.business.id)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);
  if (!existing) throw new Error("Request not found");

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status,
    customer_visible_status: customerVisibleStatus,
    internal_notes: internalNotes,
    customer_update: customerUpdate,
  };

  if (status !== "submitted") {
    updates.reviewed_at = now;
  }

  if (status === "completed" || status === "denied") {
    updates.resolved_at = now;
  } else {
    updates.resolved_at = null;
  }

  const { error: updateError } = await supabaseAdmin
    .from("rental_action_requests")
    .update(updates)
    .eq("id", id)
    .eq("business_id", adminSession.business.id);

  if (updateError) throw new Error(updateError.message);

  revalidatePath("/admin/portal-requests");
  revalidatePath(`/admin/portal-requests/${id}`);
  revalidatePath(`/admin/bookings/${existing.booking_id}`);
  revalidatePath(`/portal/rentals/${existing.booking_id}`);
  revalidatePath("/portal");

  redirect(`/admin/portal-requests/${id}?saved=1`);
}
