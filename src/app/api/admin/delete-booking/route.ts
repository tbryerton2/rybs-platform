// src/app/api/admin/delete-booking/route.ts
import { redirect } from "next/navigation";
import { requireAdminOwnerForApi } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const adminAuth = await requireAdminOwnerForApi();
  if (!adminAuth.ok) return adminAuth.response;

  const form = await req.formData();
  const id = String(form.get("id") || "").trim();
  const redirectTo = String(form.get("redirectTo") || "/admin/bookings").trim();

  if (id) {
    const { error } = await supabaseAdmin
      .from("bookings")
      .delete()
      .eq("id", id)
      .eq("business_id", adminAuth.session.business.id);
    if (error) console.error("API DELETE BOOKING ERROR:", error);
  }

  redirect(redirectTo);
}
