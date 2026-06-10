import { NextResponse } from "next/server";
import { requireAdminOwnerForApi } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const adminAuth = await requireAdminOwnerForApi();
  if (!adminAuth.ok) return adminAuth.response;

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, created_at, status, customer_first_name, customer_last_name, customer_street, customer_city, customer_zip, delivery_date, pickup_mode, pickup_date, service_town, service_county, total_price_cents"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bookings: data });
}
