import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildCollectionsReport, type CollectionFilters, type CollectionPayment } from "./collections";

const PAGE_SIZE = 500;

export async function loadCollectionsReport(businessId: string, filters: CollectionFilters = {}) {
  const payments: CollectionPayment[] = [];
  // Page explicitly: the Data API otherwise silently truncates larger reports.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("booking_payments")
      .select(`id, business_id, booking_id, status, amount_cents, currency, paid_at, provider, raw_provider_response,
        booking:bookings!booking_payments_booking_id_fkey(
          id, business_id, booking_ref, status, customer_first_name, customer_last_name,
          customer_email, customer_phone, customer_street, customer_city, customer_zip, delivery_date, pickup_date
        )`)
      .eq("business_id", businessId)
      .in("status", ["paid", "refunded", "partially_refunded"])
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as CollectionPayment[];
    payments.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return buildCollectionsReport(payments, businessId, filters);
}
