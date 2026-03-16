import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const bookingId = searchParams.get("bookingId") || searchParams.get("id");

    if (!bookingId) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, status, total_price_cents, customer_name, customer_email, customer_street, customer_city, customer_zip, delivery_date, pickup_mode, pickup_date, service_town, service_county"
      )
      .eq("id", bookingId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "Not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, booking: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      customer_name,
      customer_email, // ✅ add
      customer_street,
      customer_city,
      customer_zip,
      delivery_date,
      pickup_mode,
      pickup_date,
      total_price_cents,
      service_county,
      service_town,
    } = body;

    // Minimal required fields for v1
    if (!customer_name || !customer_street || !customer_city || !customer_zip || !delivery_date) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        customer_name,
        customer_email: customer_email ?? null, // ✅ add (nullable)
        customer_street,
        customer_city,
        customer_zip,
        delivery_date,
        pickup_mode: pickup_mode ?? "request",
        pickup_date: pickup_date ?? null,
        status: "confirmed",
        total_price_cents: total_price_cents ?? null,
        service_county: service_county ?? null,
        service_town: service_town ?? null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, details: error.details },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}