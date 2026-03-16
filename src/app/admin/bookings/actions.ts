"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function deleteBookingAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;

  const { error } = await supabaseAdmin.from("bookings").delete().eq("id", id);
  if (error) {
    console.error("ADMIN DELETE BOOKING ERROR:", error);
    // Optional: throw new Error("Failed to delete booking");
  }

  revalidatePath("/admin/bookings");
}

export async function deleteHoldAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;

  // 👇 Change table name if yours is different
  const { error } = await supabaseAdmin.from("booking_holds").delete().eq("id", id);
  if (error) {
    console.error("ADMIN DELETE HOLD ERROR:", error);
  }

  revalidatePath("/admin/bookings");
}