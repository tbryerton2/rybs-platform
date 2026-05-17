"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssignableDumpstersForBooking } from "@/lib/admin/dumpster-assignment";
import { bookingPlacementSchemaMessage, isBookingSchemaError } from "@/lib/booking-schema";
import { diffEntityFields, recordEntityHistory } from "@/lib/entity-history";
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
  const id = asString(formData.get("id"));
  const notes = emptyToNull(asString(formData.get("notes")));

  if (!id) throw new Error("Missing booking id");

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ notes })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");

  redirect(`/admin/bookings/${id}?saved=notes#notes`);
}

export async function updateBookingStatusAction(formData: FormData) {
  const id = asString(formData.get("id"));
  const status = asString(formData.get("status")) as BookingStatus;

  if (!id) throw new Error("Missing booking id");
  if (!status) throw new Error("Missing status");

  const current = await supabaseAdmin
    .from("bookings")
    .select("status")
    .eq("id", id)
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
    .eq("id", id);

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
  const id = asString(formData.get("id"));
  const delivery_date = emptyToNull(asString(formData.get("delivery_date")));

  if (!id) throw new Error("Missing booking id");

  const current = await supabaseAdmin
    .from("bookings")
    .select("delivery_date")
    .eq("id", id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ delivery_date })
    .eq("id", id);

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
  const id = asString(formData.get("id"));
  const pickup_mode = asString(formData.get("pickup_mode"));
  const pickup_date = emptyToNull(asString(formData.get("pickup_date")));

  if (!id) throw new Error("Missing booking id");
  if (!pickup_mode) throw new Error("Missing pickup mode");

  const current = await supabaseAdmin
    .from("bookings")
    .select("pickup_mode, pickup_date")
    .eq("id", id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const updates: Record<string, unknown> = {
    pickup_mode,
    pickup_date: pickup_mode === "request" ? null : pickup_date,
  };

  const { error } = await supabaseAdmin
    .from("bookings")
    .update(updates)
    .eq("id", id);

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
    .eq("id", id);

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
    .eq("id", id);

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
  const id = asString(formData.get("id"));
  const dumpsterId = emptyToNull(asString(formData.get("dumpster_id")));

  if (!id) throw new Error("Missing booking id");

  const current = await supabaseAdmin
    .from("bookings")
    .select("dumpster_id, dumpster_size, delivery_date, pickup_date, included_rental_days")
    .eq("id", id)
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
    .eq("id", id);

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
  const id = asString(formData.get("id"));
  if (!id) throw new Error("Missing booking id");

  const current = await supabaseAdmin
    .from("bookings")
    .select("status")
    .eq("id", id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "delivered",
    })
    .eq("id", id);

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
  const id = asString(formData.get("id"));
  if (!id) throw new Error("Missing booking id");

  const current = await supabaseAdmin
    .from("bookings")
    .select("status")
    .eq("id", id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "picked_up",
    })
    .eq("id", id);

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
  const id = asString(formData.get("id"));
  if (!id) throw new Error("Missing booking id");

  const current = await supabaseAdmin
    .from("bookings")
    .select("status")
    .eq("id", id)
    .single();

  if (current.error) throw new Error(current.error.message);

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id);

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
