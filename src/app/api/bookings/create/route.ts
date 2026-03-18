import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { attachCustomerToBooking, normalizePhone } from "@/lib/customers";

type Payload = {
  customer_name: string;
  customer_street: string;
  customer_city?: string;
  customer_zip: string;

  service_county?: string;
  service_town?: string;

  delivery_date?: string; // YYYY-MM-DD
  pickup_mode?: "request" | "schedule";
  pickup_date?: string | null; // YYYY-MM-DD or null

  total_price_cents?: number;
  customer_phone?: string;
  customer_email?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;

    // Minimal required fields for v1 draft
    if (!body.customer_name?.trim()) {
      return NextResponse.json({ ok: false, error: "Missing customer_name" }, { status: 400 });
    }
    if (!body.customer_street?.trim()) {
      return NextResponse.json({ ok: false, error: "Missing customer_street" }, { status: 400 });
    }
    if (!/^\d{5}$/.test(body.customer_zip ?? "")) {
      return NextResponse.json({ ok: false, error: "Invalid customer_zip" }, { status: 400 });
    }

    const supabase = supabaseServer();
    const customerPhone = normalizePhone(body.customer_phone);

    const insertRow = {
      customer_name: body.customer_name.trim(),
      customer_street: body.customer_street.trim(),
      customer_city: body.customer_city?.trim() ?? null,
      customer_zip: body.customer_zip,

      service_county: body.service_county?.trim() ?? null,
      service_town: body.service_town?.trim() ?? null,

      delivery_date: body.delivery_date ?? null,
      pickup_mode: body.pickup_mode ?? "request",
      pickup_date: body.pickup_date ?? null,

      total_price_cents: typeof body.total_price_cents === "number" ? body.total_price_cents : null,
      customer_phone: customerPhone,
      customer_email: body.customer_email?.trim() ?? null,

      status: "draft",
    };

    const { data, error } = await supabase
      .from("bookings")
      .insert(insertRow)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    try {
      await attachCustomerToBooking(data.id, {
        fullName: insertRow.customer_name,
        email: insertRow.customer_email,
        phone: insertRow.customer_phone,
        street: insertRow.customer_street,
        city: insertRow.customer_city,
        zip: insertRow.customer_zip,
      }, supabase);
    } catch (customerLinkError) {
      console.error("customer linkage failed for /api/bookings/create:", customerLinkError);
    }

    return NextResponse.json({ ok: true, booking_id: data.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
