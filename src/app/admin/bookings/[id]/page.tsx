/* eslint-disable @next/next/no-img-element */
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAssignableDumpstersForBooking,
  type AssignableDumpsterOption,
} from "@/lib/admin/dumpster-assignment";
import { EMPTY_BOOKING_PLACEMENT_FIELDS, isBookingSchemaError } from "@/lib/booking-schema";
import { getCustomerFacingBookingLabel } from "@/lib/identity";
import { evaluateBookingAttention } from "@/lib/admin/booking-attention";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatUsdFromCents } from "@/lib/money";
import {
  buildPickupPlanningModel,
  getAvailabilityRiskClasses,
} from "@/lib/pickup-planning";
import {
  ACCESS_ISSUES,
  DELIVERY_PRESENCE_OPTIONS,
  PLACEMENT_PREFERENCES,
  getAccessIssueLabel,
  getDeliveryPresenceLabel,
  getPlacementPreferenceLabel,
  hasCollectedPlacementDetails,
  sanitizePlacementDetails,
} from "@/lib/placement";
import {
  quickCancelBookingAction,
  quickMarkDeliveredAction,
  quickMarkPickedUpAction,
  updateAssignedDumpsterAction,
  updateNotesAction,
  updateOperationalControlsAction,
} from "./actions";
import { AdminToastTrigger } from "@/app/admin/_components/admin/admin-toast-trigger";
import { AdminPage } from "@/app/admin/_components/admin/admin-page";

import {
  PhoneIcon,
  EnvelopeIcon,
  CheckIcon,
} from "@heroicons/react/24/solid";

import {
  ArrowUturnLeftIcon,
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  FlagIcon,
  PencilSquareIcon,
  QuestionMarkCircleIcon,
  TruckIcon,
  UserIcon,
} from "@heroicons/react/24/outline";


type BookingStatus =
  | "confirmed"
  | "scheduled"
  | "delivered"
  | "picked_up"
  | "cancelled";

type PickupMode = "request" | "schedule" | null;

type Booking = {
  id: string;
  booking_ref: string | null;
  customer_id: string | null;
  reordered_from_booking_id: string | null;
  created_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string | null;
  pickup_mode: PickupMode;
  pickup_date: string | null;
  status: BookingStatus;
  total_price_cents: number | null;
  dumpster_id: string | null;
  dumpster_size: string | null;
  dumpster_product_id: string | null;
  base_rental_price_cents: number | null;
  included_rental_days: number | null;
  rental_duration_days: number | null;
  extra_days: number | null;
  daily_overage_price_cents: number | null;
  extra_days_charge_cents: number | null;
  subtotal_cents: number | null;
  taxable_subtotal_cents: number | null;
  tax_cents: number | null;
  max_rental_days_snapshot: number | null;
  allow_extended_rental_at_booking_snapshot: boolean | null;
  service_county: string | null;
  service_town: string | null;
  notes: string | null;
  placement_preference: string | null;
  placement_details: string | null;
  access_issues: string[] | null;
  gate_instructions: string | null;
  delivery_presence: string | null;
  alternate_contact_name: string | null;
  alternate_contact_phone: string | null;
  placement_photo_url: string | null;
  special_delivery_instructions: string | null;
};

type BookingRelationshipSummary = {
  id: string;
  booking_ref: string | null;
  customer_name: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string | null;
  created_at: string | null;
};

type BookingHistoryEntry = {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_type: string | null;
  change_reason: string | null;
  created_at: string;
};

type LinkedCustomer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  portal_status: string | null;
};

type CustomerHistoryEntry = {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_type: string | null;
  change_reason: string | null;
  created_at: string;
};

function getLatestStatusTimestamp(
  history: BookingHistoryEntry[],
  status: Extract<BookingStatus, "delivered" | "picked_up">,
) {
  return (
    history.find((entry) => entry.field_name === "status" && entry.new_value === status)?.created_at ??
    null
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isFilled(value: string | null | undefined) {
  return !!value;
}

function toTelHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `tel:${digits}`;
}

function getDaysOnSite(deliveredAt: string | null, deliveryDate: string | null) {
  const source = deliveredAt ?? deliveryDate;
  if (!source) return null;

  const start = new Date(source);
  if (Number.isNaN(start.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

function daysOnSiteClasses(days: number | null) {
  if (days == null) return "text-slate-900";
  if (days >= 7) return "text-rose-600 font-semibold";
  if (days >= 5) return "text-amber-600 font-semibold";
  return "text-slate-900";
}

function statusClasses(status: BookingStatus) {
  switch (status) {
    case "confirmed":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "scheduled":
      return "bg-indigo-50 text-indigo-700 ring-indigo-200";
    case "delivered":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "picked_up":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "cancelled":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200";
  }
}

function formatHistoryFieldLabel(fieldName: string) {
  if (fieldName === "access_issues") return "Access issues";
  if (fieldName === "delivery_presence") return "Delivery presence";
  if (fieldName === "placement_preference") return "Placement preference";
  if (fieldName === "portal_status") return "Portal status";
  return fieldName.replaceAll("_", " ");
}

function tryParseHistoryValue(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    trimmed === "true" ||
    trimmed === "false" ||
    trimmed === "null"
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }

  return raw;
}

function formatHistoryPrimitive(fieldName: string, value: unknown): string {
  if (value == null || value === "") return "—";

  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);

  const stringValue = String(value).trim();
  if (!stringValue) return "—";

  switch (fieldName) {
    case "access_issues":
      return getAccessIssueLabel(stringValue);
    case "delivery_presence":
      return getDeliveryPresenceLabel(stringValue);
    case "placement_preference":
      return getPlacementPreferenceLabel(stringValue);
    case "portal_status":
      return stringValue.replaceAll("_", " ");
    case "status":
      return stringValue.replaceAll("_", " ");
    case "delivery_date":
    case "pickup_date":
      return /^\d{4}-\d{2}-\d{2}$/.test(stringValue) ? formatDate(stringValue) : stringValue;
    default:
      return stringValue;
  }
}

function formatHistoryValue(fieldName: string, rawValue: string | null) {
  if (!rawValue) return "—";

  const parsed = tryParseHistoryValue(rawValue);

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return "—";
    return parsed.map((item) => formatHistoryPrimitive(fieldName, item)).join(", ");
  }

  if (parsed && typeof parsed === "object") {
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.length === 0) return "—";
    return entries
      .map(([key, value]) => `${formatHistoryFieldLabel(key)}: ${formatHistoryPrimitive(key, value)}`)
      .join(", ");
  }

  return formatHistoryPrimitive(fieldName, parsed);
}

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2">
          {icon ? (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
              {icon}
            </span>
          ) : (
            <span />
          )}

          <h2 className="text-base font-semibold text-slate-900">{title}</h2>

          {description ? (
            <p className="col-start-2 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-900">{value || "—"}</div>
    </div>
  );
}

function formatAssignedDumpsterLabel(option: AssignableDumpsterOption) {
  const details = [
    option.equipmentId,
    option.yardLocation,
    option.isCurrentlyAssigned && !option.isCompatible ? "currently planned" : null,
  ].filter(Boolean);

  return `${option.displayName}${details.length ? ` • ${details.join(" • ")}` : ""}`;
}

function AuditHistoryCard({
  title,
  beforeValue,
  afterValue,
  changedAt,
}: {
  title: string;
  beforeValue: string;
  afterValue: string;
  changedAt: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-3 space-y-1 text-sm text-slate-600">
        <div className="min-w-0">
          <span className="font-medium text-slate-500">Change date:</span>{" "}
          <span className="whitespace-normal break-words">{formatDateTime(changedAt)}</span>
        </div>
        <div>
          <span className="font-medium text-slate-500">User:</span> admin
        </div>
      </div>
      <div className="my-3 border-t border-slate-200" />
      <div className="space-y-2 text-sm text-slate-600">
        <div className="min-w-0">
          <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Before:</span>
          <span className="whitespace-normal break-words">{beforeValue}</span>
        </div>
        <div className="min-w-0">
          <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-slate-400">After:</span>
          <span className="whitespace-normal break-words">{afterValue}</span>
        </div>
      </div>
    </div>
  );
}

function getSavedMessage(saved: string | undefined) {
  switch (saved) {
    case "notes":
      return "Admin notes saved.";
    case "status":
      return "Booking status saved.";
    case "delivery-date":
      return "Delivery date saved.";
    case "pickup-details":
      return "Pickup details saved.";
    case "placement":
      return "Placement details saved.";
    case "operational-controls":
      return "Operational controls saved.";
    case "assigned-dumpster":
      return "Planned dumpster saved.";
    default:
      return null;
  }
}

export default async function AdminBookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; placementError?: string; assignmentError?: string }>;
}) {
  const { id } = await params;
  const { saved, placementError, assignmentError } = await searchParams;

    const bookingSelect = `
      id,
      booking_ref,
      customer_id,
      reordered_from_booking_id,
      created_at,
      customer_name,
      customer_email,
      customer_phone,
      customer_street,
      customer_city,
      customer_zip,
      delivery_date,
      pickup_mode,
      pickup_date,
      status,
      total_price_cents,
      dumpster_id,
      dumpster_size,
      dumpster_product_id,
      base_rental_price_cents,
      included_rental_days,
      rental_duration_days,
      extra_days,
      daily_overage_price_cents,
      extra_days_charge_cents,
      subtotal_cents,
      taxable_subtotal_cents,
      tax_cents,
      service_county,
      service_town,
      notes,
      placement_preference,
      placement_details,
      access_issues,
      gate_instructions,
      delivery_presence,
      alternate_contact_name,
      alternate_contact_phone,
      placement_photo_url,
      special_delivery_instructions
    `;

    const baseBookingSelect = `
      id,
      booking_ref,
      customer_id,
      reordered_from_booking_id,
      created_at,
      customer_name,
      customer_email,
      customer_phone,
      customer_street,
      customer_city,
      customer_zip,
      delivery_date,
      pickup_mode,
      pickup_date,
      status,
      total_price_cents,
      dumpster_id,
      dumpster_size,
      dumpster_product_id,
      base_rental_price_cents,
      included_rental_days,
      rental_duration_days,
      extra_days,
      daily_overage_price_cents,
      extra_days_charge_cents,
      subtotal_cents,
      taxable_subtotal_cents,
      tax_cents,
      service_county,
      service_town,
      notes
    `;

    const legacyBookingSelect = `
      id,
      booking_ref,
      created_at,
      customer_name,
      customer_email,
      customer_phone,
      customer_street,
      customer_city,
      customer_zip,
      delivery_date,
      pickup_mode,
      pickup_date,
      status,
      total_price_cents,
      base_rental_price_cents,
      included_rental_days,
      rental_duration_days,
      extra_days,
      daily_overage_price_cents,
      extra_days_charge_cents,
      subtotal_cents,
      taxable_subtotal_cents,
      tax_cents,
      max_rental_days_snapshot,
      allow_extended_rental_at_booking_snapshot,
      service_county,
      service_town,
      notes
    `;

  let placementSchemaAvailable = true;

  let { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select(bookingSelect)
    .eq("id", id)
    .single<Booking>();

  if (error && isBookingSchemaError(error)) {
    placementSchemaAvailable = false;
    const fallback = await supabaseAdmin
      .from("bookings")
      .select(baseBookingSelect)
      .eq("id", id)
      .single<Omit<Booking, keyof typeof EMPTY_BOOKING_PLACEMENT_FIELDS>>();

    if (fallback.error && isBookingSchemaError(fallback.error)) {
      const legacyFallback = await supabaseAdmin
        .from("bookings")
        .select(legacyBookingSelect)
        .eq("id", id)
        .single<Omit<Booking, keyof typeof EMPTY_BOOKING_PLACEMENT_FIELDS | "customer_id" | "reordered_from_booking_id" | "booking_ref">>();

          booking = legacyFallback.data
        ? ({
            customer_id: null,
            reordered_from_booking_id: null,
            booking_ref: null,
            dumpster_id: null,
            dumpster_size: null,
            dumpster_product_id: null,
            ...legacyFallback.data,
            ...EMPTY_BOOKING_PLACEMENT_FIELDS,
          } as Booking)
        : null;
      error = legacyFallback.error;
    } else {
      booking = fallback.data
        ? ({
            ...fallback.data,
            ...EMPTY_BOOKING_PLACEMENT_FIELDS,
          } as Booking)
        : null;
      error = fallback.error;
    }
  }

  if (error) {
    throw new Error(error.message);
  }

  if (!booking) {
    notFound();
  }

  const [
    sourceBookingResult,
    priorCustomerBookingsResult,
    priorAddressBookingsResult,
    derivedFromThisBookingResult,
    historyResult,
    linkedCustomerResult,
    linkedCustomerHistoryResult,
  ] = await Promise.all([
    booking.reordered_from_booking_id
      ? supabaseAdmin
          .from("bookings")
          .select("id, booking_ref, customer_name, customer_street, customer_city, customer_zip, delivery_date, created_at")
          .eq("id", booking.reordered_from_booking_id)
          .maybeSingle<BookingRelationshipSummary>()
      : Promise.resolve({ data: null, error: null }),
    booking.customer_id
      ? supabaseAdmin
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("customer_id", booking.customer_id)
          .neq("id", booking.id)
      : Promise.resolve({ count: null, error: null }),
    booking.customer_street && booking.customer_city && booking.customer_zip
      ? supabaseAdmin
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("customer_street", booking.customer_street)
          .eq("customer_city", booking.customer_city)
          .eq("customer_zip", booking.customer_zip)
          .neq("id", booking.id)
      : Promise.resolve({ count: null, error: null }),
    supabaseAdmin
      .from("bookings")
      .select("id, booking_ref, customer_name, delivery_date, created_at", { count: "exact" })
      .eq("reordered_from_booking_id", booking.id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("entity_history")
      .select("id, field_name, old_value, new_value, changed_by_type, change_reason, created_at")
      .eq("entity_type", "booking")
      .eq("entity_id", booking.id)
      .order("created_at", { ascending: false })
      .limit(20),
    booking.customer_id
      ? supabaseAdmin
          .from("customers")
          .select("id, name, email, phone, portal_status")
          .eq("id", booking.customer_id)
          .maybeSingle<LinkedCustomer>()
      : Promise.resolve({ data: null, error: null }),
    booking.customer_id
      ? supabaseAdmin
          .from("entity_history")
          .select("id, field_name, old_value, new_value, changed_by_type, change_reason, created_at")
          .eq("entity_type", "customer")
          .eq("entity_id", booking.customer_id)
          .in("field_name", ["email", "name", "phone", "portal_status"])
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (sourceBookingResult.error && !isBookingSchemaError(sourceBookingResult.error)) {
    throw new Error(sourceBookingResult.error.message);
  }
  if (priorCustomerBookingsResult.error && !isBookingSchemaError(priorCustomerBookingsResult.error)) {
    throw new Error(priorCustomerBookingsResult.error.message);
  }
  if (priorAddressBookingsResult.error && !isBookingSchemaError(priorAddressBookingsResult.error)) {
    throw new Error(priorAddressBookingsResult.error.message);
  }
  if (derivedFromThisBookingResult.error && !isBookingSchemaError(derivedFromThisBookingResult.error)) {
    throw new Error(derivedFromThisBookingResult.error.message);
  }
  if (historyResult.error && !isBookingSchemaError(historyResult.error)) {
    throw new Error(historyResult.error.message);
  }
  if (linkedCustomerResult.error && !isBookingSchemaError(linkedCustomerResult.error)) {
    throw new Error(linkedCustomerResult.error.message);
  }
  if (linkedCustomerHistoryResult.error && !isBookingSchemaError(linkedCustomerHistoryResult.error)) {
    throw new Error(linkedCustomerHistoryResult.error.message);
  }

  const sourceBooking = isBookingSchemaError(sourceBookingResult.error)
    ? null
    : (sourceBookingResult.data as BookingRelationshipSummary | null);
  const priorCustomerBookingCount = isBookingSchemaError(priorCustomerBookingsResult.error)
    ? 0
    : Number(priorCustomerBookingsResult.count ?? 0);
  const derivedFromThisBookingCount = isBookingSchemaError(derivedFromThisBookingResult.error)
    ? 0
    : Number(derivedFromThisBookingResult.count ?? 0);
  const latestDerivedBooking = isBookingSchemaError(derivedFromThisBookingResult.error)
    ? null
    : ((derivedFromThisBookingResult.data ?? [])[0] as
        | Pick<BookingRelationshipSummary, "id" | "booking_ref" | "customer_name" | "delivery_date" | "created_at">
        | undefined
        | null);
  const bookingHistory = isBookingSchemaError(historyResult.error) ? [] : (historyResult.data ?? []);
  const linkedCustomer = isBookingSchemaError(linkedCustomerResult.error)
    ? null
    : ((linkedCustomerResult.data ?? null) as LinkedCustomer | null);
  const linkedCustomerHistory = isBookingSchemaError(linkedCustomerHistoryResult.error)
    ? []
    : ((linkedCustomerHistoryResult.data ?? []) as CustomerHistoryEntry[]);
  const deliveredAt = getLatestStatusTimestamp(bookingHistory, "delivered");
  const pickedUpAt = getLatestStatusTimestamp(bookingHistory, "picked_up");
  const accountEmailDiffers =
    !!linkedCustomer?.email &&
    !!booking.customer_email &&
    linkedCustomer.email.trim().toLowerCase() !== booking.customer_email.trim().toLowerCase();
  const accountNameDiffers =
    !!linkedCustomer?.name &&
    !!booking.customer_name &&
    linkedCustomer.name.trim() !== booking.customer_name.trim();
  const accountPhoneDiffers =
    !!linkedCustomer?.phone &&
    !!booking.customer_phone &&
    linkedCustomer.phone.trim() !== booking.customer_phone.trim();

  const futureDependencyDatesResult = await supabaseAdmin
    .from("bookings")
    .select("id, delivery_date")
    .in("status", ["confirmed", "scheduled"])
    .gte("delivery_date", todayISO())
    .neq("id", booking.id)
    .order("delivery_date", { ascending: true })
    .limit(50);

  const futureDependencyDates = (futureDependencyDatesResult.data ?? [])
    .map((row) => row.delivery_date)
    .filter((value): value is string => Boolean(value));

  const onSite = booking.status === "delivered";
  const deliveryPending =
    booking.status === "confirmed" || booking.status === "scheduled";

  const canMarkDelivered =
  booking.status === "confirmed" || booking.status === "scheduled";

  const canCancel =
    booking.status === "confirmed" ||
    booking.status === "scheduled" ||
    booking.status === "delivered";

  const canSchedulePickup =
    booking.status === "delivered" && booking.pickup_mode === "request";

  const canMarkPickedUp = booking.status === "delivered";

  const createdDone = isFilled(booking.created_at);
  const deliveredDone = isFilled(deliveredAt) || booking.status === "delivered" || booking.status === "picked_up";
  const pickedUpDone = isFilled(pickedUpAt) || booking.status === "picked_up";
  const pickupPlanning = buildPickupPlanningModel({
    deliveryDate: booking.delivery_date,
    pickupDate: booking.pickup_date,
    pickupMode: booking.pickup_mode,
    futureDeliveryDates: futureDependencyDates,
    defaultRentalDays: booking.included_rental_days ?? undefined,
  });
  const editablePickupDate =
    booking.pickup_mode === "schedule" && pickupPlanning.scheduledPickupDate
      ? pickupPlanning.scheduledPickupDate
      : "";
  const assignmentOptions = await getAssignableDumpstersForBooking({
    bookingId: booking.id,
    dumpsterSize: booking.dumpster_size,
    deliveryDate: booking.delivery_date,
    pickupDate: booking.pickup_date,
    includedRentalDays: booking.included_rental_days,
    currentDumpsterId: booking.dumpster_id,
  });
  const compatibleDumpsters = assignmentOptions.compatibleDumpsters;
  const currentAssignedDumpster = assignmentOptions.currentAssignedDumpster;
  const assignmentChoices = [
    ...(currentAssignedDumpster &&
    !compatibleDumpsters.some((option) => option.id === currentAssignedDumpster.id)
      ? [currentAssignedDumpster]
      : []),
    ...compatibleDumpsters,
  ];
  const daysOnSite =
    booking.status === "delivered"
      ? getDaysOnSite(deliveredAt, booking.delivery_date)
      : null;
  const placement = sanitizePlacementDetails({
    placementPreference: booking.placement_preference,
    placementDetails: booking.placement_details,
    accessIssues: booking.access_issues ?? [],
    gateInstructions: booking.gate_instructions,
    deliveryPresence: booking.delivery_presence,
    alternateContactName: booking.alternate_contact_name,
    alternateContactPhone: booking.alternate_contact_phone,
    placementPhotoUrl: booking.placement_photo_url,
    specialDeliveryInstructions: booking.special_delivery_instructions,
  });
  const hasPlacementData = placementSchemaAvailable && hasCollectedPlacementDetails(placement);
  const hasAccessIssues = placement.accessIssues.length > 0;
  const hasDeliveryPhoto = Boolean(placement.placementPhotoUrl);
  const hasSpecialInstructions = Boolean(placement.specialDeliveryInstructions?.trim());
  const savedMessage = getSavedMessage(saved);
  const currentOperationalState = onSite
    ? pickupPlanning.pickupStatus === "scheduled" && pickupPlanning.scheduledPickupDate
      ? `On site • pickup scheduled ${formatDate(pickupPlanning.scheduledPickupDate)}`
      : pickupPlanning.pickupStatus === "requested"
        ? "On site • pickup requested"
        : "On site • awaiting pickup request"
    : deliveryPending
      ? booking.delivery_date
        ? `Awaiting delivery on ${formatDate(booking.delivery_date)}`
        : "Awaiting delivery scheduling"
      : booking.status === "picked_up"
        ? pickedUpAt
          ? `Completed • picked up ${formatDateTime(pickedUpAt)}`
          : "Completed"
        : booking.status === "cancelled"
          ? "Cancelled"
          : booking.status.replace("_", " ");
  const nextActionLabel = canMarkDelivered
    ? "Mark delivery complete"
    : canSchedulePickup
      ? "Schedule pickup"
      : canMarkPickedUp
        ? "Mark pickup complete"
        : booking.status === "picked_up"
          ? "No further operational action"
        : booking.status === "cancelled"
          ? "No further operational action"
          : "Review booking status";
  const attentionState = evaluateBookingAttention({
    status: booking.status,
    deliveryDate: booking.delivery_date,
    pickupPlanning,
    todayYmd: todayISO(),
  });
  const bookingCreatorName = booking.customer_name?.trim() || booking.customer_email?.trim() || "The customer who created this booking";
  const timelineMilestones = [
    {
      key: "created",
      label: "Booking created",
      value: formatDateTime(booking.created_at),
      done: createdDone,
      active: createdDone && !deliveredDone,
      icon: ClipboardDocumentListIcon,
    },
    {
      key: "delivered",
      label: "Delivered",
      value: deliveredDone ? formatDateTime(deliveredAt ?? booking.delivery_date) : "Pending",
      done: deliveredDone,
      active: booking.status === "delivered" && !pickedUpDone,
      problem: attentionState.isOverdueConfirmed,
      icon: TruckIcon,
    },
    {
      key: "picked-up",
      label: "Picked up",
      value: pickedUpDone ? formatDateTime(pickedUpAt) : "Pending",
      done: pickedUpDone,
      active: booking.status === "picked_up",
      problem: attentionState.isOverduePickup,
      icon: ArrowUturnLeftIcon,
    },
  ];
  const [createdMilestone, deliveredMilestone, pickedUpMilestone] = timelineMilestones;
  const renderTimelineMilestone = (
    milestone: (typeof timelineMilestones)[number],
    align: "left" | "center" | "right",
  ) => {
    const Icon = milestone.icon;
    const alignmentClass =
      align === "left" ? "justify-self-start" : align === "right" ? "justify-self-end" : "justify-self-center";

    return (
      <div className={`${alignmentClass} flex items-center gap-3 text-left`}>
        <div
          className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${
            milestone.done
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : milestone.problem
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : milestone.active
                  ? "border-orange-200 bg-orange-50 text-orange-700"
                  : "border-slate-200 bg-slate-50 text-slate-500"
          }`}
        >
          {milestone.done ? <CheckIcon className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </div>
        <div
          className={`min-w-0 ${
            milestone.done
              ? "text-emerald-900"
              : milestone.problem
                ? "text-rose-900"
                : milestone.active
                  ? "text-orange-900"
                  : "text-slate-700"
          }`}
        >
          <div className="text-sm font-semibold">{milestone.label}</div>
          <div
            className={`mt-0.5 text-sm ${
              milestone.done
                ? "text-slate-600"
                : milestone.problem
                  ? "text-rose-700"
                  : milestone.active
                    ? "text-slate-600"
                    : "text-slate-500"
            }`}
          >
            {milestone.value}
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminPage className="space-y-6 py-8">
      <AdminToastTrigger success={savedMessage} trigger={saved} clearParam="saved" />

      <div>
        <Link
          href="/admin/bookings"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Back to bookings
        </Link>
      </div>

      <section className="px-1 py-1">
        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="grid min-w-[960px] grid-cols-[max-content_minmax(80px,1fr)_max-content_minmax(80px,1fr)_max-content] items-center gap-x-3 px-1">
            {renderTimelineMilestone(createdMilestone, "left")}
            <div className="flex items-center self-center" aria-hidden="true">
              <div className="w-full border-t-2 border-dotted border-slate-300" />
            </div>
            {renderTimelineMilestone(deliveredMilestone, "center")}
            <div className="flex items-center self-center" aria-hidden="true">
              <div className="w-full border-t-2 border-dotted border-slate-300" />
            </div>
            {renderTimelineMilestone(pickedUpMilestone, "right")}
          </div>
        </div>
      </section>

      <div className="rounded-[32px] bg-white px-6 py-6 shadow-xl ring-1 ring-slate-200/70 sm:px-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Booking command view
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {getCustomerFacingBookingLabel(booking.booking_ref)}
                </h1>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(
                    booking.status
                  )}`}
                >
                  {booking.status.replace("_", " ")}
                </span>
                {booking.reordered_from_booking_id ? (
                  <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-200">
                    Reorder
                  </span>
                ) : null}
                {attentionState.needsAttention ? (
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getAvailabilityRiskClasses(
                      attentionState.rowAlertTone === "none" ? "caution" : attentionState.rowAlertTone,
                    )}`}
                  >
                    Needs attention
                  </span>
                ) : null}
              </div>

              <div className="mt-2 text-sm text-slate-500">
                Internal UUID: <span className="font-mono break-all">{booking.id}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {canMarkDelivered ? (
                <form action={quickMarkDeliveredAction}>
                  <input type="hidden" name="id" value={booking.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Mark delivered
                  </button>
                </form>
              ) : null}

              {canSchedulePickup ? (
                <Link
                  href="#pickup"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Schedule pickup
                </Link>
              ) : null}

              {canMarkPickedUp ? (
                <form action={quickMarkPickedUpAction}>
                  <input type="hidden" name="id" value={booking.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Mark picked up
                  </button>
                </form>
              ) : null}

              {canCancel ? (
                <form action={quickCancelBookingAction}>
                  <input type="hidden" name="id" value={booking.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Cancel booking
                  </button>
                </form>
              ) : null}
            </div>
          </div>

          {attentionState.needsAttention && attentionState.rowAlertSummary ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Needs attention</div>
              <div className="mt-1 text-sm text-slate-700">
                {attentionState.rowAlertSummary.charAt(0).toUpperCase()}
                {attentionState.rowAlertSummary.slice(1)}.
              </div>
            </div>
          ) : null}

          <div className="min-w-0">
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Customer
                  </div>
                  {priorCustomerBookingCount > 0 ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                        Repeat customer
                      </span>
                      <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                        {priorCustomerBookingCount} prior rental{priorCustomerBookingCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <Field label="Name" value={booking.customer_name || "—"} />
                  <Field
                    label="Email"
                    value={
                      booking.customer_email ? (
                        <a
                          href={`mailto:${booking.customer_email}`}
                          className="inline-flex items-center gap-2 font-medium text-slate-900 hover:underline"
                        >
                          <EnvelopeIcon className="h-4 w-4 text-slate-400" />
                          <span>{booking.customer_email}</span>
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Field
                    label="Phone"
                    value={
                      booking.customer_phone ? (
                        <a
                          href={toTelHref(booking.customer_phone)}
                          className="inline-flex items-center gap-2 font-medium text-slate-900 hover:underline"
                        >
                          <PhoneIcon className="h-4 w-4 text-slate-400" />
                          <span>{booking.customer_phone}</span>
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />
                </div>
                {placement.alternateContactName || placement.alternateContactPhone ? (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Alternate Contact
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-900">
                      {[placement.alternateContactName, placement.alternateContactPhone].filter(Boolean).join(" • ")}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Delivery Address
                </div>
                <div className="mt-4 text-sm leading-6 text-slate-900">
                  <div>{booking.customer_street || "—"}</div>
                  <div>
                    {[booking.customer_city, booking.customer_zip].filter(Boolean).join(", ") || "—"}
                  </div>
                </div>
                {hasAccessIssues || hasDeliveryPhoto || hasSpecialInstructions ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {hasAccessIssues ? (
                      <Link
                        href="#placement-access-issues"
                        className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-100"
                      >
                        Access issues noted
                      </Link>
                    ) : null}
                    {hasDeliveryPhoto ? (
                      <Link
                        href="#placement-delivery-photo"
                        className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 ring-1 ring-sky-200 transition hover:bg-sky-100"
                      >
                        Delivery photo available
                      </Link>
                    ) : null}
                    {hasSpecialInstructions ? (
                      <Link
                        href="#placement-special-instructions"
                        className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 ring-1 ring-violet-200 transition hover:bg-violet-100"
                      >
                        Special instructions
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Current state
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-900">{currentOperationalState}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Next likely action
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-900">{nextActionLabel}</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
              <div className={`grid gap-4 sm:grid-cols-2 ${daysOnSite != null ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
                <div className="min-w-0 border-b border-slate-200/80 pb-3 sm:border-b-0 sm:pb-0 sm:pr-4 xl:border-r">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Delivery date</div>
                  <div className="mt-2 text-sm font-medium text-slate-900">{formatDate(booking.delivery_date)}</div>
                </div>
                <div className="min-w-0 border-b border-slate-200/80 pb-3 sm:border-b-0 sm:pb-0 sm:pr-4 xl:border-r">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Dumpster</div>
                  <div className="mt-2 text-sm font-medium text-slate-900">
                    {booking.dumpster_size || "—"}
                    {booking.dumpster_product_id ? ` • ${booking.dumpster_product_id}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Planned: {currentAssignedDumpster ? currentAssignedDumpster.displayName : "Unplanned"}
                  </div>
                </div>
                <div className="min-w-0 border-b border-slate-200/80 pb-3 sm:border-b-0 sm:pb-0 sm:pr-4 xl:border-r">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Created</div>
                  <div className="mt-2 text-sm font-medium text-slate-900">{formatDateTime(booking.created_at)}</div>
                </div>
                <div className={`min-w-0 ${daysOnSite != null ? "xl:border-r xl:pr-4" : ""}`}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Pickup status</div>
                  <div className="mt-2 text-sm font-medium text-slate-900">
                    {pickupPlanning.pickupStatus === "scheduled"
                      ? pickupPlanning.scheduledPickupDate
                        ? `Scheduled for ${formatDate(pickupPlanning.scheduledPickupDate)}`
                        : "Scheduled"
                      : pickupPlanning.pickupStatusLabel}
                  </div>
                </div>
                {daysOnSite != null ? (
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Days on site</div>
                    <div className={`mt-2 text-sm font-medium ${daysOnSiteClasses(daysOnSite)}`}>
                      {daysOnSite} day{daysOnSite === 1 ? "" : "s"}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="assigned-dumpster">
        <Section
          title="Planned dumpster"
          description="Optional dispatch assignment for a specific dumpster record. This does not change pooled customer availability."
          icon={<TruckIcon className="h-4 w-4" />}
        >
          {assignmentError ? (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {assignmentError}
            </div>
          ) : null}

          {!booking.dumpster_size || !booking.delivery_date ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-5 text-sm text-slate-500">
              Save a dumpster size and delivery date on the booking before planning a specific unit.
            </div>
          ) : (
            <form action={updateAssignedDumpsterAction} className="space-y-5">
              <input type="hidden" name="id" value={booking.id} />

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Booking size"
                      value={
                        <>
                          {booking.dumpster_size}
                          {booking.dumpster_product_id ? ` • ${booking.dumpster_product_id}` : ""}
                        </>
                      }
                    />
                    <Field
                      label="Requested window"
                      value={
                        <>
                          {formatDate(booking.delivery_date)} to{" "}
                          {assignmentOptions.requestedPickupDate
                            ? formatDate(assignmentOptions.requestedPickupDate)
                            : "—"}
                        </>
                      }
                    />
                    <Field
                      label="Current plan"
                      value={
                        currentAssignedDumpster ? (
                          <span>
                            {currentAssignedDumpster.displayName}
                            <span className="text-slate-500">
                              {` • ${currentAssignedDumpster.equipmentId}`}
                            </span>
                          </span>
                        ) : (
                          "Unplanned"
                        )
                      }
                    />
                    <Field
                      label="Compatible dumpsters"
                      value={`${compatibleDumpsters.length} available for planning`}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">
                      Planned dumpster
                    </span>
                    <select
                      name="dumpster_id"
                      defaultValue={booking.dumpster_id ?? ""}
                      className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                    >
                      <option value="">Unplanned</option>
                      {assignmentChoices.map((option) => (
                        <option key={option.id} value={option.id}>
                          {formatAssignedDumpsterLabel(option)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="mt-3 text-xs leading-5 text-slate-500">
                    Compatible dumpsters match the booking size, are active and bookable, and are not already planned on another overlapping active booking.
                  </div>

                  {currentAssignedDumpster && !currentAssignedDumpster.isCompatible ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-medium text-amber-900">
                      The current planned dumpster is no longer in the compatible pool. You can keep it temporarily or clear it here.
                    </div>
                  ) : null}

                  <div className="mt-4 flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Save plan
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </Section>
      </div>

      {linkedCustomer && (accountEmailDiffers || accountNameDiffers || accountPhoneDiffers) ? (
        <Section title="Linked Customer Account" icon={<UserIcon className="h-4 w-4" />}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Field label="Name" value={linkedCustomer.name || "—"} />
            <Field
              label="Email"
              value={
                linkedCustomer.email ? (
                  <a href={`mailto:${linkedCustomer.email}`} className="font-medium text-slate-900 hover:underline">
                    {linkedCustomer.email}
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <Field
              label="Phone"
              value={
                linkedCustomer.phone ? (
                  <a href={toTelHref(linkedCustomer.phone)} className="font-medium text-slate-900 hover:underline">
                    {linkedCustomer.phone}
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <div className="flex items-end lg:justify-end">
              <Link
                href={`/admin/customers/${encodeURIComponent(linkedCustomer.id)}`}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                View Customer
              </Link>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Multiple names associated with this booking
              </div>
              <div className="space-y-2 text-sm leading-6 text-slate-700">
                <p>
                  <span className="font-semibold text-slate-900">{bookingCreatorName}</span> created this booking, but the other customer details listed here are also associated with this account, and these individuals could contact you regarding this booking.
                </p>
                <p>
                  To learn more visit our{" "}
                  <Link
                    href="/admin/docs/customer-booking-identity"
                    className="font-semibold text-sky-700 transition hover:text-sky-800"
                  >
                    Help Guides
                  </Link>.
                </p>
              </div>
            </div>
          </div>
        </Section>
      ) : null}

      <Section title="Financial Summary" icon={<CurrencyDollarIcon className="h-4 w-4" />}>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/70">
          <div className="grid gap-px bg-slate-200 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="bg-white">
              <div className="border-b border-slate-300 bg-slate-100/90 px-5 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                  Pricing
                </div>
              </div>
              <div className="divide-y divide-slate-200">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
                  <div className="text-sm font-medium text-slate-600">Base price</div>
                  <div className="text-right text-sm font-semibold text-slate-900">
                    {formatUsdFromCents(booking.base_rental_price_cents)}
                  </div>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
                  <div className="text-sm font-medium text-slate-600">Tax</div>
                  <div className="text-right text-sm font-semibold text-slate-900">
                    {formatUsdFromCents(booking.tax_cents)}
                  </div>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
                  <div className="text-sm font-medium text-slate-600">Overage days</div>
                  <div className="text-right text-sm font-semibold text-slate-900">
                    {booking.extra_days && booking.extra_days > 0
                      ? formatUsdFromCents(booking.extra_days_charge_cents)
                      : formatUsdFromCents(0)}
                  </div>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
                  <div className="text-sm font-medium text-slate-600">Weight overages</div>
                  <div className="text-right text-sm font-semibold text-slate-900">—</div>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-slate-900/3 px-5 py-4">
                  <div className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                    Total price
                  </div>
                  <div className="text-right text-lg font-semibold text-slate-900">
                    {formatUsdFromCents(booking.total_price_cents)}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white">
              <div className="border-b border-slate-300 bg-slate-100/90 px-5 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                  Rental terms
                </div>
              </div>
              <div className="divide-y divide-slate-200">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
                  <div className="text-sm font-medium text-slate-600">Booked rental length</div>
                  <div className="text-right text-sm font-semibold text-slate-900">
                    {booking.rental_duration_days != null && booking.included_rental_days != null
                      ? `${booking.rental_duration_days} days (${booking.included_rental_days} included)`
                      : "—"}
                  </div>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
                  <div className="text-sm font-medium text-slate-600">Overage days</div>
                  <div className="text-right text-sm font-semibold text-slate-900">
                    {booking.extra_days && booking.extra_days > 0
                      ? `${booking.extra_days} day${booking.extra_days === 1 ? "" : "s"}`
                      : "0 days"}
                  </div>
                </div>
                <div className="px-5 py-4">
                  <div className="text-sm font-medium text-slate-600">Extension requests</div>
                  <div className="mt-3 pl-4 text-sm">
                    <div className="flex items-center justify-between gap-6 py-1.5">
                      <div className="text-slate-500">During booking</div>
                      <div className="text-right font-semibold text-slate-900">
                        {booking.allow_extended_rental_at_booking_snapshot == null
                          ? "—"
                          : booking.allow_extended_rental_at_booking_snapshot
                            ? "Allowed"
                            : "Not allowed"}
                      </div>
                    </div>
                    <div className="w-full border-t border-dotted border-slate-300" />
                    <div className="flex items-center justify-between gap-6 py-1.5">
                      <div className="text-slate-500">After booking</div>
                      <div className="text-right font-semibold text-slate-900">—</div>
                    </div>
                    <div className="w-full border-t border-dotted border-slate-300" />
                    <div className="flex items-center justify-between gap-6 py-1.5">
                      <div className="text-slate-500">Total</div>
                      <div className="text-right font-semibold text-slate-900">
                        {booking.extra_days && booking.extra_days > 0
                          ? `${booking.extra_days} day${booking.extra_days === 1 ? "" : "s"}`
                          : "0 days"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <div id="placement-access">
        <Section
          title="Placement & access"
          icon={<TruckIcon className="h-4 w-4" />}
        >
          <div className="space-y-5">
            {!placementSchemaAvailable ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Placement & access columns are not available in this database yet, so bookings created here cannot persist or display structured placement details until the latest placement migration is applied and the Supabase schema cache is refreshed.
              </div>
            ) : null}

            {!hasPlacementData && placementSchemaAvailable ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                No placement details collected.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="divide-y divide-slate-200">
                  <div className="grid gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Placement preference
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                      {getPlacementPreferenceLabel(placement.placementPreference)}
                    </div>
                  </div>
                  <div className="grid gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Exact placement details
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                      {placement.placementDetails || "Not provided"}
                    </div>
                  </div>
                  <div
                    id="placement-access-issues"
                    className="grid gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Access issues
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                      {placement.accessIssues.length
                        ? placement.accessIssues.map(getAccessIssueLabel).join(", ")
                        : "No access issues noted"}
                    </div>
                  </div>
                  <div className="grid gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Gate / access instructions
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                      {placement.gateInstructions || "None provided"}
                    </div>
                  </div>
                  <div className="grid gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Delivery presence
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                      {getDeliveryPresenceLabel(placement.deliveryPresence)}
                    </div>
                  </div>
                  <div className="grid gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Alternate contact
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                      {[placement.alternateContactName, placement.alternateContactPhone].filter(Boolean).join(" • ") ||
                        (booking.customer_phone ? `Use customer phone • ${booking.customer_phone}` : "Use customer phone")}
                    </div>
                  </div>
                  <div
                    id="placement-special-instructions"
                    className="grid gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Special instructions
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                      {placement.specialDeliveryInstructions || "None provided"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {placement.placementPhotoUrl ? (
              <div id="placement-delivery-photo" className="space-y-3">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Delivery photo</div>
                <a href={placement.placementPhotoUrl} target="_blank" rel="noreferrer">
                  <img
                    src={placement.placementPhotoUrl}
                    alt="Placement area"
                    className="h-64 w-full rounded-2xl border border-slate-200 object-cover"
                  />
                </a>
              </div>
            ) : null}

          </div>
        </Section>
      </div>

      <div id="booking-operational-controls">
        <Section title="Operational edit controls" icon={<PencilSquareIcon className="h-4 w-4" />}>
          {placementError ? (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {placementError}
            </div>
          ) : null}

          <form action={updateOperationalControlsAction} className="space-y-5">
            <input type="hidden" name="id" value={booking.id} />
            <input type="hidden" name="placement_schema_available" value={placementSchemaAvailable ? "true" : "false"} />
            <input type="hidden" name="placement_photo_url" value={placement.placementPhotoUrl ?? ""} />

            {placementSchemaAvailable ? (
              <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white" open={Boolean(placementError)}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Edit placement details</div>
                    <div className="mt-1 text-sm text-slate-500">
                      Correct structured placement and access details without using Admin notes.
                    </div>
                  </div>
                  <span className="text-slate-400 transition group-open:rotate-180">⌄</span>
                </summary>

                <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-4">
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">
                          Placement preference
                        </span>
                        <select
                          name="placement_preference"
                          defaultValue={placement.placementPreference ?? ""}
                          className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                        >
                          <option value="">Choose placement</option>
                          {PLACEMENT_PREFERENCES.map((option) => (
                            <option key={option} value={option}>
                              {getPlacementPreferenceLabel(option)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">
                          Delivery presence
                        </span>
                        <select
                          name="delivery_presence"
                          defaultValue={placement.deliveryPresence ?? ""}
                          className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                        >
                          <option value="">Choose presence</option>
                          {DELIVERY_PRESENCE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {getDeliveryPresenceLabel(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        Exact placement details
                      </span>
                      <textarea
                        name="placement_details"
                        defaultValue={placement.placementDetails ?? ""}
                        rows={3}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                      />
                    </label>

                    <div className="space-y-3 rounded-2xl bg-white px-4 py-4 ring-1 ring-slate-200">
                      <div>
                        <div className="text-sm font-medium text-slate-700">Access issues</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Check anything the driver should know before arriving.
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {ACCESS_ISSUES.map((issue) => (
                          <label key={issue} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              name="access_issues"
                              value={issue}
                              defaultChecked={placement.accessIssues.includes(issue)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]/20"
                            />
                            <span>{getAccessIssueLabel(issue)}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">
                          Gate / access instructions
                        </span>
                        <textarea
                          name="gate_instructions"
                          defaultValue={placement.gateInstructions ?? ""}
                          rows={3}
                          placeholder="Required if gated property is selected."
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">
                          Special instructions
                        </span>
                        <textarea
                          name="special_delivery_instructions"
                          defaultValue={placement.specialDeliveryInstructions ?? ""}
                          rows={3}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">
                          Alternate contact name
                        </span>
                        <input
                          type="text"
                          name="alternate_contact_name"
                          defaultValue={placement.alternateContactName ?? ""}
                          className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">
                          Alternate contact phone
                        </span>
                        <input
                          type="tel"
                          name="alternate_contact_phone"
                          defaultValue={placement.alternateContactPhone ?? ""}
                          className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </details>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                      <TruckIcon className="h-4 w-4" />
                    </span>
                    <div className="text-sm font-semibold text-slate-900">Delivery Date</div>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                      deliveryPending
                        ? "bg-amber-50 text-amber-700 ring-amber-200"
                        : booking.status === "delivered" || booking.status === "picked_up"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : booking.status === "cancelled"
                            ? "bg-rose-50 text-rose-700 ring-rose-200"
                            : "bg-slate-100 text-slate-700 ring-slate-200"
                    }`}
                  >
                    {deliveryPending
                      ? "Pending"
                      : booking.status === "delivered" || booking.status === "picked_up"
                        ? "Delivered"
                        : booking.status === "cancelled"
                          ? "Cancelled"
                          : "Scheduled"}
                  </span>
                </div>

                <div className="mt-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">
                      Delivery date
                    </span>

                    <div className="h-12 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                      <input
                        type="date"
                        name="delivery_date"
                        defaultValue={booking.delivery_date ?? ""}
                        className="h-full w-full border-0 bg-transparent px-4 text-sm text-slate-900 outline-none"
                      />
                    </div>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                    <FlagIcon className="h-4 w-4" />
                  </span>
                  <div className="text-sm font-semibold text-slate-900">Status</div>
                </div>

                <div className="mt-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">
                      Booking status
                    </span>
                    <select
                      name="status"
                      defaultValue={booking.status}
                      className="h-12 min-w-0 w-full rounded-2xl border border-slate-300 px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                    >
                      <option value="confirmed">confirmed</option>
                      <option value="scheduled">scheduled</option>
                      <option value="delivered">delivered</option>
                      <option value="picked_up">picked_up</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                    <ArrowUturnLeftIcon className="h-4 w-4" />
                  </span>
                  <div className="text-sm font-semibold text-slate-900">Pickup Date</div>
                </div>

                <div className="mt-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">
                      Pickup date
                    </span>

                    <div className="h-12 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                      <input
                        type="date"
                        name="pickup_date"
                        defaultValue={editablePickupDate}
                        className="h-full w-full border-0 bg-transparent px-4 text-sm text-slate-900 outline-none"
                      />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Save changes
              </button>
            </div>
          </form>
        </Section>
      </div>

      {booking.reordered_from_booking_id || derivedFromThisBookingCount > 0 ? (
        <div className="rounded-[32px] bg-white px-6 py-6 shadow-sm ring-1 ring-slate-200/70 sm:px-8">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
            <div>
              <div className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-200">
                {booking.reordered_from_booking_id ? "Reordered booking" : "Source booking"}
              </div>
              <h2 className="mt-3 text-lg font-semibold text-slate-900">
                {booking.reordered_from_booking_id
                  ? "This booking was created from a previous rental"
                  : "This booking has been used as a reorder source"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {booking.reordered_from_booking_id
                  ? "Helpful repeat-booking context for office staff and dispatch."
                  : "Later bookings may reuse the same customer setup and placement details from this rental."}
              </p>
            </div>

            <div className="space-y-3">
              {booking.reordered_from_booking_id ? (
                sourceBooking ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Source booking
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      <Link href={`/admin/bookings/${sourceBooking.id}`} className="hover:underline">
                        {getCustomerFacingBookingLabel(sourceBooking.booking_ref)}
                      </Link>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {sourceBooking.customer_name || "Customer"}
                      {sourceBooking.delivery_date ? ` • Delivered ${formatDate(sourceBooking.delivery_date)}` : ""}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {[sourceBooking.customer_street, sourceBooking.customer_city, sourceBooking.customer_zip]
                        .filter(Boolean)
                        .join(", ") || "Address unavailable"}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
                    Source booking unavailable.
                  </div>
                )
              ) : null}

              {derivedFromThisBookingCount > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Later reorders
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    Used to create {derivedFromThisBookingCount} later booking{derivedFromThisBookingCount === 1 ? "" : "s"}
                  </div>
                  {latestDerivedBooking ? (
                    <div className="mt-2 text-sm text-slate-600">
                      Latest:{" "}
                      <Link href={`/admin/bookings/${latestDerivedBooking.id}`} className="font-medium text-slate-900 hover:underline">
                        {getCustomerFacingBookingLabel(latestDerivedBooking.booking_ref)}
                      </Link>
                      {latestDerivedBooking.delivery_date
                        ? ` • Delivery ${formatDate(latestDerivedBooking.delivery_date)}`
                        : ""}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        <section className="min-w-0 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="mb-6 border-b border-slate-200 pb-4">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <ClipboardDocumentListIcon className="h-4 w-4" />
              </span>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">Audit History</h2>
                <span
                  className="inline-flex text-slate-400"
                  title="Historical audit trail for booking changes and linked customer-account updates."
                  aria-label="Audit History help"
                >
                  <QuestionMarkCircleIcon className="h-4 w-4" />
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {bookingHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
                No booking history recorded yet.
              </div>
            ) : (
              (bookingHistory as BookingHistoryEntry[]).map((entry) => (
                <AuditHistoryCard
                  key={entry.id}
                  title={formatHistoryFieldLabel(String(entry.field_name))}
                  beforeValue={formatHistoryValue(entry.field_name, entry.old_value)}
                  afterValue={formatHistoryValue(entry.field_name, entry.new_value)}
                  changedAt={entry.created_at}
                />
              ))
            )}

            {linkedCustomerHistory.length > 0 ? (
              <div className="pt-3">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Linked customer account changes
                </div>
                <div className="space-y-3">
                  {linkedCustomerHistory.map((entry) => (
                    <AuditHistoryCard
                      key={entry.id}
                      title={`Customer ${formatHistoryFieldLabel(String(entry.field_name))}`}
                      beforeValue={formatHistoryValue(entry.field_name, entry.old_value)}
                      afterValue={formatHistoryValue(entry.field_name, entry.new_value)}
                      changedAt={entry.created_at}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <div id="notes" className="min-w-0">
          <Section title="Admin notes" icon={<PencilSquareIcon className="h-4 w-4" />}>
            <form action={updateNotesAction} className="space-y-4">
              <input type="hidden" name="id" value={booking.id} />

              <textarea
                name="notes"
                defaultValue={booking.notes ?? ""}
                rows={6}
                placeholder="Add internal notes specific to this booking..."
                className="w-full resize-y rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
              />

              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Save notes
              </button>
            </form>
          </Section>
        </div>
      </div>
    </AdminPage>
  );
}
