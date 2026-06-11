import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isBookingSchemaError } from "@/lib/booking-schema";
import { getCurrentTenant } from "@/lib/tenant/server";

export async function attachReorderReference(
  supabase: SupabaseClient,
  bookingId: string,
  reorderedFromBookingId: string | null | undefined,
  businessId?: string,
) {
  const sourceBookingId = String(reorderedFromBookingId ?? "").trim();
  if (!sourceBookingId) {
    return {
      attempted: false,
      skipped: false,
      bookingId,
      sourceBookingId: null,
      persistedValue: null,
    };
  }
  const resolvedBusinessId = businessId ?? (await getCurrentTenant()).id;

  const { data, error } = await supabase
    .from("bookings")
    .update({ reordered_from_booking_id: sourceBookingId })
    .eq("id", bookingId)
    .eq("business_id", resolvedBusinessId)
    .select("id, reordered_from_booking_id")
    .maybeSingle();

  if (!error) {
    return {
      attempted: true,
      skipped: false,
      bookingId,
      sourceBookingId,
      persistedValue: data?.reordered_from_booking_id ?? null,
    };
  }
  if (isBookingSchemaError(error)) {
    console.warn("reorder reference column unavailable on bookings; skipping reordered_from_booking_id write");
    return {
      attempted: true,
      skipped: true,
      bookingId,
      sourceBookingId,
      persistedValue: null,
    };
  }

  throw new Error(error.message);
}
