import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

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
      customer_phone: body.customer_phone?.trim() ?? null,
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

    return NextResponse.json({ ok: true, booking_id: data.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}