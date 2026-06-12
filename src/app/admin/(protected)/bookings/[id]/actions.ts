"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminOwner } from "@/lib/admin/auth";
import { getAssignableDumpstersForBooking } from "@/lib/admin/dumpster-assignment";
import { bookingPlacementSchemaMessage, isBookingSchemaError } from "@/lib/booking-schema";
import { diffEntityFields, recordEntityHistory } from "@/lib/entity-history";
import {
  chargePendingBookingChargeWithSavedCard,
  PostBookingChargePaymentServiceError,
} from "@/lib/payments/post-booking-charge-payment-service";
import {
  sanitizePlacementDetails,
  validatePlacementDetails,
} from "@/lib/placement";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type BookingStatus =
  | "confirmed"
  | "scheduled"
  | "delivered"
  | "picked_up"
  | "cancelled";

type BookingChargeType =
  | "weight_overage"
  | "damage"
  | "extra_day"
  | "trip_fee"
  | "prohibited_material"
  | "manual_adjustment";

const BOOKING_CHARGE_TYPES = new Set<BookingChargeType>([
  "weight_overage",
  "damage",
  "extra_day",
  "trip_fee",
  "prohibited_material",
  "manual_adjustment",
]);

type OperationalFieldName =
  | "status"
  | "delivery_date"
  | "pickup_mode"
  | "pickup_date"
  | "placement_preference"
  | "placement_details"
  | "access_issues"
  | "gate_instructions"
  | "delivery_presence"
  | "alternate_contact_name"
  | "alternate_contact_phone"
  | "placement_photo_url"
  | "special_delivery_instructions";

type OperationalBookingData = Record<string, unknown> & Partial<Record<OperationalFieldName, unknown>>;

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redirectWithPlacementError(id: string, error: string) {
  redirect(`/admin/bookings/${id}?placementError=${encodeURIComponent(error)}#placement-access`);
}

function redirectWithOperationalControlsError(id: string, error: string) {
  redirect(`/admin/bookings/${id}?placementError=${encodeURIComponent(error)}#booking-operational-controls`);
}

function redirectWithAssignmentError(id: string, error: string): never {
  redirect(`/admin/bookings/${id}?assignmentError=${encodeURIComponent(error)}#assigned-dumpster`);
}

function redirectWithChargeError(id: string, error: string): never {
  redirect(`/admin/bookings/${id}?chargeError=${encodeURIComponent(error)}#charges-adjustments`);
}

function getSavedCardChargeErrorMessage(error: unknown) {
  if (!(error instanceof PostBookingChargePaymentServiceError)) {
    return error instanceof Error ? error.message : "Unable to charge the saved card.";
  }

  switch (error.code) {
    case "CARD_ON_FILE_CONSENT_MISSING":
      return "Card-on-file authorization was not found for this booking.";
    case "SAVED_CARD_MISSING":
      return "No active saved card is available for this customer.";
    case "SAVED_CARD_INVALID":
      return "The saved card record is missing provider references.";
    case "CHARGE_NOT_PENDING":
      return "Only charges marked ready to charge can be charged.";
    case "PAYMENT_ALREADY_PENDING":
      return "A saved-card charge attempt is already in progress for this charge.";
    case "PAYMENT_ALREADY_EXISTS":
      return "A payment attempt already exists for this charge. Refresh the page and review the charge status.";
    case "PROVIDER_CHARGE_FAILED":
      return error.result?.failureMessage || "Square declined or failed the saved-card charge.";
    case "BOOKKEEPING_FAILED_AFTER_PROVIDER_SUCCESS":
      return "Square reported a successful payment, but the booking charge could not be marked paid. Review payment records before retrying.";
    default:
      return error.message;
  }
}

function normalizeBookingChargeType(value: string): BookingChargeType | null {
  return BOOKING_CHARGE_TYPES.has(value as BookingChargeType) ? (value as BookingChargeType) : null;
}

function parseAmountCents(rawDollars: string, rawCents: string) {
  const cents = rawCents.trim();
  if (cents) {
    if (!/^\d+$/.test(cents)) return null;
    const amountCents = Number(cents);
    return Number.isSafeInteger(amountCents) ? amountCents : null;
  }

  const normalized = rawDollars.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const [dollarsPart, centsPart = ""] = normalized.split(".");
  const dollars = Number(dollarsPart);
  if (!Number.isSafeInteger(dollars)) return null;

  return dollars * 100 + Number(centsPart.padEnd(2, "0"));
}

function normalizeOperationalFieldValue(fieldName: OperationalFieldName, value: unknown) {
  if (fieldName === "access_issues") {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  if (value == null) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return value;
  return value;
}

function operationalFieldChanged(fieldName: OperationalFieldName, currentValue: unknown, nextValue: unknown) {
  return (
    JSON.stringify(normalizeOperationalFieldValue(fieldName, currentValue)) !==
    JSON.stringify(normalizeOperationalFieldValue(fieldName, nextValue))
  );
}

export async function updateNotesAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const id = asString(formData.get("id"));
  const notes = emptyToNull(asString(formData.get("notes")));

  if (!id) throw new Error("Missing booking id");

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ notes })
    .eq("id", id)
    .eq("business_id", adminSession.business.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${id}?saved=notes#notes`);
}

export async function createDraftBookingChargeAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const bookingId = asString(formData.get("bookingId"));
  const chargeType = normalizeBookingChargeType(asString(formData.get("chargeType")));
  const amountCents = parseAmountCents(
    asString(formData.get("amount")),
    asString(formData.get("amountCents")),
  );
  const description = emptyToNull(asString(formData.get("description")));
  const evidenceNotes = emptyToNull(asString(formData.get("evidenceNotes")));

  if (!bookingId) throw new Error("Missing booking id");
  if (!chargeType) {
    redirectWithChargeError(bookingId, "Choose a valid charge type.");
  }
  if (!amountCents || amountCents <= 0) {
    redirectWithChargeError(bookingId, "Enter an amount greater than $0.00.");
  }
  if (!description) {
    redirectWithChargeError(bookingId, "Add a short description for this charge.");
  }

  const booking = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("id", bookingId)
    .eq("business_id", adminSession.business.id)
    .maybeSingle<{ id: string }>();

  if (booking.error) {
    redirectWithChargeError(bookingId, booking.error.message);
  }

  if (!booking.data) {
    redirectWithChargeError(bookingId, "Booking not found.");
  }

  const { error } = await supabaseAdmin.from("booking_charges").insert({
    business_id: adminSession.business.id,
    booking_id: bookingId,
    charge_type: chargeType,
    description,
    amount_cents: amountCents,
    currency: "USD",
    status: "draft",
    evidence_notes: evidenceNotes,
  });

  if (error) {
    redirectWithChargeError(bookingId, error.message);
  }

  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${bookingId}?saved=charge#charges-adjustments`);
}

export async function markBookingChargeReadyAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const bookingId = asString(formData.get("bookingId"));
  const chargeId = asString(formData.get("chargeId"));

  if (!bookingId) throw new Error("Missing booking id");
  if (!chargeId) {
    redirectWithChargeError(bookingId, "Missing charge id.");
  }

  const charge = await supabaseAdmin
    .from("booking_charges")
    .select("id, booking_id, business_id, status, amount_cents, description")
    .eq("id", chargeId)
    .eq("booking_id", bookingId)
    .eq("business_id", adminSession.business.id)
    .maybeSingle<{
      id: string;
      booking_id: string;
      business_id: string;
      status: string;
      amount_cents: number;
      description: string | null;
    }>();

  if (charge.error) {
    redirectWithChargeError(bookingId, charge.error.message);
  }

  if (!charge.data) {
    redirectWithChargeError(bookingId, "Draft charge not found for this booking.");
  }

  if (charge.data.status !== "draft") {
    redirectWithChargeError(bookingId, "Only draft charges can be marked ready to charge.");
  }

  if (!Number.isFinite(charge.data.amount_cents) || charge.data.amount_cents <= 0) {
    redirectWithChargeError(bookingId, "Charge amount must be greater than $0.00 before it can be marked ready.");
  }

  if (!charge.data.description?.trim()) {
    redirectWithChargeError(bookingId, "Charge description is required before it can be marked ready.");
  }

  const { error } = await supabaseAdmin
    .from("booking_charges")
    .update({ status: "pending" })
    .eq("id", chargeId)
    .eq("booking_id", bookingId)
    .eq("business_id", adminSession.business.id)
    .eq("status", "draft");

  if (error) {
    redirectWithChargeError(bookingId, error.message);
  }

  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${bookingId}?saved=charge-ready#charges-adjustments`);
}

export async function approveAndChargeBookingChargeAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const bookingId = asString(formData.get("bookingId"));
  const bookingChargeId = asString(formData.get("bookingChargeId"));

  if (!bookingId) throw new Error("Missing booking id");
  if (!bookingChargeId) {
    redirectWithChargeError(bookingId, "Missing charge id.");
  }

  const charge = await supabaseAdmin
    .from("booking_charges")
    .select("id, booking_id, business_id, status, amount_cents, description")
    .eq("id", bookingChargeId)
    .eq("booking_id", bookingId)
    .eq("business_id", adminSession.business.id)
    .maybeSingle<{
      id: string;
      booking_id: string;
      business_id: string;
      status: string;
      amount_cents: number;
      description: string | null;
    }>();

  if (charge.error) {
    redirectWithChargeError(bookingId, charge.error.message);
  }

  if (!charge.data) {
    redirectWithChargeError(bookingId, "Charge was not found for this booking.");
  }

  if (charge.data.status !== "draft") {
    redirectWithChargeError(bookingId, "Only charges needing approval can be approved and charged.");
  }

  if (!Number.isFinite(charge.data.amount_cents) || charge.data.amount_cents <= 0) {
    redirectWithChargeError(bookingId, "Charge amount must be greater than $0.00 before it can be approved.");
  }

  if (!charge.data.description?.trim()) {
    redirectWithChargeError(bookingId, "Charge description is required before it can be approved.");
  }

  const statusUpdate = await supabaseAdmin
    .from("booking_charges")
    .update({ status: "pending" })
    .eq("id", bookingChargeId)
    .eq("booking_id", bookingId)
    .eq("business_id", adminSession.business.id)
    .eq("status", "draft");

  if (statusUpdate.error) {
    redirectWithChargeError(bookingId, statusUpdate.error.message);
  }

  try {
    await chargePendingBookingChargeWithSavedCard({
      businessId: adminSession.business.id,
      bookingId,
      bookingChargeId,
    });
  } catch (error) {
    const shouldRestoreNeedsApproval =
      error instanceof PostBookingChargePaymentServiceError &&
      [
        "CARD_ON_FILE_CONSENT_MISSING",
        "SAVED_CARD_MISSING",
        "SAVED_CARD_INVALID",
        "PAYMENT_ALREADY_EXISTS",
        "PAYMENT_ALREADY_PENDING",
      ].includes(error.code);

    if (shouldRestoreNeedsApproval) {
      const restore = await supabaseAdmin
        .from("booking_charges")
        .update({ status: "draft" })
        .eq("id", bookingChargeId)
        .eq("booking_id", bookingId)
        .eq("business_id", adminSession.business.id)
        .eq("status", "pending");

      if (restore.error) {
        console.error("[admin-booking-charge] failed to restore charge approval status", restore.error);
      }
    }

    redirectWithChargeError(bookingId, getSavedCardChargeErrorMessage(error));
  }

  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${bookingId}?saved=charge-paid#charges-adjustments`);
}

export async function chargeBookingChargeSavedCardAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const bookingId = asString(formData.get("bookingId"));
  const bookingChargeId = asString(formData.get("bookingChargeId"));

  if (!bookingId) throw new Error("Missing booking id");
  if (!bookingChargeId) {
    redirectWithChargeError(bookingId, "Missing charge id.");
  }

  try {
    await chargePendingBookingChargeWithSavedCard({
      businessId: adminSession.business.id,
      bookingId,
      bookingChargeId,
    });
  } catch (error) {
    redirectWithChargeError(bookingId, getSavedCardChargeErrorMessage(error));
  }

  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${bookingId}?saved=charge-paid#charges-adjustments`);
}

export async function updateBookingStatusAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const id = asString(formData.get("id"));
  const status = asString(formData.get("status")) as BookingStatus;

  if (!id) throw new Error("Missing booking id");
  if (!status) throw new Error("Missing status");

  const current = await supabaseAdmin
    .from("bookings")
    .select("status")
    .eq("id", id)
    .eq("business_id", adminSession.business.id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const updates: Record<string, unknown> = { status };

  // Sensible ops defaults
  if (status === "picked_up") {
    updates.pickup_mode = "schedule";
  }

  const { error } = await supabaseAdmin
    .from("bookings")
    .update(updates)
    .eq("id", id)
    .eq("business_id", adminSession.business.id);

  if (error) throw new Error(error.message);

  await recordEntityHistory(
    supabaseAdmin,
    diffEntityFields("booking", id, current.data, { status }, ["status"], {
      changedByType: "admin",
      changeReason: "Updated booking status",
    }),
  );

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${id}?saved=status#status`);
}

export async function updateDeliveryDateAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const id = asString(formData.get("id"));
  const delivery_date = emptyToNull(asString(formData.get("delivery_date")));

  if (!id) throw new Error("Missing booking id");

  const current = await supabaseAdmin
    .from("bookings")
    .select("delivery_date")
    .eq("id", id)
    .eq("business_id", adminSession.business.id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ delivery_date })
    .eq("id", id)
    .eq("business_id", adminSession.business.id);

  if (error) throw new Error(error.message);

  await recordEntityHistory(
    supabaseAdmin,
    diffEntityFields(
      "booking",
      id,
      current.data,
      { delivery_date },
      ["delivery_date"],
      { changedByType: "admin", changeReason: "Updated delivery date" },
    ),
  );

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${id}?saved=delivery-date#delivery`);
}

export async function updatePickupDetailsAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const id = asString(formData.get("id"));
  const pickup_mode = asString(formData.get("pickup_mode"));
  const pickup_date = emptyToNull(asString(formData.get("pickup_date")));

  if (!id) throw new Error("Missing booking id");
  if (!pickup_mode) throw new Error("Missing pickup mode");

  const current = await supabaseAdmin
    .from("bookings")
    .select("pickup_mode, pickup_date")
    .eq("id", id)
    .eq("business_id", adminSession.business.id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const updates: Record<string, unknown> = {
    pickup_mode,
    pickup_date: pickup_mode === "request" ? null : pickup_date,
  };

  const { error } = await supabaseAdmin
    .from("bookings")
    .update(updates)
    .eq("id", id)
    .eq("business_id", adminSession.business.id);

  if (error) throw new Error(error.message);

  await recordEntityHistory(
    supabaseAdmin,
    diffEntityFields(
      "booking",
      id,
      current.data,
      { pickup_mode, pickup_date: pickup_mode === "request" ? null : pickup_date },
      ["pickup_mode", "pickup_date"],
      { changedByType: "admin", changeReason: "Updated pickup details" },
    ),
  );

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${id}?saved=pickup-details#pickup`);
}

export async function updatePlacementDetailsAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const id = asString(formData.get("id"));

  if (!id) throw new Error("Missing booking id");

  const placement = sanitizePlacementDetails({
    placementPreference: asString(formData.get("placement_preference")),
    placementDetails: asString(formData.get("placement_details")),
    accessIssues: formData.getAll("access_issues"),
    gateInstructions: asString(formData.get("gate_instructions")),
    deliveryPresence: asString(formData.get("delivery_presence")),
    alternateContactName: asString(formData.get("alternate_contact_name")),
    alternateContactPhone: asString(formData.get("alternate_contact_phone")),
    placementPhotoUrl: asString(formData.get("placement_photo_url")),
    specialDeliveryInstructions: asString(formData.get("special_delivery_instructions")),
  });

  const validationError = validatePlacementDetails(placement);
  if (validationError) {
    redirectWithPlacementError(id, validationError);
  }

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      placement_preference: placement.placementPreference,
      placement_details: placement.placementDetails,
      access_issues: placement.accessIssues,
      gate_instructions: placement.gateInstructions,
      delivery_presence: placement.deliveryPresence,
      alternate_contact_name: placement.alternateContactName,
      alternate_contact_phone: placement.alternateContactPhone,
      placement_photo_url: placement.placementPhotoUrl,
      special_delivery_instructions: placement.specialDeliveryInstructions,
    })
    .eq("id", id)
    .eq("business_id", adminSession.business.id);

  if (error) {
    if (isBookingSchemaError(error)) {
      redirectWithPlacementError(id, bookingPlacementSchemaMessage());
    }

    redirectWithPlacementError(id, error.message);
  }

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${id}?saved=placement#placement-access`);
}

export async function updateOperationalControlsAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const id = asString(formData.get("id"));
  const status = asString(formData.get("status")) as BookingStatus;
  const delivery_date = emptyToNull(asString(formData.get("delivery_date")));
  const pickup_date = emptyToNull(asString(formData.get("pickup_date")));
  const placementSchemaAvailable = asString(formData.get("placement_schema_available")) === "true";

  if (!id) throw new Error("Missing booking id");
  if (!status) throw new Error("Missing status");

  const placement = placementSchemaAvailable
    ? sanitizePlacementDetails({
        placementPreference: asString(formData.get("placement_preference")),
        placementDetails: asString(formData.get("placement_details")),
        accessIssues: formData.getAll("access_issues"),
        gateInstructions: asString(formData.get("gate_instructions")),
        deliveryPresence: asString(formData.get("delivery_presence")),
        alternateContactName: asString(formData.get("alternate_contact_name")),
        alternateContactPhone: asString(formData.get("alternate_contact_phone")),
        placementPhotoUrl: asString(formData.get("placement_photo_url")),
        specialDeliveryInstructions: asString(formData.get("special_delivery_instructions")),
      })
    : null;

  if (placement) {
    const validationError = validatePlacementDetails(placement);
    if (validationError) {
      redirectWithOperationalControlsError(id, validationError);
    }
  }

  const current = await supabaseAdmin
    .from("bookings")
    .select(
      placementSchemaAvailable
        ? "status, delivery_date, pickup_mode, pickup_date, placement_preference, placement_details, access_issues, gate_instructions, delivery_presence, alternate_contact_name, alternate_contact_phone, placement_photo_url, special_delivery_instructions"
        : "status, delivery_date, pickup_mode, pickup_date",
    )
    .eq("id", id)
    .eq("business_id", adminSession.business.id)
    .single();

  if (current.error) throw new Error(current.error.message);
  if (!isRecord(current.data)) throw new Error("Booking not found");

  const currentData: OperationalBookingData = current.data;

  const pickup_mode = pickup_date ? "schedule" : "request";
  const updates: Partial<Record<OperationalFieldName, unknown>> = {
    status,
    delivery_date,
    pickup_mode,
    pickup_date: pickup_mode === "schedule" ? pickup_date : null,
  };

  if (placement) {
    updates.placement_preference = placement.placementPreference;
    updates.placement_details = placement.placementDetails;
    updates.access_issues = placement.accessIssues;
    updates.gate_instructions = placement.gateInstructions;
    updates.delivery_presence = placement.deliveryPresence;
    updates.alternate_contact_name = placement.alternateContactName;
    updates.alternate_contact_phone = placement.alternateContactPhone;
    updates.placement_photo_url = placement.placementPhotoUrl;
    updates.special_delivery_instructions = placement.specialDeliveryInstructions;
  }

  const fieldsToCheck: OperationalFieldName[] = placement
    ? [
        "status",
        "delivery_date",
        "pickup_mode",
        "pickup_date",
        "placement_preference",
        "placement_details",
        "access_issues",
        "gate_instructions",
        "delivery_presence",
        "alternate_contact_name",
        "alternate_contact_phone",
        "placement_photo_url",
        "special_delivery_instructions",
      ]
    : ["status", "delivery_date", "pickup_mode", "pickup_date"];

  const changedUpdates = Object.fromEntries(
    fieldsToCheck
      .filter((fieldName) => operationalFieldChanged(fieldName, currentData[fieldName], updates[fieldName]))
      .map((fieldName) => [fieldName, updates[fieldName]]),
  );

  if (Object.keys(changedUpdates).length === 0) {
    revalidatePath(`/admin/bookings/${id}`);
    revalidatePath("/admin/bookings");
    revalidatePath("/admin/schedule");
    revalidatePath("/admin");
    redirect(`/admin/bookings/${id}#booking-operational-controls`);
  }

  const { error } = await supabaseAdmin
    .from("bookings")
    .update(changedUpdates)
    .eq("id", id)
    .eq("business_id", adminSession.business.id);

  if (error) {
    if (isBookingSchemaError(error)) {
      redirectWithOperationalControlsError(id, bookingPlacementSchemaMessage());
    }

    redirectWithOperationalControlsError(id, error.message);
  }

  await recordEntityHistory(
    supabaseAdmin,
    diffEntityFields(
      "booking",
      id,
      currentData,
      changedUpdates,
      fieldsToCheck.filter((fieldName) => fieldName in changedUpdates),
      { changedByType: "admin", changeReason: "Updated operational controls" },
    ),
  );

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${id}?saved=operational-controls#booking-operational-controls`);
}

export async function updateAssignedDumpsterAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const id = asString(formData.get("id"));
  const dumpsterId = emptyToNull(asString(formData.get("dumpster_id")));

  if (!id) throw new Error("Missing booking id");

  const current = await supabaseAdmin
    .from("bookings")
    .select("dumpster_id, dumpster_size, delivery_date, pickup_date, included_rental_days")
    .eq("id", id)
    .eq("business_id", adminSession.business.id)
    .single();

  if (current.error) {
    redirectWithAssignmentError(id, current.error.message);
  }

  if (!current.data) {
    redirectWithAssignmentError(id, "Booking not found");
  }

  const currentAssignment = current.data.dumpster_id ?? null;

  if (currentAssignment === dumpsterId) {
    revalidatePath(`/admin/bookings/${id}`);
    redirect(`/admin/bookings/${id}#assigned-dumpster`);
  }

  if (dumpsterId) {
    const assignmentOptions = await getAssignableDumpstersForBooking({
      bookingId: id,
      dumpsterSize: current.data.dumpster_size,
      deliveryDate: current.data.delivery_date,
      pickupDate: current.data.pickup_date,
      includedRentalDays: current.data.included_rental_days,
      currentDumpsterId: currentAssignment,
      businessId: adminSession.business.id,
    });

    const canAssign = assignmentOptions.compatibleDumpsters.some((option) => option.id === dumpsterId);
    if (!canAssign) {
      redirectWithAssignmentError(
        id,
        "That dumpster is not compatible with this booking's size, status, or delivery window.",
      );
    }
  }

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ dumpster_id: dumpsterId })
    .eq("id", id)
    .eq("business_id", adminSession.business.id);

  if (error) {
    redirectWithAssignmentError(id, error.message);
  }

  await recordEntityHistory(
    supabaseAdmin,
    diffEntityFields(
      "booking",
      id,
      current.data,
      { dumpster_id: dumpsterId },
      ["dumpster_id"],
      {
        changedByType: "admin",
        changeReason: dumpsterId ? "Planned dumpster" : "Cleared planned dumpster",
      },
    ),
  );

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${id}?saved=assigned-dumpster#assigned-dumpster`);
}


export async function quickMarkDeliveredAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const id = asString(formData.get("id"));
  if (!id) throw new Error("Missing booking id");

  const current = await supabaseAdmin
    .from("bookings")
    .select("status")
    .eq("id", id)
    .eq("business_id", adminSession.business.id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "delivered",
    })
    .eq("id", id)
    .eq("business_id", adminSession.business.id);

  if (error) throw new Error(error.message);

  await recordEntityHistory(supabaseAdmin, [
    {
      entityType: "booking",
      entityId: id,
      fieldName: "status",
      oldValue: current.data.status,
      newValue: "delivered",
      changedByType: "admin",
      changeReason: "Quick mark delivered",
    },
  ]);

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");
}

export async function quickMarkPickedUpAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const id = asString(formData.get("id"));
  if (!id) throw new Error("Missing booking id");

  const current = await supabaseAdmin
    .from("bookings")
    .select("status")
    .eq("id", id)
    .eq("business_id", adminSession.business.id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "picked_up",
    })
    .eq("id", id)
    .eq("business_id", adminSession.business.id);

  if (error) throw new Error(error.message);

  await recordEntityHistory(supabaseAdmin, [
    {
      entityType: "booking",
      entityId: id,
      fieldName: "status",
      oldValue: current.data.status,
      newValue: "picked_up",
      changedByType: "admin",
      changeReason: "Quick mark picked up",
    },
  ]);

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");
}

export async function quickCancelBookingAction(formData: FormData) {
  const adminSession = await requireAdminOwner();

  const id = asString(formData.get("id"));
  if (!id) throw new Error("Missing booking id");

  const current = await supabaseAdmin
    .from("bookings")
    .select("status")
    .eq("id", id)
    .eq("business_id", adminSession.business.id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("business_id", adminSession.business.id);

  if (error) throw new Error(error.message);

  await recordEntityHistory(supabaseAdmin, [
    {
      entityType: "booking",
      entityId: id,
      fieldName: "status",
      oldValue: current.data.status,
      newValue: "cancelled",
      changedByType: "admin",
      changeReason: "Quick cancel booking",
    },
  ]);

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");
}
