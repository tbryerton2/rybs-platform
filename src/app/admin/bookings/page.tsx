// src/app/admin/bookings/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import {
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ClockIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  TruckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { AdminPageHelpLink } from "@/app/admin/_components/admin/admin-page-help-link";
import { CopyBookingRefButton } from "@/app/admin/bookings/CopyBookingRefButton";
import { EMPTY_BOOKING_PLACEMENT_FIELDS, isBookingSchemaError } from "@/lib/booking-schema";
import { isRecentlyCreated, RECENTLY_CREATED_DATE_PRESET } from "@/lib/admin/booking-recency";
import { getCustomerFacingBookingLabel, normalizeEmail } from "@/lib/identity";
import { evaluateBookingAttention } from "@/lib/admin/booking-attention";
import { isPortalSchemaError } from "@/lib/portal/schema";
import {
  getAccessIssueLabel,
  getPlacementPreferenceLabel,
  sanitizePlacementDetails,
} from "@/lib/placement";
import { buildPickupPlanningModel } from "@/lib/pickup-planning";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SearchParams = Record<string, string | string[] | undefined>;

type BookingRow = {
  id: string;
  booking_ref: string | null;
  created_at: string | null;
  updated_at: string | null;
  status: string | null;
  customer_id: string | null;
  reordered_from_booking_id: string | null;
  booking_contact_name: string | null;
  booking_contact_email: string | null;
  booking_contact_phone: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string | null;
  pickup_mode: string | null;
  pickup_date: string | null;
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

type HoldRow = {
  id: string;
  created_at: string | null;
  delivery_date: string | null;
  expires_at: string | null;
  zip: string | null;
  status?: string | null;
};

type LinkedCustomer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  portal_status: string | null;
};

type BookingBucket = "all" | "needs_attention" | "active" | "upcoming" | "completed" | "cancelled" | "holds";
type DateField = "created_at" | "delivery_date" | "pickup_date";
type DatePreset = "all" | "today" | "tomorrow" | "next_7_days" | "last_7_days" | "this_week" | "this_month" | "custom";
type SortOption =
  | "updated_desc"
  | "created_desc"
  | "created_asc"
  | "delivery_asc"
  | "delivery_desc"
  | "pickup_asc"
  | "pickup_desc";

type BookingViewModel = {
  booking: BookingRow;
  linkedCustomer: LinkedCustomer | null;
  bookedWithName: string | null;
  bookedWithEmail: string | null;
  bookedWithPhone: string | null;
  currentAccountDiffers: boolean;
  currentAccountName: string | null;
  currentAccountEmail: string | null;
  currentAccountPhone: string | null;
  addressLine: string;
  sortDeliveryDate: string | null;
  sortPickupDate: string | null;
  sortCreatedAt: string | null;
  sortUpdatedAt: string | null;
  placementInstructions: string[];
  pickupPlanning: ReturnType<typeof buildPickupPlanningModel>;
  daysOnSite: number | null;
  rowAlertTone: "none" | "caution" | "at_risk" | "high_risk";
  rowAlertLabel: string | null;
  rowAlertSummary: string | null;
  needsAttention: boolean;
  isOverdueConfirmed: boolean;
  isOverduePickup: boolean;
  activeBucket: BookingBucket;
};

type Filters = {
  q: string;
  quickView: "all" | "needs_attention" | "overdue_confirmed" | "overdue_pickups" | "active" | "holds";
  status: string;
  bucket: BookingBucket;
  dateField: DateField;
  datePreset: DatePreset;
  city: string;
  zip: string;
  sort: SortOption;
  pageSize: 25 | 50 | 100;
  customFrom: string;
  customTo: string;
};

const BOOKING_PLACEMENT_SELECT =
  "placement_preference, placement_details, access_issues, gate_instructions, delivery_presence, alternate_contact_name, alternate_contact_phone, placement_photo_url, special_delivery_instructions";

const BOOKING_LIST_SELECT = `id, booking_ref, created_at, updated_at, status, customer_id, reordered_from_booking_id, booking_contact_name, booking_contact_email, booking_contact_phone, customer_name, customer_email, customer_phone, customer_street, customer_city, customer_zip, delivery_date, pickup_mode, pickup_date, ${BOOKING_PLACEMENT_SELECT}`;
const BOOKING_LIST_SELECT_WITH_REORDER_ONLY =
  "id, booking_ref, created_at, updated_at, status, customer_id, reordered_from_booking_id, booking_contact_name, booking_contact_email, booking_contact_phone, customer_name, customer_email, customer_phone, customer_street, customer_city, customer_zip, delivery_date, pickup_mode, pickup_date";
const BASE_BOOKING_LIST_SELECT =
  "id, booking_ref, created_at, updated_at, status, customer_id, booking_contact_name, booking_contact_email, booking_contact_phone, customer_name, customer_email, customer_phone, customer_street, customer_city, customer_zip, delivery_date, pickup_mode, pickup_date";
const LEGACY_BOOKING_LIST_SELECT =
  "id, booking_ref, created_at, status, customer_name, customer_email, customer_phone, customer_street, customer_city, customer_zip, delivery_date, pickup_mode, pickup_date";

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "updated_desc", label: "Most recently updated" },
  { value: "created_desc", label: "Newest created" },
  { value: "created_asc", label: "Oldest created" },
  { value: "delivery_asc", label: "Delivery date soonest" },
  { value: "delivery_desc", label: "Delivery date latest" },
  { value: "pickup_asc", label: "Pickup date soonest" },
  { value: "pickup_desc", label: "Pickup date latest" },
];

function sp(obj: SearchParams, key: string) {
  const v = obj[key];
  return Array.isArray(v) ? v[0] : v;
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "";
}

function pillBase(className: string) {
  return `inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset leading-5 ${className}`;
}

function cardShell(extra = "") {
  return `rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200/70 ${extra}`;
}

function summaryCardShell(
  tone: "green" | "blue" | "violet" | "amber" | "teal" | "rose",
  extra = "",
) {
  const toneClasses =
    tone === "green"
      ? "border-emerald-200/70 bg-emerald-50/55"
      : tone === "blue"
        ? "border-sky-200/70 bg-sky-50/55"
        : tone === "violet"
          ? "border-violet-200/70 bg-violet-50/50"
          : tone === "amber"
            ? "border-amber-200/70 bg-amber-50/55"
            : tone === "teal"
              ? "border-teal-200/70 bg-teal-50/55"
              : "border-rose-200/70 bg-rose-50/55";

  return `rounded-[28px] border shadow-sm ${toneClasses} ${extra}`;
}

function logAdminBookingsError(context: string, error: unknown) {
  if (error && typeof error === "object") {
    const errorObject = error as Record<string, unknown>;
    console.error(`ADMIN BOOKINGS ERROR [${context}]:`, {
      message: typeof errorObject.message === "string" ? errorObject.message : null,
      details: errorObject,
    });
    return;
  }

  console.error(`ADMIN BOOKINGS ERROR [${context}]:`, error);
}

function devAdminBookingsLog(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[admin-bookings]", { event, ...details });
}

function filtersSummaryClasses() {
  return `
    [data-filters] .filters-chevron { transition: transform 200ms ease; }
  `;
}

function todayISOET() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseYmd(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function formatDateLabel(value?: string | null) {
  if (!value) return "—";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parseYmd(value));
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTimeLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function normalizeSearchTerm(value: string) {
  return value.trim().toLowerCase();
}

function escapeIlikeTerm(value: string) {
  return value.replace(/[%_,]/g, " ").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function statusPillClass(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  if (s === "confirmed" || s === "paid") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (s === "scheduled") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (s === "cancelled") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (s === "delivered" || s === "picked_up") return "bg-slate-900 text-white ring-slate-900/10";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function withEmptyPlacementFields(
  rows: Array<
    Omit<BookingRow, keyof typeof EMPTY_BOOKING_PLACEMENT_FIELDS> & {
      reordered_from_booking_id?: string | null;
    }
  >,
) {
  return rows.map((row) => ({
    ...row,
    ...EMPTY_BOOKING_PLACEMENT_FIELDS,
  })) as BookingRow[];
}

function withLegacyBookingFields(
  rows: Array<{
    id: string;
    booking_ref?: string | null;
    created_at?: string | null;
    status?: string | null;
    customer_name?: string | null;
    customer_email?: string | null;
    customer_phone?: string | null;
    customer_street?: string | null;
    customer_city?: string | null;
    customer_zip?: string | null;
    delivery_date?: string | null;
    pickup_mode?: string | null;
    pickup_date?: string | null;
  }>,
) {
  return rows.map((row) => ({
    id: row.id,
    booking_ref: row.booking_ref ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.created_at ?? null,
    status: row.status ?? null,
    customer_id: null,
    reordered_from_booking_id: null,
    booking_contact_name: row.customer_name ?? null,
    booking_contact_email: row.customer_email ?? null,
    booking_contact_phone: row.customer_phone ?? null,
    customer_name: row.customer_name ?? null,
    customer_email: row.customer_email ?? null,
    customer_phone: row.customer_phone ?? null,
    customer_street: row.customer_street ?? null,
    customer_city: row.customer_city ?? null,
    customer_zip: row.customer_zip ?? null,
    delivery_date: row.delivery_date ?? null,
    pickup_mode: row.pickup_mode ?? null,
    pickup_date: row.pickup_date ?? null,
    ...EMPTY_BOOKING_PLACEMENT_FIELDS,
  })) satisfies BookingRow[];
}

async function runBookingQuery(
  build: (selectClause: string) => PromiseLike<{
    data: unknown[] | null;
    error: { message?: string | null } | null;
  }>,
) {
  const { data, error } = await build(BOOKING_LIST_SELECT);

  if (error && isBookingSchemaError(error)) {
    const reorderFallback = await build(BOOKING_LIST_SELECT_WITH_REORDER_ONLY);
    if (!reorderFallback.error) {
      return withEmptyPlacementFields(
        (reorderFallback.data ?? []) as unknown as Omit<BookingRow, keyof typeof EMPTY_BOOKING_PLACEMENT_FIELDS>[],
      );
    }

    if (isBookingSchemaError(reorderFallback.error)) {
      const fallback = await build(BASE_BOOKING_LIST_SELECT);
      if (!fallback.error) {
        return withEmptyPlacementFields(
          (fallback.data ?? []) as unknown as Omit<BookingRow, keyof typeof EMPTY_BOOKING_PLACEMENT_FIELDS>[],
        );
      }

      if (isBookingSchemaError(fallback.error)) {
        const legacyFallback = await build(LEGACY_BOOKING_LIST_SELECT);
        if (legacyFallback.error) {
          logAdminBookingsError("legacy-fallback", legacyFallback.error);
          return [];
        }

        return withLegacyBookingFields(
          (legacyFallback.data ?? []) as Array<{
            id: string;
            booking_ref?: string | null;
            created_at?: string | null;
            status?: string | null;
            customer_name?: string | null;
            customer_email?: string | null;
            customer_phone?: string | null;
            customer_street?: string | null;
            customer_city?: string | null;
            customer_zip?: string | null;
            delivery_date?: string | null;
            pickup_mode?: string | null;
            pickup_date?: string | null;
          }>,
        );
      }

      logAdminBookingsError("base-fallback", fallback.error);
      return [];
    }

    logAdminBookingsError("reorder-fallback", reorderFallback.error);
    return [];
  }

  if (error) {
    logAdminBookingsError("primary-query", error);
    return [];
  }

  return (data ?? []) as BookingRow[];
}

function getExplicitDateRange(preset: DatePreset, customFrom: string, customTo: string) {
  const today = parseYmd(todayISOET());
  const startOfToday = today.toISOString().slice(0, 10);

  if (preset === "custom" && (customFrom || customTo)) {
    return {
      from: customFrom || null,
      to: customTo || null,
      label:
        customFrom && customTo
          ? `${formatDateLabel(customFrom)} to ${formatDateLabel(customTo)}`
          : customFrom
            ? `From ${formatDateLabel(customFrom)}`
            : `Through ${formatDateLabel(customTo)}`,
    };
  }

  switch (preset) {
    case "today":
      return { from: startOfToday, to: startOfToday, label: "Today" };
    case "tomorrow": {
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const ymd = tomorrow.toISOString().slice(0, 10);
      return { from: ymd, to: ymd, label: "Tomorrow" };
    }
    case "next_7_days": {
      const end = new Date(today);
      end.setUTCDate(end.getUTCDate() + 6);
      return { from: startOfToday, to: end.toISOString().slice(0, 10), label: "Next 7 days" };
    }
    case "last_7_days": {
      const start = new Date(today);
      start.setUTCDate(start.getUTCDate() - 6);
      return { from: start.toISOString().slice(0, 10), to: startOfToday, label: "Last 7 days" };
    }
    case "this_week": {
      const localToday = new Date();
      const start = new Date(localToday);
      start.setDate(localToday.getDate() - localToday.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
        label: "This week",
      };
    }
    case "this_month": {
      const localToday = new Date();
      const start = new Date(localToday.getFullYear(), localToday.getMonth(), 1);
      const end = new Date(localToday.getFullYear(), localToday.getMonth() + 1, 0);
      return {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
        label: "This month",
      };
    }
    case "custom":
      return {
        from: customFrom || null,
        to: customTo || null,
        label:
          customFrom && customTo
            ? `${formatDateLabel(customFrom)} to ${formatDateLabel(customTo)}`
            : customFrom
              ? `From ${formatDateLabel(customFrom)}`
              : customTo
                ? `Through ${formatDateLabel(customTo)}`
                : "Custom range",
      };
    default:
      return { from: null, to: null, label: null };
  }
}

async function getBookings(limit = 1000) {
  return runBookingQuery((selectClause) =>
    supabaseAdmin.from("bookings").select(selectClause).order("created_at", { ascending: false }).limit(limit),
  );
}

function mergeBookingRows(...groups: BookingRow[][]) {
  const merged = new Map<string, BookingRow>();
  for (const group of groups) {
    for (const row of group) {
      const existing = merged.get(row.id);
      if (!existing) {
        merged.set(row.id, row);
        continue;
      }

      const nextRow = { ...existing } as BookingRow;
      for (const [key, value] of Object.entries(row) as Array<[keyof BookingRow, BookingRow[keyof BookingRow]]>) {
        if (value !== null && value !== undefined && value !== "") {
          nextRow[key] = value;
        }
      }

      merged.set(row.id, nextRow);
    }
  }
  return Array.from(merged.values());
}

async function getSearchSupplementalBookings(query: string) {
  const term = escapeIlikeTerm(query);
  if (!term) return [] as BookingRow[];

  const phoneDigits = normalizePhone(query);
  const exactUuid = isUuid(query.trim()) ? query.trim() : null;
  const normalizedEmailQuery = normalizeEmail(query);

  const [snapshotMatches, exactIdMatches, customerNormalizedEmailMatches, customerLiteralEmailMatches, customerNameMatches, customerPhoneRows] = await Promise.all([
    runBookingQuery((selectClause) =>
      supabaseAdmin
        .from("bookings")
        .select(selectClause)
        .or(
          [
            `booking_ref.ilike.%${term}%`,
            `booking_contact_name.ilike.%${term}%`,
            `booking_contact_email.ilike.%${term}%`,
            `customer_name.ilike.%${term}%`,
            `customer_email.ilike.%${term}%`,
            `customer_street.ilike.%${term}%`,
            `customer_city.ilike.%${term}%`,
            `customer_zip.ilike.%${term}%`,
          ].join(","),
        )
        .order("created_at", { ascending: false })
        .limit(250),
    ),
    exactUuid
      ? runBookingQuery((selectClause) =>
          supabaseAdmin.from("bookings").select(selectClause).eq("id", exactUuid).limit(1),
        )
      : Promise.resolve([] as BookingRow[]),
    normalizedEmailQuery
      ? supabaseAdmin
          .from("customers")
          .select("id, email")
          .eq("normalized_email", normalizedEmailQuery)
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
    normalizedEmailQuery
      ? supabaseAdmin
          .from("customers")
          .select("id, email")
          .ilike("email", normalizedEmailQuery)
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin
      .from("customers")
      .select("id, name")
      .ilike("name", `%${term}%`)
      .limit(200),
    phoneDigits
      ? supabaseAdmin.from("customers").select("id, phone").not("phone", "is", null).limit(500)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (customerNormalizedEmailMatches.error && !isPortalSchemaError(customerNormalizedEmailMatches.error)) {
    logAdminBookingsError("search-customers-normalized-email", customerNormalizedEmailMatches.error);
  }

  if (customerLiteralEmailMatches.error && !isPortalSchemaError(customerLiteralEmailMatches.error)) {
    logAdminBookingsError("search-customers-literal-email", customerLiteralEmailMatches.error);
  }

  if (customerNameMatches.error) {
    logAdminBookingsError("search-customers-name", customerNameMatches.error);
  }

  if (customerPhoneRows.error) {
    logAdminBookingsError("search-customer-phones", customerPhoneRows.error);
  }

  const matchedCustomerIds = new Set<string>([
    ...((customerNormalizedEmailMatches.data ?? []).map((row) => row.id as string)),
    ...((customerLiteralEmailMatches.data ?? []).map((row) => row.id as string)),
    ...((customerNameMatches.data ?? []).map((row) => row.id as string)),
  ]);

  if (phoneDigits) {
    for (const row of (customerPhoneRows.data ?? []) as Array<{ id: string; phone: string | null }>) {
      if (normalizePhone(row.phone).includes(phoneDigits)) {
        matchedCustomerIds.add(row.id);
      }
    }
  }

  let linkedCustomerBookings: BookingRow[] = [];
  if (matchedCustomerIds.size > 0) {
    const linkedBookingIdentityRows = await supabaseAdmin
      .from("bookings")
      .select("id, customer_id")
      .in("customer_id", Array.from(matchedCustomerIds))
      .order("created_at", { ascending: false })
      .limit(250);

    if (linkedBookingIdentityRows.error) {
      logAdminBookingsError("search-linked-booking-identities", linkedBookingIdentityRows.error);
    } else {
      const detailedLinkedBookings = await runBookingQuery((selectClause) =>
        supabaseAdmin
          .from("bookings")
          .select(selectClause)
          .in(
            "id",
            (linkedBookingIdentityRows.data ?? []).map((row) => row.id as string),
          )
          .order("created_at", { ascending: false })
          .limit(250),
      );

      const customerIdsByBookingId = new Map(
        (linkedBookingIdentityRows.data ?? []).map((row) => [row.id as string, row.customer_id as string | null]),
      );

      linkedCustomerBookings = detailedLinkedBookings.map((row) => ({
        ...row,
        customer_id: customerIdsByBookingId.get(row.id) ?? row.customer_id,
      }));
    }
  }

  devAdminBookingsLog("search_supplemental", {
    query,
    normalizedEmailQuery,
    customerNormalizedEmailMatches:
      (customerNormalizedEmailMatches.data ?? []).map((row) => ({ id: row.id, email: row.email })).slice(0, 10),
    customerLiteralEmailMatches:
      (customerLiteralEmailMatches.data ?? []).map((row) => ({ id: row.id, email: row.email })).slice(0, 10),
    customerNameMatches: (customerNameMatches.data ?? []).map((row) => ({ id: row.id, name: row.name })).slice(0, 10),
    snapshotMatches: snapshotMatches.length,
    exactIdMatches: exactIdMatches.length,
    matchedCustomerIds: Array.from(matchedCustomerIds),
    linkedCustomerBookings: linkedCustomerBookings.length,
    linkedCustomerBookingIds: linkedCustomerBookings.map((row) => ({ id: row.id, customer_id: row.customer_id })).slice(0, 20),
  });

  return mergeBookingRows(snapshotMatches, exactIdMatches, linkedCustomerBookings);
}

async function getLinkedCustomers(customerIds: string[]) {
  if (customerIds.length === 0) return new Map<string, LinkedCustomer>();

  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("id, name, email, phone, portal_status")
    .in("id", customerIds);

  if (error) {
    console.error("ADMIN BOOKINGS CUSTOMERS ERROR:", error);
    return new Map<string, LinkedCustomer>();
  }

  return new Map((data ?? []).map((row) => [row.id as string, row as LinkedCustomer]));
}

async function getActiveHolds() {
  const nowIso = new Date().toISOString();
  const query = supabaseAdmin
    .from("booking_holds")
    .select("id, created_at, delivery_date, expires_at, zip, status")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data, error } = await query.eq("status", "active").gt("expires_at", nowIso);

  if (error) {
    console.error("ADMIN HOLDS ERROR:", error);
    return [] as HoldRow[];
  }

  return (data ?? []) as HoldRow[];
}

function buildAddressLine(row: BookingRow) {
  const parts = [clean(row.customer_street), clean(row.customer_city), clean(row.customer_zip)].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "No service address";
}

function buildPlacementInstructionLines(details: ReturnType<typeof sanitizePlacementDetails>) {
  const lines = [
    details.placementDetails,
    details.specialDeliveryInstructions,
    details.gateInstructions,
    details.deliveryPresence === "call_if_issue"
      ? "Call on arrival"
      : details.deliveryPresence === "customer_present"
        ? "Customer onsite"
        : null,
    details.accessIssues.length ? `Access notes: ${details.accessIssues.map(getAccessIssueLabel).join(", ")}` : null,
    details.alternateContactName || details.alternateContactPhone
      ? `Alternate contact: ${[details.alternateContactName, details.alternateContactPhone].filter(Boolean).join(" • ")}`
      : null,
  ]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);

  if (lines.length === 0 && details.placementPreference) {
    return [getPlacementPreferenceLabel(details.placementPreference)];
  }

  return Array.from(new Set(lines));
}

function getPickupDateCell(vm: Pick<BookingViewModel, "booking" | "pickupPlanning">) {
  const { booking, pickupPlanning } = vm;

  if (booking.status === "picked_up") {
    return {
      label: "Pickup",
      value: booking.pickup_date ? formatDateLabel(booking.pickup_date) : "Completed",
    };
  }

  if (pickupPlanning.pickupStatus === "scheduled" && pickupPlanning.scheduledPickupDate) {
    return {
      label: "Pickup",
      value: formatDateLabel(pickupPlanning.scheduledPickupDate),
    };
  }

  if (pickupPlanning.pickupStatus === "requested") {
    return {
      label: "Pickup requested",
      value: "Awaiting schedule",
    };
  }

  return {
    label: "Pickup",
    value: booking.status === "delivered" ? "Awaiting request" : "Pending delivery",
  };
}

function buildViewModel(row: BookingRow, linkedCustomer: LinkedCustomer | null, futureDeliveryDates: string[]) {
  const bookedWithName = row.booking_contact_name ?? row.customer_name ?? null;
  const bookedWithEmail = row.booking_contact_email ?? row.customer_email ?? null;
  const bookedWithPhone = row.booking_contact_phone ?? row.customer_phone ?? null;

  const currentAccountName = linkedCustomer?.name ?? null;
  const currentAccountEmail = linkedCustomer?.email ?? null;
  const currentAccountPhone = linkedCustomer?.phone ?? null;

  const currentAccountDiffers = Boolean(
    linkedCustomer &&
      ((bookedWithName ?? "") !== (currentAccountName ?? "") ||
        (bookedWithEmail ?? "") !== (currentAccountEmail ?? "") ||
        (bookedWithPhone ?? "") !== (currentAccountPhone ?? "")),
  );

  const placement = sanitizePlacementDetails({
    placementPreference: row.placement_preference,
    placementDetails: row.placement_details,
    accessIssues: row.access_issues ?? [],
    gateInstructions: row.gate_instructions,
    deliveryPresence: row.delivery_presence,
    alternateContactName: row.alternate_contact_name,
    alternateContactPhone: row.alternate_contact_phone,
    placementPhotoUrl: row.placement_photo_url,
    specialDeliveryInstructions: row.special_delivery_instructions,
  });

  const placementInstructions = buildPlacementInstructionLines(placement);
  const pickupPlanning = buildPickupPlanningModel({
    deliveryDate: row.delivery_date,
    pickupDate: row.pickup_date,
    pickupMode: row.pickup_mode,
    futureDeliveryDates,
  });

  const status = (row.status ?? "").toLowerCase();
  const today = todayISOET();
  const attentionState = evaluateBookingAttention({
    status,
    deliveryDate: row.delivery_date,
    pickupPlanning,
    todayYmd: today,
  });

  let activeBucket: BookingBucket = "all";
  if (status === "cancelled") activeBucket = "cancelled";
  else if (status === "picked_up") activeBucket = "completed";
  else if (status === "delivered") activeBucket = "active";
  else if (["confirmed", "paid", "scheduled"].includes(status)) activeBucket = "upcoming";

  return {
    booking: row,
    linkedCustomer,
    bookedWithName,
    bookedWithEmail,
    bookedWithPhone,
    currentAccountDiffers,
    currentAccountName,
    currentAccountEmail,
    currentAccountPhone,
    addressLine: buildAddressLine(row),
    sortDeliveryDate: row.delivery_date,
    sortPickupDate: row.pickup_mode === "schedule" ? row.pickup_date : null,
    sortCreatedAt: row.created_at,
    sortUpdatedAt: row.updated_at ?? row.created_at,
    placementInstructions,
    pickupPlanning,
    daysOnSite: attentionState.daysOnSite,
    rowAlertTone: attentionState.rowAlertTone,
    rowAlertLabel: attentionState.rowAlertLabel,
    rowAlertSummary: attentionState.rowAlertSummary,
    needsAttention: attentionState.needsAttention,
    isOverdueConfirmed: attentionState.isOverdueConfirmed,
    isOverduePickup: attentionState.isOverduePickup,
    activeBucket,
  } satisfies BookingViewModel;
}

function compareNullable(a: string | null, b: string | null, direction: "asc" | "desc") {
  const fallback = direction === "asc" ? "9999-12-31T23:59:59Z" : "0000-01-01T00:00:00Z";
  const left = a ?? fallback;
  const right = b ?? fallback;
  return direction === "asc" ? left.localeCompare(right) : right.localeCompare(left);
}

function scoreBooking(vm: BookingViewModel, rawQuery: string) {
  const q = normalizeSearchTerm(rawQuery);
  if (!q) return 0;

  const exactPhone = normalizePhone(rawQuery);
  const bookingRef = (vm.booking.booking_ref ?? "").toLowerCase();
  const bookingId = vm.booking.id.toLowerCase();
  const bookedEmail = (vm.bookedWithEmail ?? "").toLowerCase();
  const bookedName = (vm.bookedWithName ?? "").toLowerCase();
  const bookedPhone = normalizePhone(vm.bookedWithPhone);
  const currentEmail = (vm.currentAccountEmail ?? "").toLowerCase();
  const currentName = (vm.currentAccountName ?? "").toLowerCase();
  const currentPhone = normalizePhone(vm.currentAccountPhone);
  const address = vm.addressLine.toLowerCase();
  const city = (vm.booking.customer_city ?? "").toLowerCase();
  const zip = (vm.booking.customer_zip ?? "").toLowerCase();

  let score = 0;

  if (bookingRef === q) score += 1000;
  else if (bookingRef.startsWith(q)) score += 700;
  else if (bookingRef.includes(q)) score += 500;

  if (bookingId === q) score += 950;
  else if (isUuid(q) && bookingId.includes(q)) score += 700;

  if (bookedEmail === q || currentEmail === q) score += 900;
  else if (bookedEmail.includes(q) || currentEmail.includes(q)) score += 550;

  if (exactPhone && (bookedPhone === exactPhone || currentPhone === exactPhone)) score += 850;
  else if (exactPhone && ((bookedPhone && bookedPhone.includes(exactPhone)) || (currentPhone && currentPhone.includes(exactPhone)))) score += 450;

  if (bookedName === q || currentName === q) score += 650;
  else if (bookedName.includes(q) || currentName.includes(q)) score += 400;

  if (address.includes(q)) score += 350;
  if (city.includes(q)) score += 180;
  if (zip.includes(q)) score += 180;

  return score;
}

function filterByDate(vm: BookingViewModel, filters: Filters) {
  if (filters.dateField === "created_at" && filters.datePreset === RECENTLY_CREATED_DATE_PRESET) {
    return isRecentlyCreated(vm.sortCreatedAt);
  }

  const { from, to } = getExplicitDateRange(filters.datePreset, filters.customFrom, filters.customTo);
  if (!from && !to) return true;

  const source =
    filters.dateField === "created_at"
      ? vm.sortCreatedAt?.slice(0, 10) ?? null
      : filters.dateField === "pickup_date"
        ? vm.sortPickupDate
        : vm.sortDeliveryDate;

  if (!source) return false;
  if (from && source < from) return false;
  if (to && source > to) return false;
  return true;
}

function filterByBucket(vm: BookingViewModel, bucket: BookingBucket) {
  if (bucket === "all") return true;
  if (bucket === "needs_attention") return vm.needsAttention;
  if (bucket === "holds") return false;
  return vm.activeBucket === bucket;
}

function filterByQuickView(vm: BookingViewModel, quickView: string) {
  switch (quickView) {
    case "needs_attention":
      return vm.needsAttention;
    case "overdue_confirmed":
      return vm.isOverdueConfirmed;
    case "overdue_pickups":
      return vm.isOverduePickup;
    case "active":
      return vm.activeBucket === "active";
    case "holds":
      return false;
    case "all":
    default:
      return true;
  }
}

function buildScopeLabel(filters: Filters, totalCount: number) {
  const { from, to, label } = getExplicitDateRange(filters.datePreset, filters.customFrom, filters.customTo);
  if (filters.bucket === "holds") {
    if (filters.q && !from && !to) return `Searching active holds for “${filters.q}”`;
    if (label) return `Showing active holds with ${filters.dateField === "created_at" ? "Created date" : "Delivery date"}: ${label}`;
    return "Showing active booking holds";
  }
  if (filters.quickView === "overdue_confirmed") {
    return filters.q
      ? `Searching overdue confirmed bookings for “${filters.q}”`
      : "Showing overdue confirmed bookings";
  }
  if (filters.quickView === "overdue_pickups") {
    return filters.q
      ? `Searching overdue pickup bookings for “${filters.q}”`
      : "Showing overdue pickup bookings";
  }
  if (filters.q && !from && !to) {
    return `Searching all bookings for “${filters.q}”`;
  }

  const dateFieldLabel =
    filters.dateField === "created_at" ? "Created date" : filters.dateField === "pickup_date" ? "Pickup date" : "Delivery date";

  if (label) {
    return filters.q
      ? `Searching bookings for “${filters.q}” with ${dateFieldLabel}: ${label}`
      : `Showing bookings with ${dateFieldLabel}: ${label}`;
  }

  if (filters.bucket !== "all") {
    return `Showing ${filters.bucket.replace(/_/g, " ")} bookings`;
  }

  if (filters.q) {
    return `Searching all ${totalCount} loaded bookings for “${filters.q}”`;
  }

  return "Showing all bookings";
}

function buildFilterChips(filters: Filters, keepPanelOpen = false) {
  const chips: Array<{ key: string; label: string; href: string }> = [];

  const pushParams = (exclude: string) => {
    const next = new URLSearchParams();
    if (filters.q && exclude !== "q") next.set("q", filters.q);
    if (filters.quickView !== "all" && exclude !== "quickView") next.set("view", filters.quickView);
    if (filters.status !== "all" && exclude !== "status") next.set("status", filters.status);
    if (filters.bucket !== "all" && exclude !== "bucket") next.set("bucket", filters.bucket);
    if (filters.dateField !== "delivery_date" && exclude !== "dateField") next.set("dateField", filters.dateField);
    if (filters.datePreset !== "all" && exclude !== "datePreset") next.set("datePreset", filters.datePreset);
    if (filters.city && exclude !== "city") next.set("city", filters.city);
    if (filters.zip && exclude !== "zip") next.set("zip", filters.zip);
    if (filters.sort !== "updated_desc" && exclude !== "sort") next.set("sort", filters.sort);
    if (filters.pageSize !== 50 && exclude !== "pageSize") next.set("pageSize", String(filters.pageSize));
    if (filters.datePreset === "custom" && filters.customFrom && exclude !== "customFrom") next.set("from", filters.customFrom);
    if (filters.datePreset === "custom" && filters.customTo && exclude !== "customTo") next.set("to", filters.customTo);
    if (keepPanelOpen) next.set("filtersPanel", "open");
    return `/admin/bookings${next.toString() ? `?${next.toString()}` : ""}`;
  };

  if (filters.q) chips.push({ key: "q", label: `Search: ${filters.q}`, href: pushParams("q") });
  if (filters.quickView !== "all") chips.push({ key: "quickView", label: `View: ${filters.quickView.replace(/_/g, " ")}`, href: pushParams("quickView") });
  if (filters.status !== "all") chips.push({ key: "status", label: `Status: ${filters.status}`, href: pushParams("status") });
  if (filters.bucket !== "all") chips.push({ key: "bucket", label: `Bucket: ${filters.bucket.replace(/_/g, " ")}`, href: pushParams("bucket") });
  if (filters.city) chips.push({ key: "city", label: `City: ${filters.city}`, href: pushParams("city") });
  if (filters.zip) chips.push({ key: "zip", label: `ZIP: ${filters.zip}`, href: pushParams("zip") });
  if (filters.datePreset !== "all") {
    const dateLabel = getExplicitDateRange(filters.datePreset, filters.customFrom, filters.customTo).label ?? "Custom range";
    chips.push({ key: "date", label: `${filters.dateField.replace("_", " ")}: ${dateLabel}`, href: pushParams("datePreset") });
  }
  if (filters.sort !== "updated_desc") chips.push({ key: "sort", label: `Sort: ${SORT_OPTIONS.find((option) => option.value === filters.sort)?.label ?? filters.sort}`, href: pushParams("sort") });
  if (filters.pageSize !== 50) chips.push({ key: "pageSize", label: `Page size: ${filters.pageSize}`, href: pushParams("pageSize") });
  return chips;
}

function hasActiveFilters(filters: Filters) {
  return Boolean(
      filters.q ||
      filters.quickView !== "all" ||
      filters.status !== "all" ||
      filters.bucket !== "all" ||
      filters.dateField !== "delivery_date" ||
      filters.datePreset !== "all" ||
      filters.city ||
      filters.zip ||
      filters.sort !== "updated_desc" ||
      filters.pageSize !== 50 ||
      (filters.datePreset === "custom" && (filters.customFrom || filters.customTo)),
  );
}

function getSummaryHref(
  kind: "needs_attention" | "active" | "upcoming" | "upcoming_pickups" | "recent" | "holds",
  pageSize: Filters["pageSize"] = 50,
  keepPanelOpen = false,
) {
  const next = new URLSearchParams();
  if (pageSize !== 50) next.set("pageSize", String(pageSize));
  if (kind === "needs_attention") next.set("bucket", "needs_attention");
  if (kind === "active") next.set("bucket", "active");
  if (kind === "holds") next.set("bucket", "holds");
  if (kind === "upcoming") {
    next.set("bucket", "upcoming");
    next.set("dateField", "delivery_date");
    next.set("datePreset", "next_7_days");
    next.set("sort", "delivery_asc");
  }
  if (kind === "upcoming_pickups") {
    next.set("dateField", "pickup_date");
    next.set("datePreset", "next_7_days");
    next.set("sort", "pickup_asc");
  }
  if (kind === "recent") {
    next.set("dateField", "created_at");
    next.set("datePreset", RECENTLY_CREATED_DATE_PRESET);
    next.set("sort", "updated_desc");
  }
  if (keepPanelOpen) next.set("filtersPanel", "open");
  return `/admin/bookings?${next.toString()}`;
}

function buildScopedHref(filters: Filters, overrides: Partial<Filters> = {}, page = 1, keepPanelOpen = false) {
  const nextFilters = { ...filters, ...overrides };
  const next = new URLSearchParams();
  if (nextFilters.q) next.set("q", nextFilters.q);
  if (nextFilters.quickView !== "all") next.set("view", nextFilters.quickView);
  if (nextFilters.status !== "all") next.set("status", nextFilters.status);
  if (nextFilters.bucket !== "all") next.set("bucket", nextFilters.bucket);
  if (nextFilters.dateField !== "delivery_date") next.set("dateField", nextFilters.dateField);
  if (nextFilters.datePreset !== "all") next.set("datePreset", nextFilters.datePreset);
  if (nextFilters.city) next.set("city", nextFilters.city);
  if (nextFilters.zip) next.set("zip", nextFilters.zip);
  if (nextFilters.sort !== "updated_desc") next.set("sort", nextFilters.sort);
  if (nextFilters.pageSize !== 50) next.set("pageSize", String(nextFilters.pageSize));
  if (nextFilters.datePreset === "custom" && nextFilters.customFrom) next.set("from", nextFilters.customFrom);
  if (nextFilters.datePreset === "custom" && nextFilters.customTo) next.set("to", nextFilters.customTo);
  if (keepPanelOpen) next.set("filtersPanel", "open");
  if (page > 1) next.set("page", String(page));
  return `/admin/bookings${next.toString() ? `?${next.toString()}` : ""}`;
}

function buildPageHref(filters: Filters, page: number, keepPanelOpen = false) {
  return buildScopedHref(filters, {}, page, keepPanelOpen);
}

function EmptyState({
  title,
  copy,
  resetHref,
  tips,
}: {
  title: string;
  copy: string;
  resetHref: string;
  tips?: string[];
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
      <div className="mx-auto max-w-xl">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
        {tips?.length ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Try next
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              {tips.map((tip) => (
                <li key={tip} className="rounded-xl bg-slate-50 px-3 py-2">
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={resetHref}
            className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Reset all
          </Link>
          <Link
            href="/admin/bookings"
            className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Search all bookings
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const spObj = await Promise.resolve(searchParams ?? {});

  const filters: Filters = {
    q: clean(sp(spObj, "q")),
    quickView: (clean(sp(spObj, "view")) || "all") as Filters["quickView"],
    status: clean(sp(spObj, "status")) || "all",
    bucket: (clean(sp(spObj, "bucket")) || "all") as BookingBucket,
    dateField: (clean(sp(spObj, "dateField")) || "delivery_date") as DateField,
    datePreset: (clean(sp(spObj, "datePreset")) || "all") as DatePreset,
    city: clean(sp(spObj, "city")),
    zip: clean(sp(spObj, "zip")).replace(/[^\d]/g, "").slice(0, 5),
    sort: (clean(sp(spObj, "sort")) || "updated_desc") as SortOption,
    pageSize: ([25, 50, 100].includes(Number.parseInt(clean(sp(spObj, "pageSize")) || "50", 10))
      ? Number.parseInt(clean(sp(spObj, "pageSize")) || "50", 10)
      : 50) as 25 | 50 | 100,
    customFrom: clean(sp(spObj, "from")),
    customTo: clean(sp(spObj, "to")),
  };
  const page = Math.max(1, Number.parseInt(clean(sp(spObj, "page")) || "1", 10) || 1);
  const filtersPanelOpen = clean(sp(spObj, "filtersPanel")) === "open";

  const [baseBookings, supplementalSearchBookings, activeHolds, futureDeliveries] = await Promise.all([
    getBookings(),
    filters.q ? getSearchSupplementalBookings(filters.q) : Promise.resolve([] as BookingRow[]),
    getActiveHolds(),
    supabaseAdmin
      .from("bookings")
      .select("id, delivery_date")
      .in("status", ["confirmed", "scheduled"]) 
      .gte("delivery_date", todayISOET())
      .order("delivery_date", { ascending: true })
      .limit(500),
  ]);
  const bookings = mergeBookingRows(baseBookings, supplementalSearchBookings);

  const customerIds = Array.from(new Set(bookings.map((booking) => booking.customer_id).filter(Boolean) as string[]));
  const linkedCustomers = await getLinkedCustomers(customerIds);
  if (futureDeliveries.error) {
    console.error("ADMIN BOOKINGS FUTURE DELIVERIES ERROR:", futureDeliveries.error);
  }

  const futureDeliveryDatesByBooking = (futureDeliveries.data ?? []).map((row) => ({ id: row.id as string, deliveryDate: row.delivery_date as string | null }));

  const allViewModels = bookings.map((booking) =>
    buildViewModel(
      booking,
      booking.customer_id ? linkedCustomers.get(booking.customer_id) ?? null : null,
      futureDeliveryDatesByBooking.filter((row) => row.id !== booking.id).map((row) => row.deliveryDate ?? "").filter(Boolean),
    ),
  );

  devAdminBookingsLog("search_pipeline_before_filters", {
    query: filters.q,
    baseBookings: baseBookings.length,
    supplementalBookings: supplementalSearchBookings.length,
    mergedBookings: bookings.length,
    bookingsWithCustomerId: bookings.filter((booking) => Boolean(booking.customer_id)).length,
    linkedCustomersLoaded: linkedCustomers.size,
    currentEmailMatchesInViewModels: allViewModels
      .filter((vm) => {
        if (!filters.q) return false;
        return normalizeSearchTerm(vm.currentAccountEmail ?? "") === normalizeSearchTerm(filters.q);
      })
      .map((vm) => ({
        bookingId: vm.booking.id,
        bookingRef: vm.booking.booking_ref,
        customerId: vm.booking.customer_id,
        currentAccountEmail: vm.currentAccountEmail,
        bookedWithEmail: vm.bookedWithEmail,
      }))
      .slice(0, 20),
  });

  let filteredResults = allViewModels.filter((vm) => {
    if (!filterByQuickView(vm, filters.quickView)) return false;
    if (filters.status !== "all" && (vm.booking.status ?? "") !== filters.status) return false;
    if (!filterByBucket(vm, filters.bucket)) return false;
    if (filters.city && !(vm.booking.customer_city ?? "").toLowerCase().includes(filters.city.toLowerCase())) return false;
    if (filters.zip && (vm.booking.customer_zip ?? "") !== filters.zip) return false;
    if (!filterByDate(vm, filters)) return false;
    return true;
  });

  devAdminBookingsLog("search_pipeline_after_filters", {
    query: filters.q,
    filteredBeforeRanking: filteredResults.length,
    matchingBookingIdsBeforeRanking: filteredResults.map((vm) => vm.booking.id).slice(0, 20),
  });

  const searchQuery = filters.q;
  if (searchQuery) {
    const rankedRows = filteredResults
      .map((vm) => ({ vm, score: scoreBooking(vm, searchQuery) }))
      .map((row) => ({
        ...row,
        debug: {
          bookingId: row.vm.booking.id,
          bookingRef: row.vm.booking.booking_ref,
          bookedWithEmail: row.vm.bookedWithEmail,
          currentAccountEmail: row.vm.currentAccountEmail,
        },
      }));

    devAdminBookingsLog("search_pipeline_scores", {
      query: searchQuery,
      scoredRows: rankedRows.slice(0, 20).map((row) => ({
        ...row.debug,
        score: row.score,
      })),
    });

    filteredResults = rankedRows
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || compareNullable(a.vm.sortUpdatedAt, b.vm.sortUpdatedAt, "desc"))
      .map((row) => row.vm);

    devAdminBookingsLog("search_pipeline_after_ranking", {
      query: searchQuery,
      rankedResults: filteredResults.length,
      rankedBookingIds: filteredResults.map((vm) => vm.booking.id).slice(0, 20),
    });
  }

  const { from: holdFrom, to: holdTo } = getExplicitDateRange(filters.datePreset, filters.customFrom, filters.customTo);
  let filteredHolds = activeHolds.filter((hold) => {
    if (!(filters.quickView === "all" || filters.quickView === "holds")) return false;
    const holdDate =
      filters.dateField === "created_at"
        ? hold.created_at?.slice(0, 10) ?? null
        : filters.dateField === "delivery_date"
          ? hold.delivery_date
          : null;

    if (filters.zip && (hold.zip ?? "") !== filters.zip) return false;
    if (holdFrom || holdTo) {
      if (!holdDate) return false;
      if (holdFrom && holdDate < holdFrom) return false;
      if (holdTo && holdDate > holdTo) return false;
    }
    return true;
  });

  if (searchQuery) {
    const normalizedQuery = normalizeSearchTerm(searchQuery);
    filteredHolds = filteredHolds.filter((hold) =>
      [hold.id, hold.zip ?? "", hold.delivery_date ?? "", hold.created_at ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }

  filteredHolds.sort((a, b) => compareNullable(a.created_at, b.created_at, "desc"));

  filteredResults.sort((a, b) => {
    switch (filters.sort) {
      case "created_desc":
        return compareNullable(a.sortCreatedAt, b.sortCreatedAt, "desc");
      case "created_asc":
        return compareNullable(a.sortCreatedAt, b.sortCreatedAt, "asc");
      case "delivery_asc":
        return compareNullable(a.sortDeliveryDate, b.sortDeliveryDate, "asc");
      case "delivery_desc":
        return compareNullable(a.sortDeliveryDate, b.sortDeliveryDate, "desc");
      case "pickup_asc":
        return compareNullable(a.sortPickupDate, b.sortPickupDate, "asc");
      case "pickup_desc":
        return compareNullable(a.sortPickupDate, b.sortPickupDate, "desc");
      default:
        return compareNullable(a.sortUpdatedAt, b.sortUpdatedAt, "desc");
    }
  });

  const showingHolds = filters.bucket === "holds";
  const totalFilteredResults = showingHolds ? filteredHolds.length : filteredResults.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredResults / filters.pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * filters.pageSize;
  const results = filteredResults.slice(pageStart, pageStart + filters.pageSize);
  const pagedHolds = filteredHolds.slice(pageStart, pageStart + filters.pageSize);
  const noResultsTips = showingHolds
    ? [
        "Clear one or more filters to widen the hold view.",
        "Search all bookings if the customer may already have a confirmed rental instead of an active hold.",
      ]
    : [
        "Try the booking ref first if you have it.",
        "Search by the current email or an older booked-with email.",
        "Try the phone number, contact name, or service address.",
        "If the customer updated their account details, the booking may still be easier to find by older details or address.",
      ];

  const hasFiltersApplied = hasActiveFilters(filters);
  const filtersExpanded = filtersPanelOpen || hasFiltersApplied;
  const activeChips = buildFilterChips(filters, filtersExpanded);
  const clearAllHref = "/admin/bookings";
  const resetFiltersHref = "/admin/bookings?filtersPanel=open";
  const scopeLabel = buildScopeLabel(filters, allViewModels.length);
  const next7Range = getExplicitDateRange("next_7_days", "", "");
  const visibleNeedsAttention = allViewModels.filter((vm) => vm.needsAttention).length;
  const activeOnSiteCount = allViewModels.filter((vm) => vm.activeBucket === "active").length;
  const upcomingDeliveriesCount = allViewModels.filter(
    (vm) =>
      vm.activeBucket === "upcoming" &&
      typeof vm.booking.delivery_date === "string" &&
      !!next7Range.to &&
      vm.booking.delivery_date >= todayISOET() &&
      vm.booking.delivery_date <= next7Range.to,
  ).length;
  const upcomingPickupsCount = allViewModels.filter(
    (vm) =>
      vm.booking.pickup_mode === "schedule" &&
      typeof vm.booking.pickup_date === "string" &&
      !!next7Range.to &&
      vm.booking.pickup_date >= todayISOET() &&
      vm.booking.pickup_date <= next7Range.to,
  ).length;
  const recentlyCreatedCount = allViewModels.filter((vm) => isRecentlyCreated(vm.booking.created_at)).length;
  const activeHoldCount = activeHolds.length;
  const quickViews = [
    {
      key: "all",
      label: "All bookings",
      href: buildScopedHref(
        {
          ...filters,
          q: "",
          quickView: "all",
          status: "all",
          bucket: "all",
          dateField: "delivery_date",
          datePreset: "all",
          city: "",
          zip: "",
          sort: "updated_desc",
          customFrom: "",
          customTo: "",
        },
        {},
        1,
        filtersExpanded,
      ),
      active:
        filters.quickView === "all" &&
        !filters.q &&
        filters.status === "all" &&
        filters.bucket === "all" &&
        filters.dateField === "delivery_date" &&
        filters.datePreset === "all" &&
        !filters.city &&
        !filters.zip &&
        filters.sort === "updated_desc",
    },
    {
      key: "needs_attention",
      label: "Needs attention",
      href: buildScopedHref(
        { ...filters, q: "", quickView: "needs_attention", status: "all", bucket: "all", dateField: "delivery_date", datePreset: "all", city: "", zip: "", sort: "updated_desc", customFrom: "", customTo: "" },
        {},
        1,
        filtersExpanded,
      ),
      active:
        filters.quickView === "needs_attention" &&
        !filters.q &&
        filters.status === "all" &&
        filters.bucket === "all" &&
        filters.datePreset === "all" &&
        !filters.city &&
        !filters.zip,
    },
    {
      key: "overdue_confirmed",
      label: "Overdue confirmed",
      href: buildScopedHref(
        { ...filters, q: "", quickView: "overdue_confirmed", status: "all", bucket: "all", dateField: "delivery_date", datePreset: "all", city: "", zip: "", sort: "updated_desc", customFrom: "", customTo: "" },
        {},
        1,
        filtersExpanded,
      ),
      active:
        filters.quickView === "overdue_confirmed" &&
        !filters.q &&
        filters.status === "all" &&
        filters.bucket === "all" &&
        filters.datePreset === "all" &&
        !filters.city &&
        !filters.zip,
    },
    {
      key: "overdue_pickups",
      label: "Overdue pickups",
      href: buildScopedHref(
        { ...filters, q: "", quickView: "overdue_pickups", status: "all", bucket: "all", dateField: "delivery_date", datePreset: "all", city: "", zip: "", sort: "updated_desc", customFrom: "", customTo: "" },
        {},
        1,
        filtersExpanded,
      ),
      active:
        filters.quickView === "overdue_pickups" &&
        !filters.q &&
        filters.status === "all" &&
        filters.bucket === "all" &&
        filters.datePreset === "all" &&
        !filters.city &&
        !filters.zip,
    },
    {
      key: "active",
      label: "Active / on-site",
      href: buildScopedHref(
        { ...filters, q: "", quickView: "active", status: "all", bucket: "active", dateField: "delivery_date", datePreset: "all", city: "", zip: "", sort: "updated_desc", customFrom: "", customTo: "" },
        {},
        1,
        filtersExpanded,
      ),
      active:
        filters.quickView === "active" &&
        !filters.q &&
        filters.status === "all" &&
        filters.bucket === "active" &&
        filters.datePreset === "all" &&
        !filters.city &&
        !filters.zip,
    },
    {
      key: "holds",
      label: "Holds",
      href: buildScopedHref(
        { ...filters, q: "", quickView: "holds", status: "all", bucket: "holds", dateField: "delivery_date", datePreset: "all", city: "", zip: "", sort: "updated_desc", customFrom: "", customTo: "" },
        {},
        1,
        filtersExpanded,
      ),
      active:
        filters.quickView === "holds" &&
        !filters.q &&
        filters.status === "all" &&
        filters.bucket === "holds" &&
        filters.datePreset === "all" &&
        !filters.city &&
        !filters.zip,
    },
  ];
  const filtersFormContent = (
    <>
      {activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <Link
              key={chip.key}
              href={chip.href}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white"
            >
              {chip.label}
              <XMarkIcon className="h-3.5 w-3.5 text-slate-400" />
            </Link>
          ))}
        </div>
      ) : null}
      <div className="grid gap-x-4 gap-y-5 xl:grid-cols-[minmax(0,2.2fr)_220px_220px] xl:items-start">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-semibold text-slate-700">Search</label>
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Search booking ref, email, phone, contact name, or address"
              className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10"
            />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Sort</label>
          <select
            name="sort"
            defaultValue={filters.sort}
            className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <div className="mb-2 h-5" aria-hidden="true" />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              Apply
            </button>
            {hasFiltersApplied ? (
              <Link
                href={resetFiltersHref}
                className="inline-flex h-12 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Reset
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
          <select name="status" defaultValue={filters.status} className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10">
            <option value="all">All statuses</option>
            <option value="confirmed">confirmed</option>
            <option value="scheduled">scheduled</option>
            <option value="delivered">delivered</option>
            <option value="picked_up">picked_up</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Operational bucket</label>
          <select name="bucket" defaultValue={filters.bucket} className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10">
            <option value="all">All bookings</option>
            <option value="needs_attention">Needs attention</option>
            <option value="active">Active / on-site</option>
            <option value="upcoming">Upcoming</option>
            <option value="holds">Holds</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Date field</label>
          <select name="dateField" defaultValue={filters.dateField} className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10">
            <option value="delivery_date">Delivery date</option>
            <option value="pickup_date">Pickup date</option>
            <option value="created_at">Created date</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Date preset</label>
          <select name="datePreset" defaultValue={filters.datePreset} className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10">
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="next_7_days">Next 7 days</option>
            <option value="last_7_days">Last 7 days</option>
            <option value="this_week">This week</option>
            <option value="this_month">This month</option>
            <option value="custom">Custom range</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">City</label>
          <input name="city" defaultValue={filters.city} placeholder="City" className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">ZIP</label>
          <input name="zip" defaultValue={filters.zip} inputMode="numeric" placeholder="ZIP" className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Page size</label>
          <select name="pageSize" defaultValue={String(filters.pageSize)} className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10">
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:max-w-[480px]">
        {filters.datePreset === "custom" ? (
          <>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Custom from</label>
              <input type="date" name="from" defaultValue={filters.customFrom} className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Custom to</label>
              <input type="date" name="to" defaultValue={filters.customTo} className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10" />
            </div>
          </>
        ) : null}
      </div>
      {filters.datePreset === "custom" ? (
        <div className="text-xs text-slate-500">
          Custom dates only apply when <span className="font-semibold text-slate-700">Date preset</span> is set to <span className="font-semibold text-slate-700">Custom range</span>.
        </div>
      ) : null}
    </>
  );

  return (
    <main className="min-h-screen bg-slate-100">
      <style>{filtersSummaryClasses()}</style>
      <AdminPage className="space-y-8">
        <AdminPageHeader
          title="Bookings"
          actions={
            <AdminPageHelpLink
              href="/admin/docs/customer-booking-identity"
              label="View bookings guide"
            />
          }
        />

        <section className={`grid gap-4 ${activeHoldCount > 0 ? "md:grid-cols-2 xl:grid-cols-6" : "md:grid-cols-2 xl:grid-cols-5"}`}>
          {[
            {
              label: "Needs attention",
              value: visibleNeedsAttention,
              href: getSummaryHref("needs_attention", filters.pageSize, filtersExpanded),
              icon: ClockIcon,
              shellTone: "rose",
              chipTone: "bg-rose-100/90 text-rose-700 ring-1 ring-inset ring-rose-200/80",
              detail: "High-risk or stale follow-up needed",
            },
            {
              label: "Active / on-site",
              value: activeOnSiteCount,
              href: getSummaryHref("active", filters.pageSize, filtersExpanded),
              icon: TruckIcon,
              shellTone: "teal",
              chipTone: "bg-teal-100/90 text-teal-700 ring-1 ring-inset ring-teal-200/80",
              detail: "Currently delivered and not yet picked up",
            },
            {
              label: "Upcoming deliveries",
              value: upcomingDeliveriesCount,
              href: getSummaryHref("upcoming", filters.pageSize, filtersExpanded),
              icon: CalendarDaysIcon,
              shellTone: "blue",
              chipTone: "bg-sky-100/90 text-sky-700 ring-1 ring-inset ring-sky-200/80",
              detail: "Scheduled to go out in the next 7 days",
            },
            {
              label: "Upcoming pickups",
              value: upcomingPickupsCount,
              href: getSummaryHref("upcoming_pickups", filters.pageSize, filtersExpanded),
              icon: ArrowDownTrayIcon,
              shellTone: "amber",
              chipTone: "bg-amber-100/90 text-amber-700 ring-1 ring-inset ring-amber-200/80",
              detail: "Scheduled returns in the next 7 days",
            },
            {
              label: "Recently created",
              value: recentlyCreatedCount,
              href: getSummaryHref("recent", filters.pageSize, filtersExpanded),
              icon: Squares2X2Icon,
              shellTone: "green",
              chipTone: "bg-emerald-100/90 text-emerald-700 ring-1 ring-inset ring-emerald-200/80",
              detail: "Created within the last 7 days",
            },
            ...(activeHoldCount > 0
              ? [
                  {
                    label: "Active holds",
                    value: activeHoldCount,
                    href: getSummaryHref("holds", filters.pageSize, filtersExpanded),
                    icon: ClockIcon,
                    shellTone: "violet",
                    chipTone: "bg-violet-100/90 text-violet-700 ring-1 ring-inset ring-violet-200/80",
                    detail: "Temporary inventory reservations in progress",
                  },
                ]
              : []),
          ].map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.label}
                href={card.href}
                className={summaryCardShell(card.shellTone, "p-5 transition hover:-translate-y-0.5 hover:shadow-md")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-500">{card.label}</div>
                    <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{card.value}</div>
                    <div className="mt-2 text-xs text-slate-500">{card.detail}</div>
                  </div>
                  <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${card.chipTone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </section>

        {filtersExpanded ? (
          <section data-filters className={cardShell("overflow-hidden")}>
            <div className="px-6 py-4">
              <div className="flex w-full items-center gap-6">
                <div className="flex shrink-0 items-center gap-2">
                  <AdjustmentsHorizontalIcon
                    className="h-4 w-4 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                  <div className="text-base font-semibold text-slate-900">Filters</div>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap">
                  {quickViews.map((view) => (
                    <Link
                      key={view.key}
                      href={view.href}
                      className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition ${
                        view.active
                          ? "bg-[#F97316] text-white shadow-sm shadow-orange-100/80"
                          : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      {view.label}
                    </Link>
                  ))}
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-3">
                  <Link
                    href={buildPageHref(filters, currentPage, false)}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2"
                  >
                    <span>Less</span>
                    <ChevronDownIcon className="filters-chevron h-4 w-4 rotate-180 text-current" />
                  </Link>
                </div>
              </div>
            </div>

            <form action="/admin/bookings" method="GET" className="space-y-5 border-t border-slate-100 px-6 py-5">
              <input type="hidden" name="filtersPanel" value="open" />
              {filtersFormContent}
            </form>
          </section>
        ) : (
          <details data-filters className={cardShell("overflow-hidden")}>
            <summary className="list-none cursor-pointer">
              <div className="px-6 py-4">
                <div className="flex w-full items-center gap-6">
                  <div className="flex min-w-0 flex-1 items-center gap-6">
                    <div className="flex shrink-0 items-center gap-2">
                      <AdjustmentsHorizontalIcon
                        className="h-4 w-4 shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                      <div className="text-base font-semibold text-slate-900">Filters</div>
                    </div>
                    <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap">
                      {quickViews.map((view) => (
                        <Link
                          key={view.key}
                          href={view.href}
                          className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition ${
                            view.active
                              ? "bg-[#F97316] text-white shadow-sm shadow-orange-100/80"
                              : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                          }`}
                        >
                          {view.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2">
                      <span>More filters</span>
                      <ChevronDownIcon className="filters-chevron h-4 w-4 text-current" />
                    </span>
                  </div>
                </div>
              </div>
            </summary>

            <form action="/admin/bookings" method="GET" className="space-y-5 border-t border-slate-100 px-6 py-5">
              <input type="hidden" name="filtersPanel" value="open" />
              {filtersFormContent}
            </form>
          </details>
        )}

        <section className={cardShell("overflow-hidden")}>
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">Dumpster Bookings</div>
                {scopeLabel !== "Showing all bookings" ? (
                  <div className="mt-1 text-sm text-slate-500">{scopeLabel}</div>
                ) : null}
              </div>
              {filters.q ? (
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                  Search ranked by strongest identity match first
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 px-6 py-5">
            {!showingHolds && totalFilteredResults > 0 ? (
              <div
                role="row"
                className="hidden rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)_minmax(260px,0.86fr)_minmax(240px,0.95fr)_minmax(140px,0.65fr)] lg:items-center lg:gap-4"
              >
                <div>ID / Status</div>
                <div>Customer</div>
                <div>Service Location</div>
                <div>Dates</div>
                <div>Actions</div>
              </div>
            ) : null}
            {showingHolds
              ? pagedHolds.map((hold) => (
                  <div key={hold.id} className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)_minmax(150px,0.7fr)]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold text-slate-900">Booking hold</div>
                          <span className={pillBase("bg-violet-50 text-violet-700 ring-violet-200")}>Hold</span>
                        </div>
                        <div className="mt-2 text-sm text-slate-600">Reserved for {formatDateLabel(hold.delivery_date)}</div>
                        <div className="mt-1 text-sm text-slate-600">ZIP {hold.zip || "—"}</div>
                        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                          <span>UUID</span>
                          <span className="font-mono text-slate-500" title={hold.id}>{hold.id}</span>
                          <CopyBookingRefButton value={hold.id} label="Copy hold UUID" />
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Hold timing</div>
                        <dl className="mt-2 space-y-1.5 text-sm text-slate-600">
                          <div className="flex items-start justify-between gap-3">
                            <dt>Created</dt>
                            <dd className="text-right font-medium text-slate-900">{formatDateTimeLabel(hold.created_at)}</dd>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <dt>Delivery</dt>
                            <dd className="text-right font-medium text-slate-900">{formatDateLabel(hold.delivery_date)}</dd>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <dt>Expires</dt>
                            <dd className="text-right font-medium text-slate-900">{formatDateTimeLabel(hold.expires_at)}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="flex flex-col gap-2 xl:justify-self-end">
                        <form action="/api/admin/delete-hold" method="POST">
                          <input type="hidden" name="id" value={hold.id} />
                          <input type="hidden" name="redirectTo" value={buildPageHref(filters, currentPage, filtersExpanded)} />
                          <button
                            type="submit"
                            className="inline-flex h-10 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 xl:min-w-[150px]"
                          >
                            Delete hold
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                ))
              : results.map((vm) => {
              const booking = vm.booking;
              const pickupDateCell = getPickupDateCell(vm);

              return (
                <div key={booking.id} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)_minmax(260px,0.86fr)_minmax(240px,0.95fr)_minmax(140px,0.65fr)]">
                    <div className="space-y-3">
                      <div>
                        <div className="text-base font-semibold tracking-tight text-slate-900">
                          {getCustomerFacingBookingLabel(booking.booking_ref)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={pillBase(statusPillClass(booking.status))}>{(booking.status ?? "unknown").replace(/_/g, " ")}</span>
                        {booking.reordered_from_booking_id ? (
                          <span className={pillBase("bg-orange-50 text-orange-700 ring-orange-200")}>Reorder</span>
                        ) : null}
                        {vm.needsAttention ? (
                          <span className={pillBase("bg-rose-50 text-rose-700 ring-rose-200")}>Needs attention</span>
                        ) : null}
                      </div>
                      {vm.rowAlertTone !== "none" && vm.rowAlertSummary && booking.status !== "picked_up" ? (
                        <div className="text-xs text-slate-600">{vm.rowAlertSummary}</div>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-sm font-semibold text-slate-900">{vm.bookedWithName || "No customer name"}</div>
                      <div className="text-sm text-slate-600">{vm.bookedWithEmail || "No email on file"}</div>
                      <div className="text-sm text-slate-600">{vm.bookedWithPhone || "No phone on file"}</div>
                    </div>

                    <div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="min-w-0 text-sm font-semibold leading-6 text-slate-900">{booking.customer_street || "No street on file"}</div>
                          {vm.placementInstructions.length > 0 ? (
                            <button
                              type="button"
                              aria-label="View placement and dispatch notes"
                              className="group relative mt-0.5 shrink-0 rounded-full p-0.5 text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2"
                            >
                              <InformationCircleIcon className="h-4.5 w-4.5" aria-hidden="true" />
                              <span
                                role="tooltip"
                                className="pointer-events-none absolute left-1/2 top-7 z-50 w-72 -translate-x-1/2 translate-y-1 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-3 text-left text-xs font-medium leading-5 text-slate-600 opacity-0 shadow-[0_16px_36px_rgba(15,23,42,0.14)] transition duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
                              >
                                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                  Placement notes
                                </div>
                                <div className="space-y-1.5">
                                  {vm.placementInstructions.map((line) => (
                                    <div key={line}>{line}</div>
                                  ))}
                                </div>
                              </span>
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {[booking.customer_city, booking.customer_zip].filter(Boolean).join(", ") || "No city or ZIP on file"}
                        </div>
                      </div>
                    </div>

                    <div>
                      <dl className="space-y-2 text-sm">
                        <div className="flex items-baseline gap-2">
                          <dt className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-slate-400">Created:</dt>
                          <dd className="min-w-0 font-medium text-slate-900">{formatDateTimeLabel(booking.created_at)}</dd>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <dt className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-slate-400">Delivery:</dt>
                          <dd className="min-w-0 font-medium text-slate-900">{formatDateLabel(booking.delivery_date)}</dd>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <dt className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-slate-400">{pickupDateCell.label}:</dt>
                          <dd className="min-w-0 font-medium text-slate-900">{pickupDateCell.value}</dd>
                        </div>
                        {vm.daysOnSite !== null ? (
                          <div className="flex items-baseline gap-2">
                            <dt className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-slate-400">Days on site:</dt>
                            <dd className="min-w-0 font-medium text-slate-900">{vm.daysOnSite}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>

                    <div className="flex flex-col gap-2 xl:pl-2 2xl:pl-0">
                      <Link
                        href={`/admin/bookings/${encodeURIComponent(booking.id)}`}
                        className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 xl:min-w-[150px]"
                      >
                        View booking
                      </Link>
                      {booking.customer_id ? (
                        <Link
                          href={`/admin/customers/${encodeURIComponent(booking.customer_id)}`}
                          className="inline-flex h-10 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-700 xl:min-w-[150px]"
                        >
                          Open customer
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}

            {totalFilteredResults === 0 ? (
              hasFiltersApplied ? (
                <EmptyState
                  title={showingHolds ? "No holds matched your current search and filters" : "No bookings matched your current search and filters"}
                  copy={
                    showingHolds
                      ? `Nothing matched this scope. ${scopeLabel}. Remove one or more filters or search all holds to widen the result set.`
                      : "No results found for this search. The booking may still be available under a different identifier, especially if customer details changed after the booking was created."
                  }
                  resetHref={filtersExpanded ? resetFiltersHref : clearAllHref}
                  tips={noResultsTips}
                />
              ) : (
                <EmptyState
                  title={showingHolds ? "No active holds right now" : "No bookings yet"}
                  copy={showingHolds ? "Active booking holds will appear here when inventory is being temporarily reserved." : "Bookings will appear here once customers start placing orders."}
                  resetHref={filtersExpanded ? resetFiltersHref : clearAllHref}
                />
              )
            ) : null}

            {totalFilteredResults > filters.pageSize ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span>
                    Showing {pageStart + 1}-{Math.min(pageStart + filters.pageSize, totalFilteredResults)} of {totalFilteredResults} matching {showingHolds ? "holds" : "bookings"}
                  </span>
                  <span className="text-slate-300">•</span>
                  <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
                    {[25, 50, 100].map((size) => (
                      <Link
                        key={size}
                        href={buildScopedHref(filters, { pageSize: size as 25 | 50 | 100 }, 1, filtersExpanded)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          filters.pageSize === size ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {size}/page
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={buildPageHref(filters, Math.max(1, currentPage - 1), filtersExpanded)}
                    className={`inline-flex h-10 items-center rounded-2xl border px-4 text-sm font-semibold transition ${
                      currentPage === 1
                        ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Previous
                  </Link>
                  <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Link
                    href={buildPageHref(filters, Math.min(totalPages, currentPage + 1), filtersExpanded)}
                    className={`inline-flex h-10 items-center rounded-2xl border px-4 text-sm font-semibold transition ${
                      currentPage === totalPages
                        ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Next
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </AdminPage>
    </main>
  );
}
