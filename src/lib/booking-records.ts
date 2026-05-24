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
  customerState?: string | null;
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

type BookingPaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";

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
    dumpster_size?: string | null;
    dumpster_product_id?: string | null;
    notes?: string | null;
    payment_status?: BookingPaymentStatus;
    paid_at?: string | null;
    payment_provider?: string | null;
    payment_provider_payment_id?: string | null;
  };
  identity: BookingIdentityInput;
  placement?: PlacementInsertFields;
  pricing?: {
    base_rental_price_cents?: number | null;
    included_rental_days?: number | null;
    rental_duration_days?: number | null;
    extra_days?: number | null;
    daily_overage_price_cents?: number | null;
    extra_days_charge_cents?: number | null;
    subtotal_cents?: number | null;
    taxable_subtotal_cents?: number | null;
    tax_cents?: number | null;
    max_rental_days_snapshot?: number | null;
    allow_extended_rental_at_booking_snapshot?: boolean | null;
  };
};

export async function createBookingRecord({
  supabase,
  booking,
  identity,
  placement,
  pricing,
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
      state: identity.customerState,
      zip: identity.customerZip,
      deliveryNotes: identity.notes,
    },
    supabase,
  );

  const legacyBaseInsertRow = {
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
    customer_state: identity.customerState?.trim().toUpperCase() || null,
    customer_zip: identity.customerZip?.trim() || null,
    booking_contact_name: identity.customerName?.trim() || null,
    booking_contact_email: identity.customerEmail?.trim() || null,
    booking_contact_phone: normalizedPhone,
  };

  const baseInsertRow = {
    ...legacyBaseInsertRow,
    dumpster_size: booking.dumpster_size?.trim() || null,
    dumpster_product_id: booking.dumpster_product_id?.trim() || null,
    base_rental_price_cents: pricing?.base_rental_price_cents ?? null,
    included_rental_days: pricing?.included_rental_days ?? null,
    rental_duration_days: pricing?.rental_duration_days ?? null,
    extra_days: pricing?.extra_days ?? null,
    daily_overage_price_cents: pricing?.daily_overage_price_cents ?? null,
    extra_days_charge_cents: pricing?.extra_days_charge_cents ?? null,
    subtotal_cents: pricing?.subtotal_cents ?? null,
    taxable_subtotal_cents: pricing?.taxable_subtotal_cents ?? null,
    tax_cents: pricing?.tax_cents ?? null,
    max_rental_days_snapshot: pricing?.max_rental_days_snapshot ?? null,
    allow_extended_rental_at_booking_snapshot:
      pricing?.allow_extended_rental_at_booking_snapshot ?? null,
    payment_status: booking.payment_status ?? "unpaid",
    paid_at: booking.paid_at ?? null,
    payment_provider: booking.payment_provider ?? null,
    payment_provider_payment_id: booking.payment_provider_payment_id ?? null,
  };

  const insertWithPlacementRow = placement ? { ...baseInsertRow, ...placement } : baseInsertRow;

  let placementPersistenceSkipped = false;
  let pricingPersistenceSkipped = false;
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

  if (insertResult.error && isBookingSchemaError(insertResult.error)) {
    pricingPersistenceSkipped = true;
    insertResult = await supabase
      .from("bookings")
      .insert(legacyBaseInsertRow)
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
    pricingPersistenceSkipped,
  };
}
