import { NextResponse } from "next/server";
import { requireAdminOwnerForApi } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const adminAuth = await requireAdminOwnerForApi();
  if (!adminAuth.ok) return adminAuth.response;

  const { id, type, date } = await req.json();

  if (!id || !type || !date) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const update: Record<string, string> = {};

  if (type === "delivery") {
    update.delivery_date = date;
  }

  if (type === "pickup") {
    update.pickup_date = date;
    update.pickup_mode = "scheduled";
  }

  const { error } = await supabaseAdmin
    .from("bookings")
    .update(update)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
