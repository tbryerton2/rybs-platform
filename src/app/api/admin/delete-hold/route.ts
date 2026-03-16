// src/app/api/admin/delete-hold/route.ts
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const form = await req.formData();
  const id = String(form.get("id") || "").trim();
  const redirectTo = String(form.get("redirectTo") || "/admin/bookings#holds").trim();

  if (id) {
    const { error } = await supabaseAdmin.from("booking_holds").delete().eq("id", id);
    if (error) console.error("API DELETE HOLD ERROR:", error);
  }

  redirect(redirectTo);
}