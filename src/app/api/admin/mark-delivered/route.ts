import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const form = await req.formData();
  const id = String(form.get("id") || "").trim();
  const redirectTo = String(form.get("redirectTo") || "/admin/bookings").trim();

  if (id) {
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", id);

    if (error) console.error("API MARK DELIVERED ERROR:", error);
  }

  redirect(redirectTo);
}