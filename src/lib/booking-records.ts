import type { SupabaseClient } from "@supabase/supabase-js";
import { isBookingSchemaError } from "@/lib/booking-schema";
import { recordEntityHistory } from "@/lib/entity-history";
import { isValidEmail } from "@/lib/identity";
import { findOrCreateCustomerRecord, normalizePhone } from "@/lib/customers";

type BookingIdentityInput = {
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerStreet?: string | null;
  customerCity?: string | null;
  customerZip?: string | null;
  notes?: string | null;
};

type PlacementInsertFields = {
  placement_preference?: string | null;
  placement_details?: string | null;
  access_issues?: string[] | null;
  gate_instructions?: string | null;
  delivery_presence?: string | null;
  alternate_contact_name?: string | null;
  alternate_contact_phone?: string | null;
  placement_photo_url?: string | null;
  special_delivery_instructions?: string | null;
};

type CreateBookingRecordInput = {
  supabase: SupabaseClient;
  booking: {
    delivery_date?: string | null;
    pickup_mode?: string | null;
    pickup_date?: string | null;
    status: string;
    total_price_cents?: number | null;
    service_county?: string | null;
    service_town?: string | null;
    notes?: string | null;
  };
  identity: BookingIdentityInput;
  placement?: PlacementInsertFields;
};

export async function createBookingRecord({
  supabase,
  booking,
  identity,
  placement,
}: CreateBookingRecordInput) {
  if (identity.customerEmail && !isValidEmail(identity.customerEmail)) {
    throw new Error("Please enter a valid email address before booking.");
  }

  const normalizedPhone = normalizePhone(identity.customerPhone);
  const customerId = await findOrCreateCustomerRecord(
    {
      fullName: identity.customerName,
      email: identity.customerEmail,
      phone: normalizedPhone,
      street: identity.customerStreet,
      city: identity.customerCity,
      zip: identity.customerZip,
      deliveryNotes: identity.notes,
    },
    supabase,
  );

  const baseInsertRow = {
    delivery_date: booking.delivery_date ?? null,
    pickup_mode: booking.pickup_mode ?? null,
    pickup_date: booking.pickup_date ?? null,
    status: booking.status,
    total_price_cents: booking.total_price_cents ?? null,
    service_county: booking.service_county ?? null,
    service_town: booking.service_town ?? null,
    notes: booking.notes ?? null,
    customer_id: customerId,
    customer_name: identity.customerName?.trim() || null,
    customer_email: identity.customerEmail?.trim() || null,
    customer_phone: normalizedPhone,
    customer_street: identity.customerStreet?.trim() || null,
    customer_city: identity.customerCity?.trim() || null,
    customer_zip: identity.customerZip?.trim() || null,
    booking_contact_name: identity.customerName?.trim() || null,
    booking_contact_email: identity.customerEmail?.trim() || null,
    booking_contact_phone: normalizedPhone,
  };

  const insertWithPlacementRow = placement ? { ...baseInsertRow, ...placement } : baseInsertRow;

  let placementPersistenceSkipped = false;
  let insertResult = await supabase
    .from("bookings")
    .insert(insertWithPlacementRow)
    .select("id, booking_ref, customer_id")
    .single();

  if (insertResult.error && isBookingSchemaError(insertResult.error)) {
    placementPersistenceSkipped = true;
    insertResult = await supabase
      .from("bookings")
      .insert(baseInsertRow)
      .select("id, booking_ref, customer_id")
      .single();
  }

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }

  await recordEntityHistory(supabase, [
    {
      entityType: "booking",
      entityId: insertResult.data.id,
      fieldName: "booking_created",
      newValue: insertResult.data.booking_ref,
      changedByType: "system",
      changeReason: "Booking created",
    },
  ]);

  return {
    bookingId: insertResult.data.id as string,
    bookingRef: (insertResult.data.booking_ref as string | null) ?? null,
    customerId: (insertResult.data.customer_id as string | null) ?? null,
    placementPersistenceSkipped,
  };
}
