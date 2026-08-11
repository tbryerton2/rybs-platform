import { NextResponse, type NextRequest } from "next/server";
import { combineCustomerNameParts } from "@/lib/customer-name";
import { formatBookingStatusLabel } from "@/lib/admin/booking-status";
import { requireAdminOwnerForApi } from "@/lib/admin/auth";
import { formatUsdFromCents } from "@/lib/money";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatDateTimeET } from "@/lib/time";

type BookingStatus = "delivered" | "picked_up";

type ExportBookingRow = {
  booking_ref: string | null;
  created_at: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string | null;
  pickup_date: string | null;
  status: BookingStatus;
  total_price_cents: number | null;
};

const REVENUE_STATUSES: BookingStatus[] = ["delivered", "picked_up"];

function isISODate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function csvCell(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;

  return `"${safe.replace(/"/g, '""')}"`;
}

function csvRow(values: Array<string | number | null | undefined>) {
  return values.map(csvCell).join(",");
}

function buildFilename(startDate: string, endDate: string) {
  const range =
    startDate || endDate
      ? `${startDate || "start"}_to_${endDate || "today"}`
      : "all-time";

  return `revenue-${range}.csv`;
}

export async function GET(req: NextRequest) {
  const adminAuth = await requireAdminOwnerForApi();
  if (!adminAuth.ok) return adminAuth.response;

  const startDate = isISODate(req.nextUrl.searchParams.get("start"))
    ? req.nextUrl.searchParams.get("start")!
    : "";
  const endDate = isISODate(req.nextUrl.searchParams.get("end"))
    ? req.nextUrl.searchParams.get("end")!
    : "";

  let query = supabaseAdmin
    .from("bookings")
    .select(`
      booking_ref,
      created_at,
      customer_first_name,
      customer_last_name,
      customer_email,
      customer_phone,
      customer_street,
      customer_city,
      customer_zip,
      delivery_date,
      pickup_date,
      status,
      total_price_cents
    `)
    .eq("business_id", adminAuth.session.business.id)
    .in("status", REVENUE_STATUSES)
    .order("delivery_date", { ascending: true, nullsFirst: false });

  if (startDate) query = query.gte("delivery_date", startDate);
  if (endDate) query = query.lte("delivery_date", endDate);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ExportBookingRow[];
  const headers = [
    "Booking ref",
    "Delivery date",
    "Pickup date",
    "Customer name",
    "Customer email",
    "Customer phone",
    "Customer street",
    "Customer city",
    "Customer ZIP",
    "Status",
    "Total price",
    "Created at",
  ];

  const csv = [
    csvRow(headers),
    ...rows.map((row) =>
      csvRow([
        row.booking_ref,
        row.delivery_date,
        row.pickup_date,
        combineCustomerNameParts(row.customer_first_name, row.customer_last_name) || "Unnamed customer",
        row.customer_email,
        row.customer_phone,
        row.customer_street,
        row.customer_city,
        row.customer_zip,
        formatBookingStatusLabel(row.status),
        formatUsdFromCents(row.total_price_cents),
        formatDateTimeET(row.created_at),
      ])
    ),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${buildFilename(startDate, endDate)}"`,
      "Cache-Control": "no-store",
    },
  });
}
