"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bookingPlacementSchemaMessage, isBookingSchemaError } from "@/lib/booking-schema";
import { diffEntityFields, recordEntityHistory } from "@/lib/entity-history";
import {
  sanitizePlacementDetails,
  validatePlacementDetails,
} from "@/lib/placement";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type BookingStatus =
  | "confirmed"
  | "scheduled"
  | "delivered"
  | "picked_up"
  | "cancelled";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function redirectWithPlacementError(id: string, error: string) {
  redirect(`/admin/bookings/${id}?placementError=${encodeURIComponent(error)}#placement-access`);
}

export async function updateNotesAction(formData: FormData) {
  const id = asString(formData.get("id"));
  const notes = emptyToNull(asString(formData.get("notes")));

  if (!id) throw new Error("Missing booking id");

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ notes })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${id}?saved=notes#notes`);
}

export async function updateBookingStatusAction(formData: FormData) {
  const id = asString(formData.get("id"));
  const status = asString(formData.get("status")) as BookingStatus;

  if (!id) throw new Error("Missing booking id");
  if (!status) throw new Error("Missing status");

  const current = await supabaseAdmin
    .from("bookings")
    .select("status")
    .eq("id", id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const updates: Record<string, unknown> = { status };

  // Sensible ops defaults
  if (status === "picked_up") {
    updates.pickup_mode = "schedule";
  }

  const { error } = await supabaseAdmin
    .from("bookings")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(error.message);

  await recordEntityHistory(
    supabaseAdmin,
    diffEntityFields("booking", id, current.data, { status }, ["status"], {
      changedByType: "admin",
      changeReason: "Updated booking status",
    }),
  );

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${id}?saved=status#status`);
}

export async function updateDeliveryDateAction(formData: FormData) {
  const id = asString(formData.get("id"));
  const delivery_date = emptyToNull(asString(formData.get("delivery_date")));

  if (!id) throw new Error("Missing booking id");

  const current = await supabaseAdmin
    .from("bookings")
    .select("delivery_date")
    .eq("id", id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ delivery_date })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await recordEntityHistory(
    supabaseAdmin,
    diffEntityFields(
      "booking",
      id,
      current.data,
      { delivery_date },
      ["delivery_date"],
      { changedByType: "admin", changeReason: "Updated delivery date" },
    ),
  );

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${id}?saved=delivery-date#delivery`);
}

export async function updatePickupDetailsAction(formData: FormData) {
  const id = asString(formData.get("id"));
  const pickup_mode = asString(formData.get("pickup_mode"));
  const pickup_date = emptyToNull(asString(formData.get("pickup_date")));

  if (!id) throw new Error("Missing booking id");
  if (!pickup_mode) throw new Error("Missing pickup mode");

  const current = await supabaseAdmin
    .from("bookings")
    .select("pickup_mode, pickup_date")
    .eq("id", id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const updates: Record<string, unknown> = {
    pickup_mode,
    pickup_date: pickup_mode === "request" ? null : pickup_date,
  };

  const { error } = await supabaseAdmin
    .from("bookings")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(error.message);

  await recordEntityHistory(
    supabaseAdmin,
    diffEntityFields(
      "booking",
      id,
      current.data,
      { pickup_mode, pickup_date: pickup_mode === "request" ? null : pickup_date },
      ["pickup_mode", "pickup_date"],
      { changedByType: "admin", changeReason: "Updated pickup details" },
    ),
  );

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${id}?saved=pickup-details#pickup`);
}

export async function updatePlacementDetailsAction(formData: FormData) {
  const id = asString(formData.get("id"));

  if (!id) throw new Error("Missing booking id");

  const placement = sanitizePlacementDetails({
    placementPreference: asString(formData.get("placement_preference")),
    placementDetails: asString(formData.get("placement_details")),
    accessIssues: formData.getAll("access_issues"),
    gateInstructions: asString(formData.get("gate_instructions")),
    deliveryPresence: asString(formData.get("delivery_presence")),
    alternateContactName: asString(formData.get("alternate_contact_name")),
    alternateContactPhone: asString(formData.get("alternate_contact_phone")),
    placementPhotoUrl: asString(formData.get("placement_photo_url")),
    specialDeliveryInstructions: asString(formData.get("special_delivery_instructions")),
  });

  const validationError = validatePlacementDetails(placement);
  if (validationError) {
    redirectWithPlacementError(id, validationError);
  }

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      placement_preference: placement.placementPreference,
      placement_details: placement.placementDetails,
      access_issues: placement.accessIssues,
      gate_instructions: placement.gateInstructions,
      delivery_presence: placement.deliveryPresence,
      alternate_contact_name: placement.alternateContactName,
      alternate_contact_phone: placement.alternateContactPhone,
      placement_photo_url: placement.placementPhotoUrl,
      special_delivery_instructions: placement.specialDeliveryInstructions,
    })
    .eq("id", id);

  if (error) {
    if (isBookingSchemaError(error)) {
      redirectWithPlacementError(id, bookingPlacementSchemaMessage());
    }

    redirectWithPlacementError(id, error.message);
  }

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${id}?saved=placement#placement-access`);
}


export async function quickMarkDeliveredAction(formData: FormData) {
  const id = asString(formData.get("id"));
  if (!id) throw new Error("Missing booking id");

  const current = await supabaseAdmin
    .from("bookings")
    .select("status")
    .eq("id", id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await recordEntityHistory(supabaseAdmin, [
    {
      entityType: "booking",
      entityId: id,
      fieldName: "status",
      oldValue: current.data.status,
      newValue: "delivered",
      changedByType: "admin",
      changeReason: "Quick mark delivered",
    },
  ]);

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");
}

export async function quickMarkPickedUpAction(formData: FormData) {
  const id = asString(formData.get("id"));
  if (!id) throw new Error("Missing booking id");

  const current = await supabaseAdmin
    .from("bookings")
    .select("status")
    .eq("id", id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "picked_up",
      picked_up_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await recordEntityHistory(supabaseAdmin, [
    {
      entityType: "booking",
      entityId: id,
      fieldName: "status",
      oldValue: current.data.status,
      newValue: "picked_up",
      changedByType: "admin",
      changeReason: "Quick mark picked up",
    },
  ]);

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");
}

export async function quickCancelBookingAction(formData: FormData) {
  const id = asString(formData.get("id"));
  if (!id) throw new Error("Missing booking id");

  const current = await supabaseAdmin
    .from("bookings")
    .select("status")
    .eq("id", id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await recordEntityHistory(supabaseAdmin, [
    {
      entityType: "booking",
      entityId: id,
      fieldName: "status",
      oldValue: current.data.status,
      newValue: "cancelled",
      changedByType: "admin",
      changeReason: "Quick cancel booking",
    },
  ]);

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");
}
