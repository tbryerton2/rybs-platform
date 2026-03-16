"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ delivery_date })
    .eq("id", id);

  if (error) throw new Error(error.message);

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

  const updates: Record<string, unknown> = {
    pickup_mode,
    pickup_date: pickup_mode === "request" ? null : pickup_date,
  };

  const { error } = await supabaseAdmin
    .from("bookings")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${id}?saved=pickup-details#pickup`);
}


export async function quickMarkDeliveredAction(formData: FormData) {
  const id = asString(formData.get("id"));
  if (!id) throw new Error("Missing booking id");

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");
}

export async function quickMarkPickedUpAction(formData: FormData) {
  const id = asString(formData.get("id"));
  if (!id) throw new Error("Missing booking id");

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "picked_up",
      picked_up_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");
}

export async function quickCancelBookingAction(formData: FormData) {
  const id = asString(formData.get("id"));
  if (!id) throw new Error("Missing booking id");

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");
}