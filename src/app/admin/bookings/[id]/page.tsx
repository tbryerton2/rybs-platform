/* eslint-disable @next/next/no-img-element */
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { EMPTY_BOOKING_PLACEMENT_FIELDS, isBookingSchemaError } from "@/lib/booking-schema";
import { getCustomerFacingBookingLabel } from "@/lib/identity";
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
  getPlacementCompactSignals,
  getDeliveryPresenceLabel,
  getPlacementDispatchSummary,
  getPlacementPreferenceLabel,
  hasCollectedPlacementDetails,
  sanitizePlacementDetails,
} from "@/lib/placement";
import {
  quickCancelBookingAction,
  quickMarkDeliveredAction,
  quickMarkPickedUpAction,
  updateBookingStatusAction,
  updateDeliveryDateAction,
  updatePlacementDetailsAction,
  updateNotesAction,
} from "./actions";
import PickupDetailsForm from "./pickup-details-form";
import { AdminToastTrigger } from "@/app/admin/_components/admin/admin-toast-trigger";
import { AdminPage } from "@/app/admin/_components/admin/admin-page";
import { ContextHelpCard } from "@/app/admin/_components/admin/context-help-card";

import {
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/solid";

import {
  ArrowUturnLeftIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  FlagIcon,
  PencilSquareIcon,
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
  base_rental_price_cents: number | null;
  included_rental_days: number | null;
  rental_duration_days: number | null;
  extra_days: number | null;
  daily_overage_price_cents: number | null;
  extra_days_charge_cents: number | null;
  subtotal_cents: number | null;
  taxable_subtotal_cents: number | null;
  tax_cents: number | null;
  service_county: string | null;
  service_town: string | null;
  delivered_at: string | null;
  picked_up_at: string | null;
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

function timelineDotClasses(done: boolean, active = false) {
  if (done) return "bg-emerald-500 ring-emerald-200";
  if (active) return "bg-[#F97316] ring-[#F97316]/20";
  return "bg-slate-300 ring-slate-200";
}

function toSmsHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `sms:${digits}`;
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

function getOperationalTypeLabel(booking: Pick<Booking, "status" | "pickup_mode" | "pickup_date">) {
  switch (booking.status) {
    case "confirmed":
    case "scheduled":
      return "Delivery";
    case "delivered":
      if (booking.pickup_mode === "schedule" && booking.pickup_date) return "Scheduled pickup";
      if (booking.pickup_mode === "request") return "Pickup requested";
      return "On-site rental";
    case "picked_up":
      return "Completed pickup";
    case "cancelled":
      return "Cancelled";
    default:
      return "Unknown";
  }
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

function placementSignalClasses(tone: "amber" | "blue" | "emerald" | "slate") {
  switch (tone) {
    case "amber":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "blue":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "emerald":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
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
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2.5 gap-y-2">
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

function TimelineItem({
  label,
  value,
  done,
  active = false,
  isLast = false,
}: {
  label: string;
  value: string;
  done: boolean;
  active?: boolean;
  isLast?: boolean;
}) {
  return (
    <div className="relative grid grid-cols-[auto_minmax(0,1fr)_minmax(180px,0.8fr)] items-start gap-x-4 gap-y-1">
      {!isLast && (
        <div className="absolute left-[6px] top-3 bottom-[-16px] w-px bg-slate-200" />
      )}
      <span
        className={`relative z-10 inline-flex h-3 w-3 rounded-full ring-4 ${timelineDotClasses(
          done,
          active
        )}`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <div className={`text-sm font-medium ${active ? "text-slate-900" : "text-slate-700"}`}>
          {label}
        </div>
      </div>
      <div className="text-right text-sm text-slate-500">{value}</div>
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
    default:
      return null;
  }
}

export default async function AdminBookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; placementError?: string }>;
}) {
  const { id } = await params;
  const { saved, placementError } = await searchParams;

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
      service_county,
      service_town,
      delivered_at,
      picked_up_at,
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
      service_county,
      service_town,
      delivered_at,
      picked_up_at,
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
      service_county,
      service_town,
      delivered_at,
      picked_up_at,
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
  const priorAddressBookingCount = isBookingSchemaError(priorAddressBookingsResult.error)
    ? 0
    : Number(priorAddressBookingsResult.count ?? 0);
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
  const deliveryScheduledDone = isFilled(booking.delivery_date);
  const deliveredDone = isFilled(booking.delivered_at) || booking.status === "delivered" || booking.status === "picked_up";
  const pickupScheduledDone = isFilled(booking.pickup_date) && booking.pickup_mode === "schedule";
  const pickedUpDone = isFilled(booking.picked_up_at) || booking.status === "picked_up";
  const pickupPlanning = buildPickupPlanningModel({
    deliveryDate: booking.delivery_date,
    pickupDate: booking.pickup_date,
    pickupMode: booking.pickup_mode,
    futureDeliveryDates: futureDependencyDates,
  });
  const editablePickupDate =
    booking.pickup_mode === "schedule" && pickupPlanning.scheduledPickupDate
      ? pickupPlanning.scheduledPickupDate
      : "";
  const daysOnSite =
  booking.status === "delivered"
    ? getDaysOnSite(booking.delivered_at, booking.delivery_date)
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
  const placementSignals = getPlacementCompactSignals(placement, 8);
  const placementSummary = placementSchemaAvailable
    ? getPlacementDispatchSummary(placement)
    : "Placement fields unavailable in this environment";
  const hasPlacementData = placementSchemaAvailable && hasCollectedPlacementDetails(placement);
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
        ? booking.picked_up_at
          ? `Completed • picked up ${formatDateTime(booking.picked_up_at)}`
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
  const nextActionNote =
    canMarkDelivered
      ? "Confirm delivery completion once the dumpster is on site."
      : canSchedulePickup
        ? "Set the real pickup date once the customer is ready."
        : canMarkPickedUp
          ? "Close the job once the dumpster has physically returned."
          : booking.status === "picked_up"
            ? "This booking is complete and now primarily serves as historical record."
            : booking.status === "cancelled"
              ? "This booking is closed unless staff need to document follow-up."
              : "No immediate action is blocked, but staff can update the booking if needed.";
  const operationalFocusNote =
    pickupPlanning.riskMessage ??
    (booking.status === "delivered" && pickupPlanning.pickupStatus === "requested"
      ? "Customer requested pickup. Office needs to confirm the actual pickup date."
      : deliveryPending
        ? "Confirm delivery timing and keep the customer updated."
        : booking.status === "picked_up"
          ? "Historical record only unless follow-up is needed."
          : "Booking is progressing normally.");

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

      <div className="rounded-[32px] bg-white px-6 py-6 shadow-xl ring-1 ring-slate-200/70 sm:px-8">
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
            </div>

            <div className="mt-2 text-sm text-slate-500">
              Internal UUID: <span className="font-mono break-all">{booking.id}</span>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Current state
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{currentOperationalState}</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">{operationalFocusNote}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Next likely action
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{nextActionLabel}</div>
                <div className="mt-2 text-sm text-slate-600">{nextActionNote}</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="min-w-0 border-b border-slate-200/80 pb-3 sm:border-b-0 sm:pb-0 sm:pr-4 xl:border-r">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Delivery date</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{formatDate(booking.delivery_date)}</div>
                </div>
                <div className="min-w-0 border-b border-slate-200/80 pb-3 sm:border-b-0 sm:pb-0 sm:pr-4 xl:border-r">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Created</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{formatDateTime(booking.created_at)}</div>
                </div>
                <div className="min-w-0 xl:border-r xl:pr-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Pickup status</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {pickupPlanning.pickupStatus === "scheduled"
                      ? pickupPlanning.scheduledPickupDate
                        ? `Scheduled for ${formatDate(pickupPlanning.scheduledPickupDate)}`
                        : "Scheduled"
                      : pickupPlanning.pickupStatusLabel}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Booked with</div>
                  <div className="mt-1 truncate text-sm font-medium text-slate-900">{booking.customer_email || "—"}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row xl:min-w-[220px] xl:self-center xl:flex-col xl:justify-center">
            {canMarkDelivered ? (
              <form action={quickMarkDeliveredAction}>
                <input type="hidden" name="id" value={booking.id} />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Mark delivered
                </button>
              </form>
            ) : null}

            {canSchedulePickup ? (
              <Link
                href="#pickup"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Schedule pickup
              </Link>
            ) : null}

            {canMarkPickedUp ? (
              <form action={quickMarkPickedUpAction}>
                <input type="hidden" name="id" value={booking.id} />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
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
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                >
                  Cancel booking
                </button>
              </form>
            ) : null}
          </div>
        </div>
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

      <div className="rounded-[32px] bg-white px-6 py-6 shadow-sm ring-1 ring-slate-200/70 sm:px-8">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2.5 gap-y-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
              <ClockIcon className="h-4 w-4" />
            </span>

          <h2 className="text-base font-semibold text-slate-900">Booking timeline</h2>

          <p className="col-start-2 text-sm text-slate-500">
              Historical record of lifecycle milestones already recorded on this booking.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <TimelineItem
            label="Booking created"
            value={formatDateTime(booking.created_at)}
            done={createdDone}
          />

          <TimelineItem
            label="Delivery scheduled"
            value={formatDate(booking.delivery_date)}
            done={deliveryScheduledDone}
            active={deliveryScheduledDone && !deliveredDone}
          />

          <TimelineItem
            label="Delivered"
            value={formatDateTime(booking.delivered_at)}
            done={deliveredDone}
            active={booking.status === "delivered" && !pickedUpDone}
          />

          {booking.pickup_mode === "request" ? (
            <TimelineItem
              label="Pickup requested"
              value="Requested"
              done={true}
              active={!pickedUpDone}
            />
          ) : null}

          {booking.pickup_mode === "schedule" ? (
            <TimelineItem
              label="Pickup scheduled"
              value={formatDate(booking.pickup_date)}
              done={pickupScheduledDone}
              active={!pickedUpDone}
            />
          ) : null}

          <TimelineItem
            label="Picked up"
            value={formatDateTime(booking.picked_up_at)}
            done={pickedUpDone}
            isLast
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="min-w-0 space-y-6">
          <Section title="Customer & service identity" description="Historical booking contact, current linked account, and service location" icon={<UserIcon className="h-4 w-4" />}>
            {priorCustomerBookingCount > 0 || priorAddressBookingCount > 0 ? (
              <div className="mb-6 flex flex-wrap gap-2">
                {priorCustomerBookingCount > 0 ? (
                  <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                    Repeat customer • {priorCustomerBookingCount} prior rental{priorCustomerBookingCount === 1 ? "" : "s"}
                  </span>
                ) : null}
                {priorAddressBookingCount > 0 ? (
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {priorAddressBookingCount} prior rental{priorAddressBookingCount === 1 ? "" : "s"} at this address
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="mb-6">
              <ContextHelpCard
                eyebrow="Why this may look different"
                title="This booking keeps the contact details entered when it was created."
                body="The linked customer account can have newer information later. If the booked-with email and current account email do not match, that is usually expected and not a bug."
                learnMoreHref="/admin/docs/customer-booking-identity"
                tone="sky"
              />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Contact detail mapping
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Compare the original booked-with contact snapshot against the currently linked customer account.
                </div>
              </div>

              <div className="px-5 py-5">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70">
                  <div className="grid grid-cols-[minmax(120px,0.8fr)_minmax(0,1fr)] gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)]">
                    <div>Field</div>
                    <div>Booked-with snapshot</div>
                    <div className="hidden sm:block">Current linked account</div>
                  </div>

                  {[
                    {
                      label: "Name",
                      snapshot: booking.customer_name || "—",
                      current: linkedCustomer?.name || "—",
                    },
                    {
                      label: "Email",
                      snapshot: booking.customer_email ? (
                        <a href={`mailto:${booking.customer_email}`} className="font-medium text-slate-900 hover:underline">
                          {booking.customer_email}
                        </a>
                      ) : (
                        "—"
                      ),
                      current: linkedCustomer?.email ? (
                        <a href={`mailto:${linkedCustomer.email}`} className="font-medium text-slate-900 hover:underline">
                          {linkedCustomer.email}
                        </a>
                      ) : (
                        "—"
                      ),
                    },
                    {
                      label: "Phone",
                      snapshot: booking.customer_phone ? (
                        <a href={toTelHref(booking.customer_phone)} className="font-medium text-slate-900 hover:underline">
                          {booking.customer_phone}
                        </a>
                      ) : (
                        "—"
                      ),
                      current: linkedCustomer?.phone ? (
                        <a href={toTelHref(linkedCustomer.phone)} className="font-medium text-slate-900 hover:underline">
                          {linkedCustomer.phone}
                        </a>
                      ) : (
                        "—"
                      ),
                    },
                  ].map((row, index) => (
                    <div
                      key={row.label}
                      className={`grid grid-cols-[minmax(120px,0.8fr)_minmax(0,1fr)] gap-3 px-4 py-3 text-sm sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] ${
                        index === 2 ? "" : "border-b border-slate-200"
                      }`}
                    >
                      <div className="font-medium text-slate-500">{row.label}</div>
                      <div className="min-w-0 text-slate-900">{row.snapshot}</div>
                      <div className="min-w-0 text-slate-900 max-sm:col-start-2">
                        <div className="sm:hidden text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">
                          Current linked account
                        </div>
                        {linkedCustomer ? row.current : <span className="text-slate-500">No linked account</span>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Linked account details
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Portal status" value={linkedCustomer?.portal_status ?? "invited"} />
                    <Field label="Linked customer ID" value={linkedCustomer?.id ?? "No linked account"} />
                    <Field label="Account state" value={linkedCustomer ? "Customer account linked" : "No linked account"} />
                  </div>
                </div>

                <div
                  className={`mt-4 rounded-2xl px-4 py-3 text-sm leading-6 ring-1 ${
                    linkedCustomer && !(accountEmailDiffers || accountNameDiffers || accountPhoneDiffers)
                      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                      : linkedCustomer
                        ? "bg-amber-50 text-amber-900 ring-amber-200"
                        : "bg-slate-50 text-slate-600 ring-slate-200"
                  }`}
                >
                  {linkedCustomer ? (
                    accountEmailDiffers || accountNameDiffers || accountPhoneDiffers ? (
                      "This booking keeps its original booked-with snapshot. The linked customer account now differs from the original booking identity."
                    ) : (
                      "The linked customer account currently matches the original booking identity."
                    )
                  ) : (
                    "No linked customer account is attached to this booking yet."
                  )}
                </div>
              </div>
            </div>

            {booking.customer_phone || booking.customer_email ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer communication
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {booking.customer_phone ? (
                    <>
                      <a
                        href={toTelHref(booking.customer_phone)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        <PhoneIcon className="h-4 w-4" />
                        Call customer
                      </a>

                      <a
                        href={toSmsHref(booking.customer_phone)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <ChatBubbleLeftRightIcon className="h-4 w-4" />
                        Text customer
                      </a>
                    </>
                  ) : null}

                  {booking.customer_email ? (
                    <a
                      href={`mailto:${booking.customer_email}`}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <EnvelopeIcon className="h-4 w-4" />
                      Email customer
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Service location
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-900">
                <div>{booking.customer_street || "—"}</div>
                <div>{[booking.customer_city, booking.customer_zip].filter(Boolean).join(", ") || "—"}</div>
              </div>
              <div className="mt-6 grid gap-5 border-t border-slate-200 pt-6 sm:grid-cols-2">
                <Field label="Service town" value={booking.service_town} />
                <Field label="Service county" value={booking.service_county} />
              </div>
            </div>
          </Section>

          <div id="delivery">
            <Section title="Delivery details" description="Current delivery configuration and editable operational controls" icon={<TruckIcon className="h-4 w-4" />}>
              <div className="max-w-[820px] space-y-5">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">Delivery state:</span>
                    <span className="text-sm text-slate-600">
                      {onSite && "Dumpster currently on site."}
                      {deliveryPending && "Delivery is still pending."}
                      {booking.status === "picked_up" && "Job is complete."}
                      {booking.status === "cancelled" && "Booking is cancelled."}
                    </span>
                  </div>
                </div>

                <form action={updateDeliveryDateAction} className="space-y-3">
                  <input type="hidden" name="id" value={booking.id} />

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

                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Save delivery date
                  </button>
                </form>
              </div>
            </Section>
          </div>

          <div id="pickup">
            <Section title="Pickup details" description="Current pickup state, scheduling risk, and editable pickup controls" icon={<ArrowUturnLeftIcon className="h-4 w-4" />}>
              <div className="max-w-[820px] space-y-5">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Pickup status
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {pickupPlanning.pickupStatusLabel}
                      </div>
                      {pickupPlanning.pickupStatus === "scheduled" && pickupPlanning.scheduledPickupDate ? (
                        <div className="mt-1 text-sm text-slate-600">
                          Confirmed pickup date: {formatDate(pickupPlanning.scheduledPickupDate)}
                        </div>
                      ) : null}
                    </div>

                    {pickupPlanning.expectedAvailableDate ? (
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Expected available again
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">
                          {formatDate(pickupPlanning.expectedAvailableDate)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {pickupPlanning.expectedAvailabilityHelper}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {pickupPlanning.risk !== "none" ? (
                    <div className="mt-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getAvailabilityRiskClasses(
                            pickupPlanning.risk,
                          )}`}
                        >
                          {pickupPlanning.riskLabel}
                        </span>
                        {pickupPlanning.nextDeliveryDate ? (
                          <span className="text-xs font-medium text-slate-500">
                            Next upcoming delivery: {formatDate(pickupPlanning.nextDeliveryDate)}
                          </span>
                        ) : null}
                      </div>
                      {pickupPlanning.riskMessage ? (
                        <div className="mt-2 text-sm text-slate-700">{pickupPlanning.riskMessage}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <PickupDetailsForm
                  bookingId={booking.id}
                  initialPickupMode={booking.pickup_mode === "schedule" ? "schedule" : "request"}
                  initialPickupDate={editablePickupDate}
                />
              </div>
            </Section>
          </div>

          <div id="placement-access">
            <Section
              title="Placement & access"
              description="Structured delivery instructions for office staff, dispatch, and drivers."
              icon={<TruckIcon className="h-4 w-4" />}
            >
              <div className="space-y-5">
                {!placementSchemaAvailable ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Placement & access columns are not available in this database yet, so bookings created here cannot persist or display structured placement details until the latest placement migration is applied and the Supabase schema cache is refreshed.
                  </div>
                ) : null}

                {placementError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {placementError}
                  </div>
                ) : null}

                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Dispatch summary
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-900">{placementSummary}</div>
                </div>

                {placementSignals.length ? (
                  <div className="flex flex-wrap gap-2">
                    {placementSignals.map((signal) => (
                      <span
                        key={signal.key}
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${placementSignalClasses(signal.tone)}`}
                      >
                        {signal.label}
                      </span>
                    ))}
                  </div>
                ) : null}

                {!hasPlacementData && placementSchemaAvailable ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                    No placement details collected.
                  </div>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Placement preference" value={getPlacementPreferenceLabel(placement.placementPreference)} />
                    <Field label="Exact placement details" value={placement.placementDetails || "Not provided"} />
                    <Field
                      label="Access issues"
                      value={
                        placement.accessIssues.length
                          ? placement.accessIssues.map(getAccessIssueLabel).join(", ")
                          : "No access issues noted"
                      }
                    />
                    <Field label="Gate / access instructions" value={placement.gateInstructions || "None provided"} />
                    <Field label="Delivery presence" value={getDeliveryPresenceLabel(placement.deliveryPresence)} />
                    <Field
                      label="Alternate contact"
                      value={
                        [placement.alternateContactName, placement.alternateContactPhone].filter(Boolean).join(" • ") ||
                        (booking.customer_phone ? `Use customer phone • ${booking.customer_phone}` : "Use customer phone")
                      }
                    />
                    <Field
                      label="Special instructions"
                      value={placement.specialDeliveryInstructions || "None provided"}
                    />
                  </div>
                )}

                {placement.placementPhotoUrl ? (
                  <div className="space-y-3">
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
                      <form action={updatePlacementDetailsAction} className="space-y-4">
                        <input type="hidden" name="id" value={booking.id} />
                        <input type="hidden" name="placement_photo_url" value={placement.placementPhotoUrl ?? ""} />

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

                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          Save placement details
                        </button>
                      </form>
                    </div>
                  </details>
                ) : null}
              </div>
            </Section>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <Section title="Operational summary" icon={<ClipboardDocumentListIcon className="h-4 w-4" />}>
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Job state
                </div>
                <div className="mt-2 text-sm font-medium text-slate-900">
                  {onSite && "On site"}
                  {deliveryPending && "Awaiting delivery"}
                  {booking.status === "picked_up" && "Completed"}
                  {booking.status === "cancelled" && "Cancelled"}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">{nextActionLabel}</div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Operational type" value={getOperationalTypeLabel(booking)} />
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Days on site
                    </div>

                    <div className={`mt-1 text-sm ${daysOnSiteClasses(daysOnSite)}`}>
                      {daysOnSite == null
                        ? "—"
                        : `${daysOnSite} day${daysOnSite === 1 ? "" : "s"}`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Dispatch signals
                </div>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  <div>
                    •{" "}
                    {pickupPlanning.pickupStatus === "scheduled"
                      ? `Confirmed pickup date: ${formatDate(pickupPlanning.scheduledPickupDate)}`
                      : pickupPlanning.pickupStatus === "requested"
                        ? "Pickup requested but not yet scheduled"
                        : "Awaiting customer pickup request"}
                  </div>
                  <div>
                    •{" "}
                    {pickupPlanning.expectedAvailableDate
                      ? `Expected available again ${formatDate(pickupPlanning.expectedAvailableDate)}`
                      : "No forecasted availability date"}
                  </div>
                  <div>{onSite ? "• Dumpster currently with customer" : "• Dumpster not currently on site"}</div>
                  <div>• {placementSummary}</div>
                  {pickupPlanning.riskMessage ? <div>• {pickupPlanning.riskMessage}</div> : null}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Lifecycle timestamps
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field label="Delivered at" value={formatDateTime(booking.delivered_at)} />
                  <Field label="Picked up at" value={formatDateTime(booking.picked_up_at)} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Financial</div>
                    <div className="mt-1 text-sm text-slate-500">Compact commercial context for this booking.</div>
                  </div>
                </div>
                <div className="mt-3">
                  <Field label="Price" value={formatUsdFromCents(booking.total_price_cents)} />
                </div>
                {booking.base_rental_price_cents != null || booking.tax_cents != null ? (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label="Base rental" value={formatUsdFromCents(booking.base_rental_price_cents)} />
                    <Field
                      label="Extra days"
                      value={
                        booking.extra_days && booking.extra_days > 0
                          ? `${booking.extra_days} (${formatUsdFromCents(booking.extra_days_charge_cents)})`
                          : "0"
                      }
                    />
                    <Field label="Tax" value={formatUsdFromCents(booking.tax_cents)} />
                    <Field
                      label="Rental period"
                      value={
                        booking.rental_duration_days != null && booking.included_rental_days != null
                          ? `${booking.rental_duration_days} days (${booking.included_rental_days} included)`
                          : "—"
                      }
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </Section>

          <div id="status">
            <Section title="Status controls" description="Editable current-state controls for office staff." icon={<FlagIcon className="h-4 w-4" />}>
              <form action={updateBookingStatusAction} className="space-y-3">
                <input type="hidden" name="id" value={booking.id} />

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

                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Save status
                </button>
              </form>
            </Section>
          </div>

          <div id="notes">
            <Section title="Admin notes" description="Freeform internal context that supports, but does not replace, structured operational data." icon={<PencilSquareIcon className="h-4 w-4" />}>
              <form action={updateNotesAction} className="space-y-4">
                <input type="hidden" name="id" value={booking.id} />

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Internal notes
                  </span>
                  <textarea
                    name="notes"
                    defaultValue={booking.notes ?? ""}
                    rows={6}
                    placeholder="Internal ops notes, follow-up items, customer context, or dispatch coordination notes..."
                    className="w-full resize-y rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                  />
                </label>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Save notes
                </button>
              </form>
            </Section>
          </div>

          <Section title="History" description="Historical audit trail for booking changes and linked customer-account updates." icon={<ClipboardDocumentListIcon className="h-4 w-4" />}>
            <div className="space-y-3">
              {bookingHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
                  No booking history recorded yet.
                </div>
              ) : (
                (bookingHistory as BookingHistoryEntry[]).map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                    <div className="text-sm font-semibold text-slate-900">
                      {String(entry.field_name).replaceAll("_", " ")}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {entry.old_value ? `${entry.old_value} → ` : ""}
                      {entry.new_value || "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDateTime(entry.created_at)} • {entry.changed_by_type || "system"}
                      {entry.change_reason ? ` • ${entry.change_reason}` : ""}
                    </div>
                  </div>
                ))
              )}

              {linkedCustomerHistory.length > 0 ? (
                <div className="pt-3">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Linked customer account changes
                  </div>
                  <div className="space-y-3">
                    {linkedCustomerHistory.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <div className="text-sm font-semibold text-slate-900">
                          Customer {String(entry.field_name).replaceAll("_", " ")}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {entry.old_value ? `${entry.old_value} → ` : ""}
                          {entry.new_value || "—"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatDateTime(entry.created_at)} • {entry.changed_by_type || "system"}
                          {entry.change_reason ? ` • ${entry.change_reason}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Section>

  
        </div>
      </div>
    </AdminPage>
  );
}
