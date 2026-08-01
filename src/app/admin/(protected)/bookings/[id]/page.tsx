/* eslint-disable @next/next/no-img-element */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SHOW_PLANNED_DUMPSTER_SECTION = false;
const PRIMARY_ACTION_BUTTON_CLASS = "admin-btn admin-btn-primary";
const STATUS_ACTION_BUTTON_CLASS = "admin-btn admin-btn-primary";

import { Fragment, type SVGProps } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAssignableDumpstersForBooking,
  type AssignableDumpsterOption,
} from "@/lib/admin/dumpster-assignment";
import {
  loadAdminBookingCharges,
  type AdminBookingChargeSummary,
} from "@/lib/admin/booking-charges";
import { EMPTY_BOOKING_PLACEMENT_FIELDS, isBookingSchemaError } from "@/lib/booking-schema";
import { getCustomerFacingBookingLabel } from "@/lib/identity";
import { evaluateBookingAttention } from "@/lib/admin/booking-attention";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminOwner } from "@/lib/admin/auth";
import { formatUsdFromCents } from "@/lib/money";
import { formatShortDateET } from "@/lib/time";
import { validateUsableSavedPaymentMethod } from "@/lib/payments/saved-card-validation";
import { buildPickupPlanningModel } from "@/lib/pickup-planning";
import {
  ACCESS_ISSUES,
  DELIVERY_PRESENCE_OPTIONS,
  PLACEMENT_PREFERENCES,
  getAccessIssueLabel,
  getDeliveryPresenceLabel,
  getPlacementPreferenceLabel,
  sanitizePlacementDetails,
  type AccessIssue,
  type DeliveryPresence,
  type PlacementPreference,
} from "@/lib/placement";
import {
  approveAndChargeBookingChargeAction,
  chargeBookingChargeSavedCardAction,
  createDraftBookingChargeAction,
  quickCancelBookingAction,
  quickMarkDeliveredAction,
  quickMarkPickedUpAction,
  recordExternalBookingChargePaymentAction,
  sendPostBookingChargeReceiptAction,
  updateAssignedDumpsterAction,
  updateNotesAction,
  updateOperationalControlsAction,
} from "./actions";
import { AdminToastTrigger } from "@/app/admin/_components/admin/admin-toast-trigger";
import { AdminPage } from "@/app/admin/_components/admin/admin-page";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import { combineCustomerNameParts, formatCustomerName } from "@/lib/customer-name";
import { ExternalPaymentForm } from "./ExternalPaymentForm";

import {
  PhoneIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/solid";

import {
  ArrowUturnLeftIcon,
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  PencilSquareIcon,
  QuestionMarkCircleIcon,
  TruckIcon,
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
  customer_first_name: string | null;
  customer_last_name: string | null;
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
  payment_status: string | null;
  paid_at: string | null;
  payment_provider: string | null;
  payment_provider_payment_id: string | null;
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
  customer_first_name: string | null;
  customer_last_name: string | null;
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

type BookingPaymentSummary = {
  id: string;
  booking_charge_id?: string | null;
  provider: string;
  provider_environment: string;
  status: string;
  amount_cents: number;
  currency: string;
  provider_payment_id: string | null;
  provider_location_id?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  raw_provider_response?: unknown | null;
  paid_at: string | null;
  failed_at: string | null;
  payment_collection_type?: string | null;
  external_payment_method?: string | null;
  external_reference?: string | null;
  external_notes?: string | null;
  external_recorded_at?: string | null;
  created_at: string;
};

type BookingChargeType =
  | "weight_overage"
  | "damage"
  | "extra_day"
  | "trip_fee"
  | "prohibited_material"
  | "manual_adjustment";

type BookingChargeSummary = AdminBookingChargeSummary;

type BookingConsentSummary = {
  id: string;
  consent_type: "rental_terms" | "card_on_file";
  consent_version: string;
  accepted_at: string;
  created_at: string;
};

type CustomerPaymentMethodSummary = {
  id: string;
  business_id: string;
  customer_id: string;
  provider: string;
  provider_environment: string;
  provider_customer_id: string;
  provider_payment_method_id: string;
  card_brand: string | null;
  card_last_4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  status: string;
  created_at: string;
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

const BOOKING_CHARGE_TYPE_OPTIONS: Array<{ value: BookingChargeType; label: string }> = [
  { value: "weight_overage", label: "Weight overage" },
  { value: "damage", label: "Damage" },
  { value: "extra_day", label: "Extra day" },
  { value: "trip_fee", label: "Trip fee" },
  { value: "prohibited_material", label: "Prohibited material" },
  { value: "manual_adjustment", label: "Manual adjustment" },
];

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

function toTelHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `tel:${digits}`;
}

function formatPlainLabel(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function formatTitleLabel(value: string | null | undefined) {
  const label = formatPlainLabel(value);
  if (label === "—") return label;
  return label
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatEnumLabel(value: string | null | undefined) {
  const label = formatPlainLabel(value).trim().toLowerCase();
  if (!label || label === "—") return "—";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatExternalPaymentMethod(value: string | null | undefined) {
  switch (value) {
    case "cash":
      return "Cash";
    case "check":
      return "Check";
    case "square_invoice":
      return "Square invoice";
    case "manually_processed_card":
      return "Manually processed card";
    case "other":
      return "Other";
    default:
      return "External payment";
  }
}

function isExternalPayment(payment: BookingPaymentSummary | null | undefined) {
  return payment?.payment_collection_type === "external" || payment?.provider === "external";
}

function formatDollarsInput(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

function getTodayDateInputValue() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function paymentStatusClasses(status: string | null | undefined) {
  switch (status) {
    case "paid":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "pending":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "failed":
    case "canceled":
    case "cancelled":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "refunded":
    case "partially_refunded":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "unpaid":
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
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

function formatHistoryFieldLabel(fieldName: string) {
  if (fieldName === "status") return "Booking status change";
  if (fieldName === "booking_charge_status") return "Charge status change";
  if (fieldName === "external_charge_payment") return "External payment recorded";
  if (fieldName === "booking_created") return "Booking created";
  if (fieldName === "access_issues") return "Access issues";
  if (fieldName === "delivery_presence") return "Delivery presence";
  if (fieldName === "placement_preference") return "Placement preference";
  if (fieldName === "portal_status") return "Portal status";
  return formatEnumLabel(fieldName);
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

function isAccessIssue(value: string): value is AccessIssue {
  return (ACCESS_ISSUES as readonly string[]).includes(value);
}

function isDeliveryPresence(value: string): value is DeliveryPresence {
  return (DELIVERY_PRESENCE_OPTIONS as readonly string[]).includes(value);
}

function isPlacementPreference(value: string): value is PlacementPreference {
  return (PLACEMENT_PREFERENCES as readonly string[]).includes(value);
}

function formatHistoryPrimitive(fieldName: string, value: unknown): string {
  if (value == null || value === "") return "—";

  if (fieldName === "amountCents") {
    return Number.isFinite(Number(value)) ? formatUsdFromCents(Number(value)) : String(value).trim();
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);

  const stringValue = String(value).trim();
  if (!stringValue) return "—";

  switch (fieldName) {
    case "access_issues":
      return isAccessIssue(stringValue) ? getAccessIssueLabel(stringValue) : stringValue;
    case "delivery_presence":
      return isDeliveryPresence(stringValue) ? getDeliveryPresenceLabel(stringValue) : stringValue;
    case "placement_preference":
      return isPlacementPreference(stringValue) ? getPlacementPreferenceLabel(stringValue) : stringValue;
    case "portal_status":
    case "status":
    case "booking_charge_status":
    case "pickup_mode":
    case "payment_status":
    case "provider":
    case "provider_environment":
    case "charge_type":
    case "externalPaymentMethod":
      return formatEnumLabel(stringValue);
    case "delivery_date":
    case "pickup_date":
    case "paymentDate":
      return /^\d{4}-\d{2}-\d{2}$/.test(stringValue) ? formatDate(stringValue) : stringValue;
    default:
      return stringValue;
  }
}

function formatExternalChargePaymentHistory(rawValue: string | null) {
  if (!rawValue) return "—";
  const parsed = tryParseHistoryValue(rawValue);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return formatHistoryPrimitive("external_charge_payment", parsed);
  }

  const value = parsed as Record<string, unknown>;
  const amountValue = value.amountCents ?? value.amount_cents ?? value.amount;
  const amount = formatHistoryPrimitive("amountCents", amountValue);
  const paymentDate = formatHistoryPrimitive("paymentDate", value.paymentDate);
  const method = formatExternalPaymentMethod(String(value.externalPaymentMethod ?? ""));
  return `Amount: ${amount} · Payment date: ${paymentDate} · Method: ${method}`;
}

function formatHistoryValue(fieldName: string, rawValue: string | null) {
  if (!rawValue) return "—";
  if (fieldName === "external_charge_payment") return formatExternalChargePaymentHistory(rawValue);

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

type AdminNoteEntry = {
  id: string;
  author: string;
  body: string;
  createdAt: string | null;
};

function parseAdminNotes(rawNotes: string | null, fallbackCreatedAt: string): AdminNoteEntry[] {
  const raw = rawNotes?.trim();
  if (!raw) return [];

  return raw
    .split(/\n\n---\n\n/g)
    .map((entry, index) => {
      const match = entry.match(/^\[([^\]]+)\] ([^\n]+)\n([\s\S]*)$/);
      if (!match) {
        return {
          id: `legacy-${index}`,
          author: "Admin",
          body: entry.trim(),
          createdAt: fallbackCreatedAt,
        };
      }

      return {
        id: `${match[1]}-${index}`,
        author: match[2],
        body: match[3].trim(),
        createdAt: match[1],
      };
    })
    .filter((entry) => entry.body)
    .reverse();
}

function Section({
  title,
  description,
  icon,
  hideHeaderDivider,
  lightHeader,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  hideHeaderDivider?: boolean;
  lightHeader?: boolean;
  children: React.ReactNode;
}) {
  const headerTitleClassName = hideHeaderDivider
    ? "text-[15px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]"
    : "text-base font-semibold text-slate-900";
  const iconContainerClassName = hideHeaderDivider
    ? "inline-flex h-9 w-9 items-center justify-center rounded-[14px] bg-slate-100 text-slate-600"
    : "inline-flex h-8 w-8 items-center justify-center rounded-[14px] bg-slate-100 text-slate-600";

  return (
    <section className="rounded-[14px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
      {lightHeader ? (
        <h2 className="mb-3 text-[13px] font-medium uppercase tracking-[0.07em] text-[var(--text-secondary)]">{title}</h2>
      ) : (
        <div className={hideHeaderDivider ? "mb-6" : "mb-6 border-b border-slate-200 pb-4"}>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2">
            {icon ? (
              <span className={iconContainerClassName}>
                {icon}
              </span>
            ) : (
              <span />
            )}

            <h2 className={headerTitleClassName}>{title}</h2>

            {description ? (
              <p className="col-start-2 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
        </div>
      )}
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

function getLatestConsent(consents: BookingConsentSummary[], consentType: BookingConsentSummary["consent_type"]) {
  return consents.find((consent) => consent.consent_type === consentType) ?? null;
}

function getSavedPaymentMethod(paymentMethods: CustomerPaymentMethodSummary[]) {
  return (
    paymentMethods.find((method) => method.status === "active") ??
    paymentMethods[0] ??
    null
  );
}

function formatCardExpiration(method: CustomerPaymentMethodSummary | null) {
  if (!method?.card_exp_month || !method.card_exp_year) return "—";
  return `${String(method.card_exp_month).padStart(2, "0")}/${method.card_exp_year}`;
}

function formatSavedCardLabel(method: CustomerPaymentMethodSummary | null) {
  if (!method) return "—";
  const brand = method.card_brand ? formatPlainLabel(method.card_brand) : "Card";
  const last4 = method.card_last_4 ? ` ending ${method.card_last_4}` : "";
  return `${brand}${last4}`;
}

function getBookingChargeTypeLabel(chargeType: string | null | undefined) {
  return BOOKING_CHARGE_TYPE_OPTIONS.find((option) => option.value === chargeType)?.label ?? formatTitleLabel(chargeType);
}

function chargeStatusClasses(status: string | null | undefined) {
  switch (status) {
    case "draft":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "paid":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "failed":
    case "canceled":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "waived":
    case "refunded":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "pending":
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function getBookingChargeStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "draft":
      return "Needs approval";
    case "pending":
      return "Ready to charge";
    case "paid":
      return "Paid";
    case "failed":
      return "Failed";
    case "waived":
      return "Waived";
    case "canceled":
      return "Canceled";
    case "refunded":
      return "Refunded";
    default:
      return formatTitleLabel(status);
  }
}

function getCustomerReceiptStatusLabel(charge: BookingChargeSummary) {
  switch (charge.customer_receipt_email_status) {
    case "queued":
      return "Customer receipt queued";
    case "sent":
      return `Customer receipt sent ${
        charge.customer_receipt_email_sent_at ? formatDateTime(charge.customer_receipt_email_sent_at) : ""
      }`.trim();
    case "failed":
      return `Customer receipt failed${
        charge.customer_receipt_email_error ? ` - ${charge.customer_receipt_email_error}` : ""
      }`;
    case "not_applicable":
      return `Customer receipt not sent${
        charge.customer_receipt_email_error ? ` - ${charge.customer_receipt_email_error}` : ""
      }`;
    default:
      return "Customer receipt not queued yet";
  }
}

function customerReceiptStatusClasses(status: BookingChargeSummary["customer_receipt_email_status"]) {
  switch (status) {
    case "sent":
      return "text-emerald-700";
    case "failed":
      return "text-rose-700";
    case "queued":
      return "text-amber-700";
    case "not_applicable":
      return "text-slate-500";
    default:
      return "text-slate-500";
  }
}

function AuditHistoryCard({
  title,
  beforeValue,
  afterValue,
  changedAt,
  userLabel = "Admin",
}: {
  title: string;
  beforeValue?: string;
  afterValue?: string;
  changedAt: string;
  userLabel?: string;
}) {
  const showChangeValues = beforeValue !== undefined || afterValue !== undefined;

  return (
    <div className="min-w-0 rounded-[14px] border border-slate-200 bg-slate-50/70 px-4 py-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-3 space-y-1 text-sm text-slate-600">
        <div className="min-w-0">
          <span className="font-medium text-slate-500">Change date:</span>{" "}
          <span className="whitespace-normal break-words">{formatDateTime(changedAt)}</span>
        </div>
        <div>
          <span className="font-medium text-slate-500">User:</span> {userLabel}
        </div>
      </div>
      {showChangeValues ? (
        <>
          <div className="my-3 border-t border-slate-200" />
          <div className="space-y-2 text-sm text-slate-600">
            <div className="min-w-0">
              <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Before:</span>
              <span className="whitespace-normal break-words">{beforeValue ?? "—"}</span>
            </div>
            <div className="min-w-0">
              <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-slate-400">After:</span>
              <span className="whitespace-normal break-words">{afterValue ?? "—"}</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function normalizeAdminNoteAuthor(author: string) {
  return author.trim().toLowerCase() === "admin" ? "Admin" : author;
}

function compareAuditDates(left: { changedAt: string }, right: { changedAt: string }) {
  return new Date(right.changedAt).getTime() - new Date(left.changedAt).getTime();
}

function getAuthorizationAuditEntries({
  rentalTermsConsent,
  cardOnFileConsent,
}: {
  rentalTermsConsent: BookingConsentSummary | null;
  cardOnFileConsent: BookingConsentSummary | null;
}) {
  const entries: Array<{
    id: string;
    title: string;
    changedAt: string;
    userLabel: string;
    beforeValue?: string;
    afterValue?: string;
  }> = [];

  if (rentalTermsConsent) {
    entries.push({
      id: `authorization-${rentalTermsConsent.id}`,
      title: "Rental terms accepted",
      changedAt: rentalTermsConsent.accepted_at,
      userLabel: "Customer",
    });
  }

  if (cardOnFileConsent) {
    entries.push({
      id: `authorization-${cardOnFileConsent.id}`,
      title: "Card-on-file authorization accepted",
      changedAt: cardOnFileConsent.accepted_at,
      userLabel: "Customer",
    });
  }

  return entries;
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
    case "charge":
      return "Charge saved for approval.";
    case "charge-ready":
      return "Charge marked ready to charge.";
    case "charge-paid":
      return "Payment request submitted to Square.";
    default:
      return null;
  }
}

function getChargeSuccessMessage(saved: string | undefined) {
  if (saved === "charge-paid") return "Payment request submitted to Square.";
  if (saved === "charge") return "Charge saved for approval.";
  if (saved === "charge-ready") return "Charge marked ready to charge.";
  return null;
}

type BookingProgressStepState = "done" | "active" | "overdue" | "pending";
type BookingProgressIconName = "check" | "truck" | "arrow-back-up" | "alert-triangle";

type BookingProgressStep = {
  key: "created" | "delivered" | "picked-up";
  title: string;
  state: BookingProgressStepState;
  line: string;
  icon: BookingProgressIconName;
};

function TiCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-icon="ti-check" {...props}>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function TiTruckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-icon="ti-truck" {...props}>
      <path d="M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
      <path d="M17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
      <path d="M5 17H3V6a1 1 0 0 1 1-1h11v12H9" />
      <path d="M15 8h4l3 4v5h-3" />
    </svg>
  );
}

function TiArrowBackUpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-icon="ti-arrow-back-up" {...props}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 1 1 0 10h-1" />
    </svg>
  );
}

function TiAlertTriangleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-icon="ti-alert-triangle" {...props}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 4.3 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

function ProgressStepIcon({ icon, style }: { icon: BookingProgressIconName; style: SVGProps<SVGSVGElement>["style"] }) {
  const iconProps = { style };

  switch (icon) {
    case "check":
      return <TiCheckIcon {...iconProps} />;
    case "truck":
      return <TiTruckIcon {...iconProps} />;
    case "arrow-back-up":
      return <TiArrowBackUpIcon {...iconProps} />;
    case "alert-triangle":
      return <TiAlertTriangleIcon {...iconProps} />;
  }
}

function formatTrackerDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

  return `${date} · ${time}`;
}

function formatScheduledTrackerDate(value: string | null) {
  return value ? formatDate(value) : "Not scheduled";
}

function formatOverdueTrackerDate(value: string | null) {
  return value ? `Was due ${formatDate(value)}` : "Was due";
}

function getActualTrackerDateTime(value: string | null, fallback: string) {
  return value ? formatTrackerDateTime(value) : fallback;
}

function getSummaryPickupDateDisplay({
  status,
  pickedUpAt,
  scheduledPickupDate,
  todayYmd,
}: {
  status: BookingStatus;
  pickedUpAt: string | null;
  scheduledPickupDate: string | null;
  todayYmd: string;
}) {
  if (status === "picked_up") {
    return {
      className: "text-slate-900",
      value: pickedUpAt ? formatShortDateET(pickedUpAt) : "—",
    };
  }

  if (status === "delivered" && scheduledPickupDate && scheduledPickupDate < todayYmd) {
    return {
      className: "text-rose-700",
      value: `Was due ${formatDate(scheduledPickupDate)}`,
    };
  }

  return {
    className: "text-slate-900",
    value: scheduledPickupDate ? formatDate(scheduledPickupDate) : "—",
  };
}

function getBookingProgressSteps({
  booking,
  deliveredAt,
  pickedUpAt,
  isOverdueDelivery,
  isOverduePickup,
  scheduledPickupDate,
  expectedPickupDate,
}: {
  booking: Pick<Booking, "created_at" | "delivery_date" | "pickup_date" | "status">;
  deliveredAt: string | null;
  pickedUpAt: string | null;
  isOverdueDelivery: boolean;
  isOverduePickup: boolean;
  scheduledPickupDate: string | null;
  expectedPickupDate: string | null;
}): BookingProgressStep[] {
  const isAwaitingDelivery = booking.status === "confirmed" || booking.status === "scheduled";
  const isDelivered = booking.status === "delivered";
  const isComplete = booking.status === "picked_up";
  const pickupDueDate = scheduledPickupDate ?? expectedPickupDate ?? booking.pickup_date;

  const deliveryState: BookingProgressStepState =
    isComplete || isDelivered
      ? "done"
      : isAwaitingDelivery && isOverdueDelivery
        ? "overdue"
        : isAwaitingDelivery
          ? "active"
          : "pending";
  const pickupState: BookingProgressStepState =
    isComplete
      ? "done"
      : isDelivered && isOverduePickup
        ? "overdue"
        : isDelivered
          ? "active"
          : "pending";
  const deliveryTitle =
    deliveryState === "done"
      ? "Delivered"
      : deliveryState === "overdue"
        ? "Delivery overdue"
        : "Delivery scheduled";
  const pickupTitle =
    pickupState === "done"
      ? "Picked up"
      : pickupState === "overdue"
        ? "Pickup overdue"
        : "Pickup scheduled";

  return [
    {
      key: "created",
      title: "Booking created",
      state: "done",
      line: formatTrackerDateTime(booking.created_at),
      icon: "check",
    },
    {
      key: "delivered",
      title: deliveryTitle,
      state: deliveryState,
      line:
        deliveryState === "done"
          ? getActualTrackerDateTime(deliveredAt, "Delivery time unavailable")
          : deliveryState === "overdue"
            ? formatOverdueTrackerDate(booking.delivery_date)
            : formatScheduledTrackerDate(booking.delivery_date),
      icon: deliveryState === "done" ? "check" : deliveryState === "overdue" ? "alert-triangle" : "truck",
    },
    {
      key: "picked-up",
      title: pickupTitle,
      state: pickupState,
      line:
        pickupState === "done"
          ? getActualTrackerDateTime(pickedUpAt, "Pickup time unavailable")
          : pickupState === "overdue"
            ? formatOverdueTrackerDate(pickupDueDate)
            : formatScheduledTrackerDate(scheduledPickupDate),
      icon: pickupState === "done" ? "check" : pickupState === "overdue" ? "alert-triangle" : "arrow-back-up",
    },
  ];
}

function BookingProgressTracker({ steps }: { steps: BookingProgressStep[] }) {
  return (
    <section
      aria-label="Booking status tracker"
      style={{
        paddingBottom: "1.25rem",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "flex-start",
          display: "flex",
          padding: "1.25rem 2rem",
          width: "100%",
        }}
      >
        {steps.map((step, index) => {
          const isDone = step.state === "done";
          const isActive = step.state === "active";
          const isOverdue = step.state === "overdue";
          const circleBackground = isDone
            ? "#EAF3DE"
            : isActive
              ? "#E6F1FB"
              : isOverdue
                ? "#FCEBEB"
                : "var(--surface-1, #F8FAFC)";
          const iconColor = isDone
            ? "#27500A"
            : isActive
              ? "#0C447C"
              : isOverdue
                ? "#A32D2D"
                : "var(--text-muted, #64748B)";
          const titleColor = isDone
            ? "#27500A"
            : isActive
              ? "#185FA5"
              : isOverdue
                ? "#A32D2D"
                : "var(--text-muted, #64748B)";
          const dateColor = isDone
            ? "#3B6D11"
            : isOverdue
              ? "#A32D2D"
              : "var(--text-muted, #64748B)";
          const circleBorder = isDone
            ? "1px solid #97C459"
            : isActive
              ? "1px solid #85B7EB"
              : isOverdue
                ? "1px solid #F09595"
                : "1px solid var(--border-strong, #CBD5E1)";

          return (
            <Fragment key={step.key}>
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  flex: "1 1 0",
                  flexDirection: "column",
                  gap: "6px",
                  minWidth: 0,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    background: circleBackground,
                    border: circleBorder,
                    borderRadius: "50%",
                    color: iconColor,
                    display: "flex",
                    flexShrink: 0,
                    height: "44px",
                    justifyContent: "center",
                    maxHeight: "44px",
                    maxWidth: "44px",
                    minHeight: "44px",
                    minWidth: "44px",
                    width: "44px",
                  }}
                >
                  <ProgressStepIcon
                    icon={step.icon}
                    style={{
                      display: "block",
                      fontSize: "18px",
                      height: "1em",
                      width: "1em",
                    }}
                  />
                </div>
                <p
                  style={{
                    color: titleColor,
                    fontSize: "13px",
                    fontWeight: 500,
                    margin: 0,
                  }}
                >
                  {step.title}
                </p>
                <p
                  style={{
                    color: dateColor,
                    fontSize: "12px",
                    fontWeight: isOverdue ? 500 : undefined,
                    margin: 0,
                  }}
                >
                  {step.line}
                </p>
              </div>

              {index < steps.length - 1 ? (
                <div
                  aria-hidden="true"
                  style={{
                    alignSelf: "flex-start",
                    background: step.state === "done" ? "#97C459" : "var(--border-strong, #CBD5E1)",
                    flex: "2 1 0",
                    height: "2px",
                    marginBottom: 0,
                    marginLeft: "8px",
                    marginRight: "8px",
                    marginTop: "22px",
                  }}
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

export default async function AdminBookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; placementError?: string; assignmentError?: string; chargeError?: string }>;
}) {
  const { id } = await params;
  const { saved, placementError, assignmentError, chargeError } = await searchParams;

    const bookingSelect = `
      id,
      booking_ref,
      customer_id,
      reordered_from_booking_id,
      created_at,
      customer_first_name,
      customer_last_name,
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
      payment_status,
      paid_at,
      payment_provider,
      payment_provider_payment_id,
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
      customer_first_name,
      customer_last_name,
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
      payment_status,
      paid_at,
      payment_provider,
      payment_provider_payment_id,
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

  const adminSession = await requireAdminOwner();
  const businessId = adminSession.business.id;
  let placementSchemaAvailable = true;

  let { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select(bookingSelect)
    .eq("id", id)
    .eq("business_id", businessId)
    .single<Booking>();

  if (error && isBookingSchemaError(error)) {
    placementSchemaAvailable = false;
    const fallback = await supabaseAdmin
      .from("bookings")
      .select(baseBookingSelect)
      .eq("id", id)
      .eq("business_id", businessId)
      .single<Omit<Booking, keyof typeof EMPTY_BOOKING_PLACEMENT_FIELDS>>();

    booking = fallback.data
      ? ({
          ...fallback.data,
          ...EMPTY_BOOKING_PLACEMENT_FIELDS,
        } as Booking)
      : null;
    error = fallback.error;
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
    latestBookingPaymentsResultRaw,
    bookingChargesResult,
    bookingChargePaymentsResultRaw,
    bookingConsentsResult,
    customerPaymentMethodsResult,
  ] = await Promise.all([
	    booking.reordered_from_booking_id
	      ? supabaseAdmin
	          .from("bookings")
	          .select("id, booking_ref, customer_first_name, customer_last_name, customer_street, customer_city, customer_zip, delivery_date, created_at")
	          .eq("id", booking.reordered_from_booking_id)
            .eq("business_id", businessId)
	          .maybeSingle<BookingRelationshipSummary>()
      : Promise.resolve({ data: null, error: null }),
    booking.customer_id
      ? supabaseAdmin
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("customer_id", booking.customer_id)
          .neq("id", booking.id)
      : Promise.resolve({ count: null, error: null }),
    booking.customer_street && booking.customer_city && booking.customer_zip
      ? supabaseAdmin
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("customer_street", booking.customer_street)
          .eq("customer_city", booking.customer_city)
          .eq("customer_zip", booking.customer_zip)
          .neq("id", booking.id)
      : Promise.resolve({ count: null, error: null }),
	    supabaseAdmin
	      .from("bookings")
	      .select("id, booking_ref, customer_first_name, customer_last_name, delivery_date, created_at", { count: "exact" })
        .eq("business_id", businessId)
	      .eq("reordered_from_booking_id", booking.id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("entity_history")
      .select("id, field_name, old_value, new_value, changed_by_type, change_reason, created_at")
      .eq("business_id", businessId)
      .eq("entity_type", "booking")
      .eq("entity_id", booking.id)
      .order("created_at", { ascending: false })
      .limit(20),
    booking.customer_id
      ? supabaseAdmin
          .from("customers")
          .select("id, name, email, phone, portal_status")
          .eq("id", booking.customer_id)
          .eq("business_id", businessId)
          .maybeSingle<LinkedCustomer>()
      : Promise.resolve({ data: null, error: null }),
    booking.customer_id
      ? supabaseAdmin
          .from("entity_history")
          .select("id, field_name, old_value, new_value, changed_by_type, change_reason, created_at")
          .eq("business_id", businessId)
          .eq("entity_type", "customer")
          .eq("entity_id", booking.customer_id)
          .in("field_name", ["email", "name", "phone", "portal_status"])
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin
      .from("booking_payments")
      .select("id, provider, provider_environment, status, amount_cents, currency, provider_payment_id, provider_location_id, failure_code, failure_message, raw_provider_response, paid_at, failed_at, payment_collection_type, external_payment_method, external_reference, external_notes, external_recorded_at, created_at")
      .eq("business_id", businessId)
      .eq("booking_id", booking.id)
      .is("booking_charge_id", null)
      .order("created_at", { ascending: false })
      .limit(50),
    loadAdminBookingCharges({
      supabase: supabaseAdmin as never,
      businessId,
      bookingId: booking.id,
    }),
    supabaseAdmin
      .from("booking_payments")
      .select("id, booking_charge_id, provider, provider_environment, status, amount_cents, currency, provider_payment_id, provider_location_id, failure_code, failure_message, raw_provider_response, paid_at, failed_at, payment_collection_type, external_payment_method, external_reference, external_notes, external_recorded_at, created_at")
      .eq("business_id", businessId)
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("booking_consents")
      .select("id, consent_type, consent_version, accepted_at, created_at")
      .eq("business_id", businessId)
      .eq("booking_id", booking.id)
      .order("accepted_at", { ascending: false }),
    booking.customer_id
      ? supabaseAdmin
          .from("customer_payment_methods")
          .select("id, business_id, customer_id, provider, provider_environment, provider_customer_id, provider_payment_method_id, card_brand, card_last_4, card_exp_month, card_exp_year, status, created_at")
          .eq("business_id", businessId)
          .eq("customer_id", booking.customer_id)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null }),
  ]);

  let latestBookingPaymentsResult: {
    data: unknown[] | null;
    error: { message?: string | null } | null;
  } = latestBookingPaymentsResultRaw;
  if (latestBookingPaymentsResultRaw.error && isBookingSchemaError(latestBookingPaymentsResultRaw.error)) {
    latestBookingPaymentsResult = await supabaseAdmin
      .from("booking_payments")
      .select("id, provider, provider_environment, status, amount_cents, currency, provider_payment_id, provider_location_id, failure_code, failure_message, raw_provider_response, paid_at, failed_at, created_at")
      .eq("business_id", businessId)
      .eq("booking_id", booking.id)
      .is("booking_charge_id", null)
      .order("created_at", { ascending: false })
      .limit(50);
  }

  let bookingChargePaymentsResult: {
    data: unknown[] | null;
    error: { message?: string | null } | null;
  } = bookingChargePaymentsResultRaw;
  if (bookingChargePaymentsResultRaw.error && isBookingSchemaError(bookingChargePaymentsResultRaw.error)) {
    bookingChargePaymentsResult = await supabaseAdmin
      .from("booking_payments")
      .select("id, booking_charge_id, provider, provider_environment, status, amount_cents, currency, provider_payment_id, provider_location_id, failure_code, failure_message, raw_provider_response, paid_at, failed_at, created_at")
      .eq("business_id", businessId)
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false })
      .limit(50);
  }

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
  if (latestBookingPaymentsResult.error && !isBookingSchemaError(latestBookingPaymentsResult.error)) {
    throw new Error(latestBookingPaymentsResult.error.message ?? "Unable to load booking payments.");
  }
  if (bookingChargesResult.error && !isBookingSchemaError(bookingChargesResult.error)) {
    throw new Error(bookingChargesResult.error.message);
  }
  if (bookingChargePaymentsResult.error && !isBookingSchemaError(bookingChargePaymentsResult.error)) {
    throw new Error(bookingChargePaymentsResult.error.message ?? "Unable to load booking charge payments.");
  }
  if (bookingConsentsResult.error && !isBookingSchemaError(bookingConsentsResult.error)) {
    throw new Error(bookingConsentsResult.error.message);
  }
  if (customerPaymentMethodsResult.error && !isBookingSchemaError(customerPaymentMethodsResult.error)) {
    throw new Error(customerPaymentMethodsResult.error.message);
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
	        | Pick<
	            BookingRelationshipSummary,
	            "id" | "booking_ref" | "customer_first_name" | "customer_last_name" | "delivery_date" | "created_at"
	          >
	        | undefined
	        | null);
  const bookingHistory = isBookingSchemaError(historyResult.error) ? [] : (historyResult.data ?? []);
  const linkedCustomer = isBookingSchemaError(linkedCustomerResult.error)
    ? null
    : ((linkedCustomerResult.data ?? null) as LinkedCustomer | null);
  const linkedCustomerHistory = isBookingSchemaError(linkedCustomerHistoryResult.error)
    ? []
    : ((linkedCustomerHistoryResult.data ?? []) as CustomerHistoryEntry[]);
  const adminNoteEntries = parseAdminNotes(booking.notes, booking.created_at ?? new Date().toISOString());
  const initialBookingPayments = isBookingSchemaError(latestBookingPaymentsResult.error)
    ? []
    : ((latestBookingPaymentsResult.data ?? []) as BookingPaymentSummary[]);
  const latestBookingPayment = initialBookingPayments[0] ?? null;
  const successfulInitialBookingPayment = isBookingSchemaError(latestBookingPaymentsResult.error)
    ? null
    : (initialBookingPayments.find((payment) => payment.status === "paid") ?? null);
  const bookingCharges = isBookingSchemaError(bookingChargesResult.error)
    ? []
    : ((bookingChargesResult.data ?? []) as BookingChargeSummary[]);
  const bookingChargePayments = isBookingSchemaError(bookingChargePaymentsResult.error)
    ? []
    : ((bookingChargePaymentsResult.data ?? []) as BookingPaymentSummary[]).filter(
        (payment) => payment.booking_charge_id,
      );
  const bookingConsents = isBookingSchemaError(bookingConsentsResult.error)
    ? []
    : ((bookingConsentsResult.data ?? []) as BookingConsentSummary[]);
  const customerPaymentMethods = isBookingSchemaError(customerPaymentMethodsResult.error)
    ? []
    : ((customerPaymentMethodsResult.data ?? []) as CustomerPaymentMethodSummary[]);
  const currentProviderEnvironment = process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
  const latestChargePaymentByChargeId = new Map<string, BookingPaymentSummary>();
  for (const payment of bookingChargePayments) {
    if (payment.booking_charge_id && !latestChargePaymentByChargeId.has(payment.booking_charge_id)) {
      latestChargePaymentByChargeId.set(payment.booking_charge_id, payment);
    }
  }
  const paymentMethodById = new Map(customerPaymentMethods.map((method) => [method.id, method]));
  const rentalTermsConsent = getLatestConsent(bookingConsents, "rental_terms");
  const cardOnFileConsent = getLatestConsent(bookingConsents, "card_on_file");
  const authorizationAuditEntries = getAuthorizationAuditEntries({
    rentalTermsConsent,
    cardOnFileConsent,
  });
  const primaryAuditEntries = [
    ...(bookingHistory as BookingHistoryEntry[]).map((entry) => ({
      id: entry.id,
      title: formatHistoryFieldLabel(String(entry.field_name)),
      beforeValue: formatHistoryValue(entry.field_name, entry.old_value),
      afterValue: formatHistoryValue(entry.field_name, entry.new_value),
      changedAt: entry.created_at,
      userLabel: "Admin",
    })),
    ...authorizationAuditEntries,
  ].sort(compareAuditDates);
  const auditHistoryCount = primaryAuditEntries.length + linkedCustomerHistory.length;
  const savedPaymentMethod = getSavedPaymentMethod(customerPaymentMethods);
  const usableSavedPaymentMethod =
    customerPaymentMethods.find((method) => {
      const validation = validateUsableSavedPaymentMethod(method, {
        businessId,
        customerId: booking.customer_id,
        provider: "square",
        providerEnvironment: currentProviderEnvironment,
      });

      return validation.ok;
    }) ?? null;
  const displayedSavedPaymentMethod = usableSavedPaymentMethod ?? savedPaymentMethod;
  const squarePaymentId =
    booking.payment_provider_payment_id ??
    successfulInitialBookingPayment?.provider_payment_id ??
    latestBookingPayment?.provider_payment_id ??
    null;
  const cardOnFileConsentAccepted = Boolean(cardOnFileConsent);
  const savedCardAvailable = Boolean(usableSavedPaymentMethod);
  const savedCardChargeReady = savedCardAvailable && cardOnFileConsentAccepted;
  const savedCardChargeActionLabel = !cardOnFileConsentAccepted
    ? "Authorization not available"
    : savedCardAvailable
      ? "Approve & charge saved card"
      : "No saved card available";
  const savedCardChargeSupport = !cardOnFileConsentAccepted
    ? "The customer did not authorize post-rental card charges."
    : savedCardAvailable
      ? "This will charge the customer's saved card immediately."
      : "This charge cannot be processed until a payment method is available.";
  const successfulPaymentRecorded =
    booking.payment_status === "paid" || Boolean(successfulInitialBookingPayment);
  const paidAt = successfulInitialBookingPayment?.paid_at ?? booking.paid_at ?? null;
  const paidAmountCents =
    successfulInitialBookingPayment?.amount_cents ?? booking.total_price_cents;
  const paymentProvider =
    successfulInitialBookingPayment?.provider ?? booking.payment_provider ?? latestBookingPayment?.provider ?? null;
  const initialPaymentStatus = successfulInitialBookingPayment?.status ?? latestBookingPayment?.status ?? booking.payment_status;
  const initialPaymentAmountCents =
    successfulInitialBookingPayment?.amount_cents ?? latestBookingPayment?.amount_cents ?? booking.total_price_cents;
  const paidAdditionalChargesCents = bookingCharges.reduce(
    (total, charge) => {
      if (charge.status !== "paid") return total;
      const paidPayment = bookingChargePayments.find(
        (payment) => payment.booking_charge_id === charge.id && payment.status === "paid",
      );
      return total + (paidPayment?.amount_cents ?? charge.amount_cents);
    },
    0,
  );
  const pendingAdditionalChargesCents = bookingCharges.reduce(
    (total, charge) => total + (charge.status === "draft" || charge.status === "pending" ? charge.amount_cents : 0),
    0,
  );
  const totalCollectedCents = (successfulPaymentRecorded ? paidAmountCents ?? 0 : 0) + paidAdditionalChargesCents;
  const hasAdditionalCharges = bookingCharges.length > 0;
  const hasPendingAdditionalCharges = pendingAdditionalChargesCents > 0;
  const hasPaidAdditionalCharges = paidAdditionalChargesCents > 0;
  const paymentOverviewSummary = hasAdditionalCharges
    ? `Total collected: ${formatUsdFromCents(totalCollectedCents)}`
    : successfulPaymentRecorded
      ? `${formatUsdFromCents(paidAmountCents)} paid${paidAt ? ` on ${formatShortDateET(paidAt)}` : ""}`
      : `${formatUsdFromCents(initialPaymentAmountCents)} ${formatTitleLabel(initialPaymentStatus)}`;
  const paymentOverviewBreakdown =
    hasAdditionalCharges && hasPaidAdditionalCharges
      ? `Booking ${formatUsdFromCents(successfulPaymentRecorded ? paidAmountCents : initialPaymentAmountCents)} · Additional ${formatUsdFromCents(paidAdditionalChargesCents)}`
      : null;
  const providerEnvironment =
    successfulInitialBookingPayment?.provider_environment ??
    latestBookingPayment?.provider_environment ??
    savedPaymentMethod?.provider_environment ??
    null;
  const deliveredAt = getLatestStatusTimestamp(bookingHistory, "delivered");
  const pickedUpAt = getLatestStatusTimestamp(bookingHistory, "picked_up");
	  const accountNameDiffers =
	    !!linkedCustomer?.name &&
	    !!combineCustomerNameParts(booking.customer_first_name, booking.customer_last_name) &&
	    linkedCustomer.name.trim() !== combineCustomerNameParts(booking.customer_first_name, booking.customer_last_name);
  const todayYmd = todayISO();

  const futureDependencyDatesResult = await supabaseAdmin
    .from("bookings")
    .select("id, delivery_date")
    .in("status", ["confirmed", "scheduled"])
    .gte("delivery_date", todayYmd)
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
    businessId: adminSession.business.id,
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
  const hasPlacementPreference = Boolean(placement.placementPreference);
  const hasPlacementDetails = Boolean(placement.placementDetails);
  const hasAccessIssues = placement.accessIssues.length > 0;
  const hasGateInstructions = Boolean(placement.gateInstructions);
  const hasDeliveryPresence = Boolean(placement.deliveryPresence);
  const hasAlternateContact = Boolean(placement.alternateContactName || placement.alternateContactPhone);
  const hasDeliveryPhoto = Boolean(placement.placementPhotoUrl);
  const hasSpecialInstructions = Boolean(placement.specialDeliveryInstructions?.trim());
  const hasPlacementDetailRows =
    hasPlacementPreference ||
    hasPlacementDetails ||
    hasAccessIssues ||
    hasGateInstructions ||
    hasDeliveryPresence ||
    hasAlternateContact ||
    hasSpecialInstructions;
  const savedMessage = getSavedMessage(saved);
  const chargeSuccessMessage = getChargeSuccessMessage(saved);
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
          : formatEnumLabel(booking.status);
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
    todayYmd,
  });
  const bookingProgressSteps = getBookingProgressSteps({
    booking,
    deliveredAt,
    pickedUpAt,
    isOverdueDelivery: attentionState.isOverdueConfirmed,
    isOverduePickup: attentionState.isOverduePickup,
    scheduledPickupDate: pickupPlanning.scheduledPickupDate,
    expectedPickupDate: pickupPlanning.expectedAvailableDate,
  });
  const summaryPickupDate = getSummaryPickupDateDisplay({
    status: booking.status,
    pickedUpAt,
    scheduledPickupDate: pickupPlanning.scheduledPickupDate,
    todayYmd,
  });

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

      <BookingProgressTracker steps={bookingProgressSteps} />

      <div className="rounded-[20px] bg-white px-6 py-6 shadow-xl ring-1 ring-slate-200/70 sm:px-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {getCustomerFacingBookingLabel(booking.booking_ref)}
                </h1>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(
                    booking.status
                  )}`}
                >
                  {formatEnumLabel(booking.status)}
                </span>
                {booking.reordered_from_booking_id ? (
                  <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-200">
                    Reorder
                  </span>
                ) : null}
                {attentionState.isOverdueConfirmed ? (
                  <span
                    className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      background: "#EEEDFE",
                      border: "0.5px solid #534AB7",
                      color: "#534AB7",
                    }}
                  >
                    Delivery overdue
                  </span>
                ) : attentionState.isOverduePickup ? (
                  <span
                    className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      background: "#FCEBEB",
                      border: "0.5px solid #F09595",
                      color: "#A32D2D",
                    }}
                  >
                    Pickup overdue
                  </span>
                ) : null}
              </div>

              <div className="mt-2 text-[11px] text-slate-500">
                Internal UUID: <span className="font-mono break-all">{booking.id}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {canMarkDelivered ? (
                <form action={quickMarkDeliveredAction}>
                  <input type="hidden" name="id" value={booking.id} />
                  <FormSubmitButton
                    loadingLabel="Marking delivered..."
                    className={STATUS_ACTION_BUTTON_CLASS}
                  >
                    Mark delivered
                  </FormSubmitButton>
                </form>
              ) : null}

              {canSchedulePickup ? (
                <Link
                  href="#pickup"
                  className="admin-btn admin-btn-secondary"
                >
                  Schedule pickup
                </Link>
              ) : null}

              {canMarkPickedUp ? (
                <form action={quickMarkPickedUpAction}>
                  <input type="hidden" name="id" value={booking.id} />
                  <FormSubmitButton
                    loadingLabel="Marking picked up..."
                    className={STATUS_ACTION_BUTTON_CLASS}
                  >
                    Mark picked up
                  </FormSubmitButton>
                </form>
              ) : null}

              {canCancel ? (
                <form action={quickCancelBookingAction}>
                  <input type="hidden" name="id" value={booking.id} />
                  <FormSubmitButton
                    loadingLabel="Cancelling..."
                    className="admin-btn admin-btn-destructive"
                    style={{ border: "0.5px solid #F09595" }}
                  >
                    Cancel booking
                  </FormSubmitButton>
                </form>
              ) : null}
            </div>
          </div>

          {attentionState.needsAttention && attentionState.rowAlertSummary ? (
            <div className="rounded-[14px] border border-amber-200 bg-amber-50/70 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Needs attention</div>
              <div className="mt-1 text-sm text-slate-700">
                {attentionState.rowAlertSummary.charAt(0).toUpperCase()}
                {attentionState.rowAlertSummary.slice(1)}.
              </div>
            </div>
          ) : null}

          <div
            className="mt-4 grid min-w-0"
            style={{
              border: "0.5px solid var(--border)",
              borderRadius: "4px",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
              overflow: "hidden",
            }}
          >
            <div
              className="min-w-0"
              style={{
                borderRight: "0.5px solid var(--border)",
                padding: "0.85rem 1rem",
              }}
            >
              <div className="flex items-center justify-between gap-3" style={{ marginBottom: "0.4rem" }}>
                <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--text-secondary)]">
                  Customer
                </div>
                {priorCustomerBookingCount > 0 ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                      Repeat customer
                    </span>
                    <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                      {priorCustomerBookingCount} prior rental{priorCustomerBookingCount === 1 ? "" : "s"}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="text-sm font-medium text-[var(--text-primary)]" style={{ marginBottom: "6px" }}>
                {formatCustomerName(booking.customer_first_name, booking.customer_last_name)}
              </div>
              {booking.customer_email ? (
                <a
                  href={`mailto:${booking.customer_email}`}
                  className="flex min-w-0 items-center gap-2 text-xs text-[var(--text-secondary)] hover:underline"
                  style={{ marginBottom: "5px" }}
                >
                  <EnvelopeIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 break-all">{booking.customer_email}</span>
                </a>
              ) : (
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]" style={{ marginBottom: "5px" }}>
                  <EnvelopeIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>—</span>
                </div>
              )}
              {booking.customer_phone ? (
                <a
                  href={toTelHref(booking.customer_phone)}
                  className="flex min-w-0 items-center gap-2 text-xs text-[var(--text-secondary)] hover:underline"
                  style={{ marginBottom: "8px" }}
                >
                  <PhoneIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0">{booking.customer_phone}</span>
                </a>
              ) : (
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]" style={{ marginBottom: "8px" }}>
                  <PhoneIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>—</span>
                </div>
              )}

              <div style={{ height: "0.5px", background: "var(--border)", margin: "0.7rem 0" }} />

              <div className="flex items-center justify-between gap-3" style={{ marginBottom: "0.4rem" }}>
                <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--text-secondary)]">
                  Delivery address
                </div>
                {hasAccessIssues || hasSpecialInstructions ? (
                  <div className="flex flex-wrap justify-end gap-1">
                    {hasAccessIssues ? (
                      <Link
                        href="#placement-access-issues"
                        className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-100"
                      >
                        Access issues noted
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
              <div className="min-w-0">
                <div className="text-[13px] font-normal text-[var(--text-primary)]">
                  {booking.customer_street || "—"}
                </div>
                <div className="text-[13px] font-normal text-[var(--text-secondary)]">
                  {[booking.customer_city, booking.customer_zip].filter(Boolean).join(", ") || "—"}
                </div>
              </div>
              {hasDeliveryPhoto ? (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="#placement-delivery-photo"
                    className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 ring-1 ring-sky-200 transition hover:bg-sky-100"
                  >
                    Delivery photo available
                  </Link>
                </div>
              ) : null}
            </div>

            <div
              className="min-w-0"
              style={{
                padding: "0.85rem 1rem",
              }}
            >
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--text-secondary)]" style={{ marginBottom: "0.4rem" }}>
                  Current state
                </div>
                <div className="text-[13px] font-medium text-[var(--text-primary)]">
                  {currentOperationalState}
                </div>
              </div>
              <div style={{ height: "0.5px", background: "var(--border)", margin: "0.7rem 0" }} />
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--text-secondary)]" style={{ marginBottom: "0.4rem" }}>
                  Next likely action
                </div>
                <div className="text-[13px] font-medium text-[var(--text-primary)]">
                  {nextActionLabel}
                </div>
              </div>
              <div style={{ height: "0.5px", background: "var(--border)", margin: "0.7rem 0" }} />
              <div className="grid grid-cols-4 gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--text-secondary)]" style={{ marginBottom: "2px" }}>
                    Created
                  </div>
                  <div className="text-[13px] font-normal text-[var(--text-primary)]">
                    {formatDate(booking.created_at?.slice(0, 10) ?? null)}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--text-secondary)]" style={{ marginBottom: "2px" }}>
                    Delivery date
                  </div>
                  <div className="text-[13px] font-normal text-[var(--text-primary)]">
                    {formatDate(booking.delivery_date)}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--text-secondary)]" style={{ marginBottom: "2px" }}>
                    Pickup date
                  </div>
                  <div className={`text-[13px] font-normal ${summaryPickupDate.className === "text-rose-700" ? "text-rose-700" : "text-[var(--text-primary)]"}`}>
                    {summaryPickupDate.value}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--text-secondary)]" style={{ marginBottom: "2px" }}>
                    Dumpster
                  </div>
                  <div className="text-[13px] font-normal text-[var(--text-primary)]">
                    {booking.dumpster_size || "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {linkedCustomer && accountNameDiffers ? (
            <div className="text-xs text-[var(--text-secondary)]" style={{ paddingTop: "0.75rem" }}>
              Other names associated with this account:{" "}
              <span>
                <span className="font-medium text-[var(--text-primary)]">{linkedCustomer.name}</span>
                {" · "}
                <Link
                  href={`/admin/customers/${encodeURIComponent(linkedCustomer.id)}`}
                  className="inline-flex items-center gap-1 text-[var(--text-accent)] underline"
                >
                  View customer
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    data-icon="ti-arrow-up-right"
                    style={{ fontSize: "11px", height: "1em", width: "1em" }}
                  >
                    <path d="M17 7 7 17" />
                    <path d="M8 7h9v9" />
                  </svg>
                </Link>
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {SHOW_PLANNED_DUMPSTER_SECTION ? (
        <div id="assigned-dumpster">
          <Section
            title="Planned dumpster"
            description="Optional dispatch assignment for a specific dumpster record. This does not change pooled customer availability."
            icon={<TruckIcon className="h-4 w-4" />}
          >
            {assignmentError ? (
              <div className="mb-5 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {assignmentError}
              </div>
            ) : null}

            {!booking.dumpster_size || !booking.delivery_date ? (
              <div className="rounded-[14px] border border-dashed border-slate-200 bg-slate-50 px-5 py-5 text-sm text-slate-500">
                Save a dumpster size and delivery date on the booking before planning a specific unit.
              </div>
            ) : (
              <form action={updateAssignedDumpsterAction} className="space-y-5">
                <input type="hidden" name="id" value={booking.id} />

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                  <div className="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-4">
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

                  <div className="rounded-[14px] border border-slate-200 bg-white p-4">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        Planned dumpster
                      </span>
                      <select
                        name="dumpster_id"
                        defaultValue={booking.dumpster_id ?? ""}
                        className="h-12 w-full rounded-[14px] border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                      <div className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-medium text-amber-900">
                        The current planned dumpster is no longer in the compatible pool. You can keep it temporarily or clear it here.
                      </div>
                    ) : null}

                    <div className="mt-4 flex justify-end">
                      <FormSubmitButton
                        loadingLabel="Saving plan..."
                        className={PRIMARY_ACTION_BUTTON_CLASS}
                      >
                        Save plan
                      </FormSubmitButton>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </Section>
        </div>
      ) : null}

      <div id="placement-access">
        <Section
          title="Placement & access"
          icon={<TruckIcon className="h-4 w-4" />}
          hideHeaderDivider
        >
          <div className="space-y-5">
            {!placementSchemaAvailable ? (
              <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Placement & access columns are not available in this database yet, so bookings created here cannot persist or display structured placement details until the latest placement migration is applied and the Supabase schema cache is refreshed.
              </div>
            ) : null}

            {hasPlacementDetailRows ? (
              <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white">
                <div className="divide-y divide-slate-200">
                  {hasPlacementPreference ? (
                    <div className="grid gap-2 px-5 py-4 md:flex md:gap-6">
                      <div className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 md:w-[220px] md:shrink-0">
                        Placement preference
                      </div>
                      <div className="text-sm font-medium text-slate-900">
                        {getPlacementPreferenceLabel(placement.placementPreference)}
                      </div>
                    </div>
                  ) : null}
                  {hasPlacementDetails ? (
                    <div className="grid gap-2 px-5 py-4 md:flex md:gap-6">
                      <div className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 md:w-[220px] md:shrink-0">
                        Exact placement details
                      </div>
                      <div className="text-sm font-medium text-slate-900">
                        {placement.placementDetails}
                      </div>
                    </div>
                  ) : null}
                  {hasAccessIssues ? (
                    <div
                      id="placement-access-issues"
                      className="grid gap-2 px-5 py-4 md:flex md:gap-6"
                    >
                      <div className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-[#854F0B] md:w-[220px] md:shrink-0">
                        Access issues
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          data-icon="ti-alert-triangle"
                          className="shrink-0 text-[#BA7517]"
                          style={{ fontSize: "14px", height: "1em", width: "1em" }}
                        >
                          <path d="M12 9v4" />
                          <path d="M12 17h.01" />
                          <path d="M10.3 4.3 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
                        </svg>
                        <span>{placement.accessIssues.map(getAccessIssueLabel).join(", ")}</span>
                      </div>
                    </div>
                  ) : null}
                  {hasGateInstructions ? (
                    <div className="grid gap-2 px-5 py-4 md:flex md:gap-6">
                      <div className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-[#854F0B] md:w-[220px] md:shrink-0">
                        Gate / access instructions
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          data-icon="ti-alert-triangle"
                          className="shrink-0 text-[#BA7517]"
                          style={{ fontSize: "14px", height: "1em", width: "1em" }}
                        >
                          <path d="M12 9v4" />
                          <path d="M12 17h.01" />
                          <path d="M10.3 4.3 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
                        </svg>
                        <span>{placement.gateInstructions}</span>
                      </div>
                    </div>
                  ) : null}
                  {hasDeliveryPresence ? (
                    <div className="grid gap-2 px-5 py-4 md:flex md:gap-6">
                      <div className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 md:w-[220px] md:shrink-0">
                        Delivery presence
                      </div>
                      <div className="text-sm font-medium text-slate-900">
                        {getDeliveryPresenceLabel(placement.deliveryPresence)}
                      </div>
                    </div>
                  ) : null}
                  {hasAlternateContact ? (
                    <div className="grid gap-2 px-5 py-4 md:flex md:gap-6">
                      <div className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 md:w-[220px] md:shrink-0">
                        Alternate contact
                      </div>
                      <div className="text-sm font-medium text-slate-900">
                        {[placement.alternateContactName, placement.alternateContactPhone].filter(Boolean).join(" • ")}
                      </div>
                    </div>
                  ) : null}
                  {hasSpecialInstructions ? (
                    <div
                      id="placement-special-instructions"
                      className="grid gap-2 px-5 py-4 md:flex md:gap-6"
                    >
                      <div className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 md:w-[220px] md:shrink-0">
                        Special instructions
                      </div>
                      <div className="text-sm font-medium text-slate-900">
                        {placement.specialDeliveryInstructions}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {placement.placementPhotoUrl ? (
              <div id="placement-delivery-photo" className="space-y-3">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Delivery photo</div>
                <a href={placement.placementPhotoUrl} target="_blank" rel="noreferrer">
                  <img
                    src={placement.placementPhotoUrl}
                    alt="Placement area"
                    className="h-64 w-full rounded-[14px] border border-slate-200 object-cover"
                  />
                </a>
              </div>
            ) : null}

          </div>
        </Section>
      </div>

      <Section
        title="Payment"
        icon={<CurrencyDollarIcon className="h-4 w-4" />}
        hideHeaderDivider
      >
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-4">
              <div className="mb-4 flex items-center gap-3">
                {hasPendingAdditionalCharges ? (
                  <span
                    className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      background: "#FAEEDA",
                      border: "0.5px solid #EF9F27",
                      color: "#854F0B",
                    }}
                  >
                    Needs approval
                  </span>
                ) : (
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${paymentStatusClasses(
                      initialPaymentStatus,
                    )}`}
                  >
                    {formatTitleLabel(initialPaymentStatus)}
                  </span>
                )}
              </div>
              <div className="text-slate-900" style={{ fontSize: "16px", fontWeight: 600 }}>
                {paymentOverviewSummary}
              </div>
              {paymentOverviewBreakdown ? (
                <div className="mt-2 text-sm text-slate-500">
                  {paymentOverviewBreakdown}
                </div>
              ) : null}
              {hasPendingAdditionalCharges ? (
                <div className="mt-2 text-[13px] font-medium text-[#854F0B]">
                  + {formatUsdFromCents(pendingAdditionalChargesCents)} pending approval
                </div>
              ) : null}
            </div>

            <div className="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">Saved card</div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                    savedCardAvailable
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-slate-100 text-slate-700 ring-slate-200"
                  }`}
                >
                  {savedCardAvailable ? "Card on file" : "No card"}
                </span>
              </div>
              <div className="text-lg font-semibold text-slate-900">
                {savedCardAvailable ? formatSavedCardLabel(displayedSavedPaymentMethod) : "—"}
              </div>
              <div className="mt-2 text-sm text-slate-600">
                {savedCardAvailable ? `Expires ${formatCardExpiration(displayedSavedPaymentMethod)}` : "No saved card is currently available"}
              </div>
              {savedCardAvailable ? (
                <div className="mt-3 text-sm font-medium text-emerald-700">
                  Available for authorized post-rental charges.
                </div>
              ) : null}
              {cardOnFileConsentAccepted && !savedCardAvailable ? (
                <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                  Card authorization was accepted, but the payment method could not be saved. Post-rental charges cannot be processed until a card is available.
                </div>
              ) : null}
            </div>
          </div>

          <div id="charges-adjustments" className="space-y-5">
            {chargeSuccessMessage ? (
              <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                {chargeSuccessMessage}
              </div>
            ) : null}

            {chargeError ? (
              <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {chargeError}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white">
              <div className="divide-y divide-slate-200">
                <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-900">Initial booking payment</div>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${paymentStatusClasses(
                          latestBookingPayment?.status ?? booking.payment_status,
                        )}`}
                      >
                        {formatTitleLabel(latestBookingPayment?.status ?? booking.payment_status)}
                      </span>
                    </div>
                    {successfulPaymentRecorded ? (
                      <div className="mt-2 text-sm font-medium text-emerald-700">
                        Paid{paidAt ? ` on ${formatDateTime(paidAt)}` : ""}.
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-500">No successful initial payment recorded.</div>
                    )}
                  </div>
                  <div
                    className="text-left text-slate-900 lg:text-right"
                    style={{ fontSize: "16px", fontWeight: 500 }}
                  >
                    {formatUsdFromCents(initialPaymentAmountCents)}
                  </div>
                </div>

                {bookingCharges.map((charge) => {
                  const chargePayment = latestChargePaymentByChargeId.get(charge.id) ?? null;
                  const chargePaymentMethod = charge.customer_payment_method_id
                    ? paymentMethodById.get(charge.customer_payment_method_id) ?? savedPaymentMethod
                    : savedPaymentMethod;
                  const paidAt = charge.paid_at ?? chargePayment?.paid_at ?? null;
                  const failedAt = charge.failed_at ?? chargePayment?.failed_at ?? null;

                  return (
                    <div key={charge.id} className="px-5 py-4">
                      <div
                        style={{
                          alignItems: "flex-start",
                          display: "flex",
                          gap: "16px",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-slate-900">
                              {getBookingChargeTypeLabel(charge.charge_type)}
                            </div>
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${chargeStatusClasses(
                                charge.status,
                              )}`}
                            >
                              {getBookingChargeStatusLabel(charge.status)}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-slate-700">
                            {charge.description || "No description provided."}
                          </div>
                          {charge.evidence_notes ? (
                            <div className="mt-2 text-sm text-slate-500">
                              <span className="font-medium text-slate-600">Notes:</span>{" "}
                              {charge.evidence_notes}
                            </div>
                          ) : null}
                          {charge.status === "paid" ? (
                            <div className="mt-2 space-y-1 text-sm">
                              <div className="font-medium text-emerald-700">
                                Paid{paidAt ? ` on ${formatDateTime(paidAt)}` : ""}.
                              </div>
                              {isExternalPayment(chargePayment) ? (
                                <>
                                  <div className="text-slate-600">
                                    Recorded external payment: {formatExternalPaymentMethod(chargePayment?.external_payment_method)}
                                  </div>
                                  {chargePayment?.external_reference ? (
                                    <div className="text-slate-600">Reference: {chargePayment.external_reference}</div>
                                  ) : null}
                                  {chargePayment?.external_notes ? (
                                    <div className="text-slate-600">Payment notes: {chargePayment.external_notes}</div>
                                  ) : null}
                                </>
                              ) : (
                                <div className="text-slate-600">
                                  Charged to saved card
                                  {chargePaymentMethod ? ` (${formatSavedCardLabel(chargePaymentMethod)})` : ""}.
                                </div>
                              )}
                              <div
                                className={customerReceiptStatusClasses(charge.customer_receipt_email_status)}
                                style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "6px" }}
                              >
                                <span>{getCustomerReceiptStatusLabel(charge)}</span>
                                {isExternalPayment(chargePayment) &&
                                charge.customer_receipt_email_status === "not_applicable" &&
                                booking.customer_email ? (
                                  <form action={sendPostBookingChargeReceiptAction} style={{ display: "inline" }}>
                                    <input type="hidden" name="bookingId" value={booking.id} />
                                    <input type="hidden" name="bookingChargeId" value={charge.id} />
                                    <FormSubmitButton
                                      loadingLabel="Sending..."
                                      className="inline-flex items-center border-0 bg-transparent p-0 text-xs font-medium text-[var(--text-accent)] underline"
                                    >
                                      Send receipt
                                    </FormSubmitButton>
                                  </form>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                          {charge.status === "failed" ? (
                            <div className="mt-2 rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                              Failed{failedAt ? ` on ${formatDateTime(failedAt)}` : ""}.
                              {chargePayment?.failure_message ? ` ${chargePayment.failure_message}` : ""}
                            </div>
                          ) : null}
                          {chargePayment && charge.status !== "paid" && charge.status !== "failed" ? (
                            <div className="mt-2 text-sm text-slate-500">
                              Payment attempt: {formatTitleLabel(chargePayment.status)}
                              {chargePayment.created_at ? ` on ${formatDateTime(chargePayment.created_at)}` : ""}.
                            </div>
                          ) : null}
                          {charge.status === "pending" ? (
                            <div className="mt-4">
                              <p className="mb-1.5 text-xs text-[var(--text-secondary)]">
                                {savedCardChargeSupport}
                              </p>
                              <form action={chargeBookingChargeSavedCardAction}>
                                <input type="hidden" name="bookingId" value={booking.id} />
                                <input type="hidden" name="bookingChargeId" value={charge.id} />
                                <FormSubmitButton
                                  disabled={!savedCardChargeReady}
                                  loadingLabel="Sending to Square..."
                                  className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold"
                                  style={{
                                    background: savedCardChargeReady ? "#A32D2D" : "var(--surface-1)",
                                    border: "none",
                                    borderRadius: "var(--radius)",
                                    color: savedCardChargeReady ? "#ffffff" : "var(--text-muted)",
                                  }}
                                >
                                  {savedCardChargeReady ? "Charge saved card" : savedCardChargeActionLabel}
                                </FormSubmitButton>
                              </form>
                            </div>
                          ) : null}
                        </div>
                        <div
                          style={{
                            alignItems: "flex-end",
                            color: "var(--text-primary)",
                            display: "flex",
                            flexDirection: "column",
                            flexShrink: 0,
                            fontSize: "16px",
                            fontWeight: 500,
                            gap: "6px",
                          }}
                        >
                          <div style={{ fontSize: "16px", fontWeight: 500 }}>{formatUsdFromCents(charge.amount_cents)}</div>
                          {charge.status === "draft" ? (
                            <>
                              <form action={approveAndChargeBookingChargeAction}>
                                <input type="hidden" name="bookingId" value={booking.id} />
                                <input type="hidden" name="bookingChargeId" value={charge.id} />
                                <FormSubmitButton
                                  disabled={!savedCardChargeReady}
                                  loadingLabel="Sending to Square..."
                                  className="inline-flex items-center justify-center"
                                  style={{
                                    background: savedCardChargeReady ? "#A32D2D" : "var(--surface-1)",
                                    border: "none",
                                    borderRadius: "var(--radius)",
                                    color: savedCardChargeReady ? "#ffffff" : "var(--text-muted)",
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    padding: "6px 12px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {savedCardChargeActionLabel}
                                </FormSubmitButton>
                              </form>
                              <div
                                style={{
                                  color: "var(--text-muted)",
                                  fontSize: "11px",
                                  fontWeight: 400,
                                  textAlign: "right",
                                }}
                              >
                                {savedCardChargeSupport}
                              </div>
                              <ExternalPaymentForm
                                action={recordExternalBookingChargePaymentAction}
                                amount={formatDollarsInput(charge.amount_cents)}
                                bookingChargeId={charge.id}
                                bookingId={booking.id}
                                today={getTodayDateInputValue()}
                              />
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <form action={createDraftBookingChargeAction} className="rounded-[14px] border border-slate-200 bg-slate-50/80 p-4">
              <input type="hidden" name="bookingId" value={booking.id} />
              <div className="mb-4">
                <div
                  style={{
                    color: "var(--text-primary)",
                    fontSize: "14px",
                    fontWeight: 600,
                    letterSpacing: "normal",
                    textTransform: "none",
                  }}
                >
                  Add charge for approval
                </div>
                <div className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                  Document an additional charge. The customer will not be charged until it is approved.
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(180px,0.75fr)_minmax(140px,0.45fr)_minmax(0,1fr)]">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Charge type</span>
                  <select
                    name="chargeType"
                    defaultValue="weight_overage"
                    className="h-12 w-full rounded-[14px] border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                  >
                    {BOOKING_CHARGE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Amount</span>
                  <input
                    type="text"
                    name="amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="h-12 w-full rounded-[14px] border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Description</span>
                  <input
                    type="text"
                    name="description"
                    placeholder="e.g., Weight ticket overage"
                    className="h-12 w-full rounded-[14px] border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                  />
                </label>
              </div>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  name="evidenceNotes"
                  rows={3}
                  placeholder="Scale ticket, photos, driver notes, or other internal context."
                  className="w-full rounded-[14px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
              </label>

              <div className="mt-4 flex justify-end">
                <FormSubmitButton
                  loadingLabel="Saving charge..."
                  className={PRIMARY_ACTION_BUTTON_CLASS}
                >
                  Save charge for approval
                </FormSubmitButton>
              </div>
            </form>
          </div>

          <details className="group rounded-[14px] border border-slate-200 bg-white px-4 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Technical details</div>
                <div className="mt-1 text-sm text-slate-500">Provider IDs and consent versions for troubleshooting.</div>
              </div>
              <ChevronDownIcon className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4 space-y-5 border-t border-slate-200 pt-4">
              <div>
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Initial payment
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Provider" value={formatPlainLabel(successfulInitialBookingPayment?.provider ?? latestBookingPayment?.provider ?? paymentProvider)} />
                  <Field label="Provider environment" value={formatPlainLabel(providerEnvironment)} />
                  <Field label="Latest payment attempt" value={formatTitleLabel(latestBookingPayment?.status)} />
                  <Field
                    label="Square payment ID"
                    value={squarePaymentId ? <span className="font-mono text-xs break-all">{squarePaymentId}</span> : "—"}
                  />
                  <Field
                    label="Provider location ID"
                    value={
                      (successfulInitialBookingPayment?.provider_location_id ?? latestBookingPayment?.provider_location_id) ? (
                        <span className="font-mono text-xs break-all">
                          {successfulInitialBookingPayment?.provider_location_id ?? latestBookingPayment?.provider_location_id}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Field label="Paid at" value={paidAt ? formatDateTime(paidAt) : "—"} />
                  <Field label="Failed at" value={latestBookingPayment?.failed_at ? formatDateTime(latestBookingPayment.failed_at) : "—"} />
                  <Field label="Payment failure code" value={latestBookingPayment?.failure_code ?? "—"} />
                  <Field label="Payment failure message" value={latestBookingPayment?.failure_message ?? "—"} />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Authorizations and saved card
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Rental terms version" value={rentalTermsConsent?.consent_version ?? "—"} />
                  <Field label="Card-on-file version" value={cardOnFileConsent?.consent_version ?? "—"} />
                  <Field
                    label="Provider payment method ID"
                    value={
                      savedPaymentMethod?.provider_payment_method_id ? (
                        <span className="font-mono text-xs break-all">{savedPaymentMethod.provider_payment_method_id}</span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Field
                    label="Customer provider ID"
                    value={
                      savedPaymentMethod?.provider_customer_id ? (
                        <span className="font-mono text-xs break-all">{savedPaymentMethod.provider_customer_id}</span>
                      ) : (
                        "—"
                      )
                    }
                  />
                </div>
              </div>

              {bookingCharges.length > 0 ? (
                <div className="space-y-3 border-t border-slate-200 pt-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Additional charge payments
                  </div>
                  {bookingCharges.map((charge) => {
                    const chargePayment = latestChargePaymentByChargeId.get(charge.id) ?? null;
                    const providerPaymentId = charge.provider_payment_id ?? chargePayment?.provider_payment_id ?? null;

                    return (
                      <div key={charge.id} className="rounded-[14px] border border-slate-200 bg-slate-50/70 px-4 py-3">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-slate-900">
                            {getBookingChargeTypeLabel(charge.charge_type)}
                          </div>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${chargeStatusClasses(
                              charge.status,
                            )}`}
                          >
                            {getBookingChargeStatusLabel(charge.status)}
                          </span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          <Field label="Provider" value={formatPlainLabel(charge.provider ?? chargePayment?.provider)} />
                          <Field
                            label="Provider environment"
                            value={formatPlainLabel(charge.provider_environment ?? chargePayment?.provider_environment)}
                          />
                          <Field label="Linked payment" value={formatTitleLabel(chargePayment?.status)} />
                          <Field
                            label="Provider payment ID"
                            value={
                              providerPaymentId ? (
                                <span className="font-mono text-xs break-all">{providerPaymentId}</span>
                              ) : (
                                "—"
                              )
                            }
                          />
                          <Field
                            label="Provider location ID"
                            value={
                              chargePayment?.provider_location_id ? (
                                <span className="font-mono text-xs break-all">{chargePayment.provider_location_id}</span>
                              ) : (
                                "—"
                              )
                            }
                          />
                          <Field label="Paid at" value={chargePayment?.paid_at ? formatDateTime(chargePayment.paid_at) : "—"} />
                          <Field label="Failed at" value={chargePayment?.failed_at ? formatDateTime(chargePayment.failed_at) : "—"} />
                          <Field label="Failure code" value={chargePayment?.failure_code ?? "—"} />
                          <Field label="Failure message" value={chargePayment?.failure_message ?? "—"} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </details>
        </div>
      </Section>

      <Section
        title="Pricing breakdown"
        description="Reflects pricing calculated at time of booking. Charges added afterward appear in Payment."
        icon={<CurrencyDollarIcon className="h-4 w-4" />}
        hideHeaderDivider
      >
        <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70">
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
                  <div className="text-sm font-medium text-slate-600">Extra day charge</div>
                  <div className="text-right text-sm font-semibold text-slate-900">
                    {booking.extra_days && booking.extra_days > 0
                      ? formatUsdFromCents(booking.extra_days_charge_cents)
                      : formatUsdFromCents(0)}
                  </div>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-slate-900/3 px-5 py-4">
                  <div className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                    Total price
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-slate-900">
                      {formatUsdFromCents(booking.total_price_cents)}
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-500">
                      Charged as initial booking payment
                    </div>
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
                  <div className="text-sm font-medium text-slate-600">Extra days booked</div>
                  <div className="text-right text-sm font-semibold text-slate-900">
                    {booking.extra_days && booking.extra_days > 0
                      ? `${booking.extra_days} day${booking.extra_days === 1 ? "" : "s"}`
                      : "0 days"}
                  </div>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
                  <div className="text-sm font-medium text-slate-600">Extension requests (during booking)</div>
                  <div className="text-right text-sm font-semibold text-slate-900">
                    {booking.allow_extended_rental_at_booking_snapshot == null
                      ? "—"
                      : booking.allow_extended_rental_at_booking_snapshot
                        ? "Allowed"
                        : "Not allowed"}
                  </div>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
                  <div className="text-sm font-medium text-slate-600">Extension requests (after booking)</div>
                  <div className="text-right text-sm font-semibold text-slate-900">—</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <div id="booking-operational-controls">
        <Section title="Operational edit controls" icon={<PencilSquareIcon className="h-4 w-4" />} hideHeaderDivider>
          {placementError ? (
            <div className="mb-5 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {placementError}
            </div>
          ) : null}

          <form action={updateOperationalControlsAction} className="space-y-5">
            <input type="hidden" name="id" value={booking.id} />
            <input type="hidden" name="placement_schema_available" value={placementSchemaAvailable ? "true" : "false"} />
            <input type="hidden" name="placement_photo_url" value={placement.placementPhotoUrl ?? ""} />

            {placementSchemaAvailable ? (
              <details className="group overflow-hidden rounded-[14px] border border-slate-200 bg-white" open={Boolean(placementError)}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <div>
	                    <div className="text-sm font-semibold text-slate-900">Edit placement details</div>
	                    <div className="mt-1 text-sm text-slate-500">
	                      Update the placement and access details for this booking.
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
                          className="h-12 w-full rounded-[14px] border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                          className="h-12 w-full rounded-[14px] border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                        className="w-full rounded-[14px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                      />
                    </label>

                    <div className="space-y-3 rounded-[14px] bg-white px-4 py-4 ring-1 ring-slate-200">
                      <div>
                        <div className="text-sm font-medium text-slate-700">Access issues</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Check anything the driver should know before arriving.
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {ACCESS_ISSUES.map((issue) => (
                          <label key={issue} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
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
                          className="w-full rounded-[14px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                          className="w-full rounded-[14px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                          className="h-12 w-full rounded-[14px] border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                          className="h-12 w-full rounded-[14px] border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </details>
            ) : null}

	            <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white">
	              <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
	                <label className="block">
	                  <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
	                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-[14px] bg-slate-100 text-slate-600">
	                      <TruckIcon className="h-4 w-4" />
	                    </span>
	                    Delivery date
	                  </span>
	                  <div className="h-10 overflow-hidden rounded-[var(--radius)] border border-slate-300 bg-white shadow-sm">
	                    <input
	                      type="date"
	                      name="delivery_date"
	                      defaultValue={booking.delivery_date ?? ""}
	                      className="h-full w-full border-0 bg-transparent px-3 text-sm text-slate-900 outline-none"
	                    />
	                  </div>
	                </label>
	
	                <label className="block">
	                  <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
	                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-[14px] bg-slate-100 text-slate-600">
	                      <ArrowUturnLeftIcon className="h-4 w-4" />
	                    </span>
	                    Pickup date
	                  </span>
	                  <div className="h-10 overflow-hidden rounded-[var(--radius)] border border-slate-300 bg-white shadow-sm">
	                    <input
	                      type="date"
	                      name="pickup_date"
	                      defaultValue={editablePickupDate}
	                      className="h-full w-full border-0 bg-transparent px-3 text-sm text-slate-900 outline-none"
	                    />
	                  </div>
	                </label>
	              </div>
	            </div>

            <div className="flex justify-end">
              <FormSubmitButton
                loadingLabel="Saving changes..."
                className={PRIMARY_ACTION_BUTTON_CLASS}
              >
                Save changes
              </FormSubmitButton>
            </div>
          </form>
        </Section>
      </div>

      {booking.reordered_from_booking_id || derivedFromThisBookingCount > 0 ? (
        <div className="rounded-[20px] bg-white px-6 py-6 shadow-sm ring-1 ring-slate-200/70 sm:px-8">
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
                  <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Source booking
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      <Link href={`/admin/bookings/${sourceBooking.id}`} className="hover:underline">
                        {getCustomerFacingBookingLabel(sourceBooking.booking_ref)}
                      </Link>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
	                      {formatCustomerName(
	                        sourceBooking.customer_first_name,
	                        sourceBooking.customer_last_name,
	                        "Customer",
	                      )}
                      {sourceBooking.delivery_date ? ` • Delivered ${formatDate(sourceBooking.delivery_date)}` : ""}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {[sourceBooking.customer_street, sourceBooking.customer_city, sourceBooking.customer_zip]
                        .filter(Boolean)
                        .join(", ") || "Address unavailable"}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
                    Source booking unavailable.
                  </div>
                )
              ) : null}

              {derivedFromThisBookingCount > 0 ? (
                <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 px-4 py-4">
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
        <Section
          title="Audit history"
          icon={<ClipboardDocumentListIcon className="h-4 w-4" />}
          hideHeaderDivider
        >
          <details className="group overflow-hidden rounded-[14px] border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-slate-900">
                  Audit History ({auditHistoryCount} {auditHistoryCount === 1 ? "change" : "changes"})
                </div>
                <span
                  className="inline-flex text-slate-400"
                  title="Historical audit trail for booking changes and linked customer-account updates."
                  aria-label="Audit History help"
                >
                  <QuestionMarkCircleIcon className="h-4 w-4" />
                </span>
              </div>
              <span className="text-slate-400 transition group-open:rotate-180">⌄</span>
            </summary>

            <div className="space-y-3 border-t border-slate-200 bg-slate-50/70 px-4 py-4">
              {primaryAuditEntries.length === 0 ? (
                <div className="rounded-[14px] border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                  No booking history recorded yet.
                </div>
              ) : (
                primaryAuditEntries.map((entry) => (
                  <AuditHistoryCard
                    key={entry.id}
                    title={entry.title}
                    beforeValue={entry.beforeValue}
                    afterValue={entry.afterValue}
                    changedAt={entry.changedAt}
                    userLabel={entry.userLabel}
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
          </details>
        </Section>

        <div id="notes" className="min-w-0">
          <Section title="Admin notes" icon={<PencilSquareIcon className="h-4 w-4" />} hideHeaderDivider>
            <div className="space-y-4">
              <form action={updateNotesAction} className="rounded-[14px] border border-slate-200 bg-white px-4 py-4">
                <input type="hidden" name="id" value={booking.id} />
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Add note</span>
                  <textarea
                    name="note"
                    rows={3}
                    placeholder="Add an internal note specific to this booking..."
                    className="w-full resize-y rounded-[var(--radius)] border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                    required
                  />
                </label>
                <div className="mt-3 flex justify-end">
                  <FormSubmitButton
                    loadingLabel="Adding note..."
                    className={PRIMARY_ACTION_BUTTON_CLASS}
                  >
                    Add note
                  </FormSubmitButton>
                </div>
              </form>

              <div className="space-y-3">
                {adminNoteEntries.length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
                    No admin notes recorded yet.
                  </div>
                ) : (
                  adminNoteEntries.map((entry) => (
                    <div key={entry.id} className="rounded-[14px] border border-slate-200 bg-slate-50/70 px-4 py-4">
                      <div className="space-y-1 text-sm text-slate-600">
                        <div>
                          <span className="font-medium text-slate-500">Note date:</span>{" "}
                          {entry.createdAt ? formatDateTime(entry.createdAt) : "—"}
                        </div>
                        <div>
                          <span className="font-medium text-slate-500">User:</span> {normalizeAdminNoteAuthor(entry.author)}
                        </div>
                      </div>
                      <div className="my-3 border-t border-slate-200" />
                      <div className="whitespace-pre-wrap text-sm text-slate-700">{entry.body}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Section>
        </div>
      </div>
    </AdminPage>
  );
}
