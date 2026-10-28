import { combineCustomerNameParts } from "@/lib/customer-name";
import { formatBookingStatusLabel } from "@/lib/admin/booking-status";
import { formatUsdFromCents } from "@/lib/money";
import { formatDateTimeET } from "@/lib/time";
import type { CollectionRow } from "./collections";

function csvCell(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;

  return `"${safe.replace(/"/g, '""')}"`;
}

function csvRow(values: Array<string | number | null | undefined>) {
  return values.map(csvCell).join(",");
}

export function buildCollectionsCsv(rows: CollectionRow[]) {
  const headers = [
    "Payment ID",
    "Payment date (Eastern)",
    "Paid at (Eastern)",
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
    "Collected (USD)",
    "Recorded refunds (USD)",
    "Money collected net (USD)",
  ];

  return [
    csvRow(headers),
    ...rows.map((row) =>
      csvRow([
        row.id,
        row.payment_date,
        formatDateTimeET(row.paid_at),
        row.booking?.booking_ref ?? "Awaiting job",
        row.booking?.delivery_date,
        row.booking?.pickup_date,
        combineCustomerNameParts(row.booking?.customer_first_name, row.booking?.customer_last_name) || "Unnamed customer",
        row.booking?.customer_email,
        row.booking?.customer_phone,
        row.booking?.customer_street,
        row.booking?.customer_city,
        row.booking?.customer_zip,
        formatBookingStatusLabel(row.booking?.status),
        formatUsdFromCents(row.collected_cents),
        formatUsdFromCents(row.refunded_cents),
        formatUsdFromCents(row.net_cents),
      ])
    ),
  ].join("\n");
}
