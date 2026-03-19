// src/app/admin/bookings/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import {
  CalendarDaysIcon,
  ChevronDownIcon,
  ClockIcon,
  EllipsisHorizontalIcon,
  FunnelIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { EMPTY_BOOKING_PLACEMENT_FIELDS, isBookingSchemaError } from "@/lib/booking-schema";
import {
  getPlacementCompactSignals,
  getPlacementDispatchSummary,
  getPlacementPreferenceLabel,
  sanitizePlacementDetails,
} from "@/lib/placement";
import {
  buildPickupPlanningModel,
  getAvailabilityRiskClasses,
} from "@/lib/pickup-planning";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SearchParams = Record<string, string | string[] | undefined>;
type BookingRow = {
  id: string;
  created_at: string | null;
  status: string | null;
  reordered_from_booking_id: string | null;
  customer_name: string | null;
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

function sp(obj: SearchParams, key: string) {
  const v = obj[key];
  return Array.isArray(v) ? v[0] : v;
}

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function todayISOET() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function pillBase(className: string) {
  return `inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset leading-5 ${className}`;
}

function cardShell(extra = "") {
  return `rounded-[28px] border border-slate-200/80 bg-white shadow-sm ${extra}`;
}

const BOOKING_PLACEMENT_SELECT =
  "placement_preference, placement_details, access_issues, gate_instructions, delivery_presence, alternate_contact_name, alternate_contact_phone, placement_photo_url, special_delivery_instructions";

const BOOKING_LIST_SELECT = `id, created_at, status, reordered_from_booking_id, customer_name, customer_city, customer_zip, delivery_date, pickup_mode, pickup_date, ${BOOKING_PLACEMENT_SELECT}`;
const BOOKING_LIST_SELECT_WITH_REORDER_ONLY =
  "id, created_at, status, reordered_from_booking_id, customer_name, customer_city, customer_zip, delivery_date, pickup_mode, pickup_date";
const BASE_BOOKING_LIST_SELECT =
  "id, created_at, status, customer_name, customer_city, customer_zip, delivery_date, pickup_mode, pickup_date";

function withEmptyPlacementFields(rows: Omit<BookingRow, keyof typeof EMPTY_BOOKING_PLACEMENT_FIELDS>[]) {
  return rows.map((row) => ({
    ...row,
    reordered_from_booking_id: null,
    ...EMPTY_BOOKING_PLACEMENT_FIELDS,
  })) as BookingRow[];
}

async function runBookingQuery(
  build: (selectClause: string) => Promise<{ data: BookingRow[] | null; error: { message?: string | null } | null }>,
) {
  const { data, error } = await build(BOOKING_LIST_SELECT);

  if (error && isBookingSchemaError(error)) {
    const reorderFallback = await build(BOOKING_LIST_SELECT_WITH_REORDER_ONLY);

    if (!reorderFallback.error) {
      return withEmptyPlacementFields(
        (reorderFallback.data ?? []) as Omit<BookingRow, keyof typeof EMPTY_BOOKING_PLACEMENT_FIELDS>[],
      );
    }

    if (isBookingSchemaError(reorderFallback.error)) {
      const fallback = await build(BASE_BOOKING_LIST_SELECT);
      if (fallback.error) {
        console.error("ADMIN BOOKINGS ERROR:", fallback.error);
        return [];
      }

      return withEmptyPlacementFields(
        (fallback.data ?? []) as Omit<BookingRow, keyof typeof EMPTY_BOOKING_PLACEMENT_FIELDS>[],
      );
    }

    console.error("ADMIN BOOKINGS ERROR:", reorderFallback.error);
    return [];
  }

  if (error) {
    console.error("ADMIN BOOKINGS ERROR:", error);
    return [];
  }

  return (data ?? []) as BookingRow[];
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

function getPlacementViewModel(row: BookingRow) {
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

  const summary = getPlacementDispatchSummary(placement);
  const signals = getPlacementCompactSignals(placement, 4);
  const preferenceLabel =
    placement.placementPreference ? getPlacementPreferenceLabel(placement.placementPreference) : null;

  return { summary, signals, preferenceLabel };
}

function getPickupViewModel(row: BookingRow, futureDeliveryDates: string[]) {
  return buildPickupPlanningModel({
    deliveryDate: row.delivery_date,
    pickupDate: row.pickup_date,
    pickupMode: row.pickup_mode,
    futureDeliveryDates,
  });
}

function applyWhenFilter<
  T extends {
    lt: (column: string, value: string) => T;
    eq: (column: string, value: string) => T;
    gt: (column: string, value: string) => T;
  },
>(q: T, when: string | undefined, today: string) {
  if (!when || when === "all") return q;
  if (when === "past") return q.lt("delivery_date", today);
  if (when === "current") return q.eq("delivery_date", today);
  if (when === "future") return q.gt("delivery_date", today);
  return q;
}

function statusPillClass(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();


  if (s === "confirmed" || s === "paid")
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (s === "scheduled") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (s === "draft") return "bg-slate-100 text-slate-700 ring-slate-200";
  if (s === "cancelled") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (s === "delivered") return "bg-slate-900 text-white ring-slate-900/10";
  if (s === "picked_up") return "bg-slate-900 text-white ring-slate-900/10";

  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function parseISODateOnly(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d); // local midnight
}

function formatDateLabel(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

function startOfDayLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function deliveryBadge(deliveryDate: string | null | undefined) {
  if (!deliveryDate) {
    return { label: "No date", color: "bg-slate-100 text-slate-700 ring-slate-200" };
  }

  const today = startOfDayLocal(new Date());
  const d = parseISODateOnly(deliveryDate);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0)
    return { label: "Today", color: "bg-[#F97316]/10 text-[#F97316] ring-[#F97316]/20" };
  if (diffDays === 1)
    return { label: "Tomorrow", color: "bg-blue-100 text-blue-800 ring-blue-200" };
  if (diffDays > 1 && diffDays <= 7)
    return { label: `In ${diffDays} days`, color: "bg-emerald-100 text-emerald-800 ring-emerald-200" };

  if (diffDays === -1)
    return { label: "Yesterday", color: "bg-amber-50 text-amber-700 ring-amber-200" };
  if (diffDays < -1 && diffDays >= -7)
    return { label: `${Math.abs(diffDays)} days ago`, color: "bg-amber-50 text-amber-700 ring-amber-200" };

  if (diffDays < -7)
    return { label: "Past", color: "bg-slate-100 text-slate-800 ring-slate-200" };

  return { label: "Scheduled", color: "bg-blue-100 text-blue-800 ring-blue-200" };
}

async function getBookings(filters: {
  when?: string;
  status?: string;
  zip?: string;
  dateFrom?: string;
  dateTo?: string;
  pickup?: string;
}) {
  const today = todayISO();

  return runBookingQuery((selectClause) => {
    let q = supabaseAdmin
      .from("bookings")
      .select(selectClause)
      .order("created_at", { ascending: false })
      .limit(200);

    q = applyWhenFilter(q, filters.when, today);

    if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
    if (filters.pickup && filters.pickup !== "all") q = q.eq("pickup_mode", filters.pickup);
    if (filters.zip) q = q.eq("customer_zip", filters.zip);
    if (filters.dateFrom) q = q.gte("delivery_date", filters.dateFrom);
    if (filters.dateTo) q = q.lte("delivery_date", filters.dateTo);

    return q;
  });
}

function bookingIndicatorColor(b: BookingRow) {
  const s = (b.status ?? "").toLowerCase();

  if (["cancelled", "delivered", "picked_up"].includes(s)) return "#0F172A";
  if (s === "picked_up") return "#0F172A";

  if (!b.delivery_date) return "#CBD5E1";

  const today = startOfDayLocal(new Date());
  const d = parseISODateOnly(b.delivery_date);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0 && ["confirmed", "paid", "scheduled", "draft"].includes(s)) return "#F43F5E"; // red
  if (diffDays === 0) return "#F97316"; // orange (today)
  if (diffDays > 0 && diffDays <= 7) return "#10B981"; // green
  if (diffDays > 7) return "#3B82F6"; // blue

  return "#CBD5E1";
}

function bookingUrgencyTone(b: BookingRow) {
  const s = (b.status ?? "").toLowerCase();
  if (!b.delivery_date) return "normal";
  if (["cancelled", "delivered"].includes(s)) return "normal";
  if (["cancelled", "delivered", "picked_up"].includes(s)) return "normal";

  const today = startOfDayLocal(new Date());
  const d = parseISODateOnly(b.delivery_date);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0 && ["confirmed", "paid", "scheduled", "draft"].includes(s)) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays > 0 && diffDays <= 2) return "soon";
  return "normal";
}



async function getActiveHolds() {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("booking_holds")
    .select("id, created_at, delivery_date, expires_at, zip")
    .eq("status", "active")
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("ADMIN HOLDS (ACTIVE) ERROR:", error);
    return [];
  }
  return data ?? [];
}

async function getExpiredHolds() {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("booking_holds")
    .select("id, created_at, delivery_date, expires_at, zip, status")
    .or(`status.eq.expired,expires_at.lte.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("ADMIN HOLDS (EXPIRED) ERROR:", error);
    return [];
  }
  return data ?? [];
}

function isHoldExpired(expires_at: string | null | undefined) {
  if (!expires_at) return true;
  return new Date(expires_at).getTime() < Date.now();
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const spObj = await Promise.resolve(searchParams ?? {});

  const dashboardView = sp(spObj, "view") || "";
  const dashboardDate = sp(spObj, "date") || "";

  const whenParam = sp(spObj, "when") || "";
  const statusParam = sp(spObj, "status") || "";
  const pickupParam = sp(spObj, "pickup") || "";
  const zipRaw = sp(spObj, "zip") || "";
  const fromParam = sp(spObj, "from") || "";
  const toParam = sp(spObj, "to") || "";
  const holdsView = (sp(spObj, "holds") || "active") as "active" | "expired";

  const when =
    whenParam ||
    (dashboardView === "deliveries-today"
      ? "all"
      : dashboardView === "pickups-waiting"
      ? "all"
      : dashboardView === "on-site"
      ? "all"
      : "current");

  const status =
    statusParam ||
    (dashboardView === "deliveries-today"
      ? "confirmed"
      : dashboardView === "pickups-waiting"
      ? "delivered"
      : dashboardView === "on-site"
      ? "delivered"
      : "all");

  const pickup =
    pickupParam ||
    (dashboardView === "pickups-waiting" ? "request" : "all");

  const dateFrom =
    fromParam ||
    (dashboardView === "deliveries-today" ? dashboardDate : "");

  const dateTo =
    toParam ||
    (dashboardView === "deliveries-today" ? dashboardDate : "");
  

  const labelClass = "block text-sm font-semibold text-slate-700 mb-2";

  const controlClass =
    "w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-[15px] text-slate-900 " +
    "shadow-sm placeholder:text-slate-400 " +
    "focus:outline-none focus:ring-4 focus:ring-[#F97316]/15 focus:border-[#F97316]/40";

  const selectClass =
    controlClass +
    " appearance-none pr-10"; // room for chevron

  const dateClass =
    controlClass +
    " appearance-none"; // helps on iOS


  const zip = zipRaw.replace(/[^\d]/g, "").slice(0, 5);

  const baseQs = new URLSearchParams();

  if (when) baseQs.set("when", when);
  if (status) baseQs.set("status", status);
  if (pickup) baseQs.set("pickup", pickup);
  if (zip) baseQs.set("zip", zip);
  if (dateFrom) baseQs.set("from", dateFrom);
  if (dateTo) baseQs.set("to", dateTo);

  const activeQs = new URLSearchParams(baseQs);
  activeQs.set("holds", "active");

  const expiredQs = new URLSearchParams(baseQs);
  expiredQs.set("holds", "expired");

  const holdsActiveHref = `/admin/bookings?${activeQs.toString()}#holds`;
  const holdsExpiredHref = `/admin/bookings?${expiredQs.toString()}#holds`;

  const hasFilters =
    when !== "current" || status !== "all" || Boolean(zip) || Boolean(dateFrom) || Boolean(dateTo);

  const isDefaultView = !hasFilters;
  const today = todayISO();
  const todayET = todayISOET();

  const [bookings, holds] = await Promise.all([
    (async () => {
      if (!isDefaultView) {
        return getBookings({
          when,
          status,
          pickup,
          zip: zip || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });
      }

      // ✅ Default Ops View
      const now = new Date();

      // 1️⃣ Currently active (delivery <= today) and in active-ish statuses
      const active = await runBookingQuery((selectClause) =>
        supabaseAdmin
          .from("bookings")
          .select(selectClause)
          .lte("delivery_date", today)
          .in("status", ["confirmed", "paid", "scheduled", "delivered"])
          .order("delivery_date", { ascending: true }),
      );

      // 2️⃣ This week (Sun-Sat)
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);

      const week = await runBookingQuery((selectClause) =>
        supabaseAdmin
          .from("bookings")
          .select(selectClause)
          .gte("delivery_date", startStr)
          .lte("delivery_date", endStr)
          .order("delivery_date", { ascending: true }),
      );

      const combinedRaw = [...active, ...week] as BookingRow[];
      const combined = Array.from(new Map(combinedRaw.map((b) => [b.id, b])).values());

      if (combined.length > 0) return combined;

      // 3️⃣ Fallback: next 3 upcoming
      return runBookingQuery((selectClause) =>
        supabaseAdmin
          .from("bookings")
          .select(selectClause)
          .gt("delivery_date", today)
          .order("delivery_date", { ascending: true })
          .limit(3),
      );
    })(),
    holdsView === "expired" ? getExpiredHolds() : getActiveHolds(),
  ]);

  const futureInventoryDeliveriesResult = await supabaseAdmin
    .from("bookings")
    .select("id, delivery_date")
    .in("status", ["confirmed", "scheduled"])
    .gte("delivery_date", today)
    .order("delivery_date", { ascending: true })
    .limit(200);

  const futureInventoryDeliveries = (futureInventoryDeliveriesResult.data ?? [])
    .map((row) => ({ id: row.id as string, deliveryDate: row.delivery_date as string | null }))
    .filter((row) => Boolean(row.deliveryDate));

  const holdsVisible = holds ?? [];
  const activeBookingCount = bookings.filter((b) =>
    ["confirmed", "paid", "scheduled", "delivered"].includes((b.status ?? "").toLowerCase()),
  ).length;
  const todayBookingCount = bookings.filter((b) => (b.delivery_date ?? "") === todayET).length;

  return (
    <main className="min-h-screen bg-slate-100">
      <style>{`
        /* default */
        [data-filters] .filters-collapse { display: none; }

        /* when <details> is open */
        [data-filters][open] .filters-expand { display: none; }
        [data-filters][open] .filters-collapse { display: inline-block; }

        [data-filters] .filters-chevron { transition: transform 200ms ease; }
        [data-filters][open] .filters-chevron { transform: rotate(180deg); }
      `}</style>
      <div className="mx-auto max-w-7xl px-6 pb-16 pt-10">
        {/* Page header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center rounded-full bg-[#F97316]/10 px-3 py-1 text-xs font-semibold text-[#F97316]">
              Admin
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Bookings
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Manage booking operations, dispatch timelines, and active holds in one workspace.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow-sm sm:inline-flex">
              Today: {todayET}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              {bookings.length} bookings
            </span>
          </div>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className={cardShell("p-5")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-500">Visible bookings</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  {bookings.length}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Current result set for the selected view
                </div>
              </div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F97316]/10 text-[#F97316]">
                <CalendarDaysIcon className="h-6 w-6" />
              </span>
            </div>
          </div>

          <div className={cardShell("p-5")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-500">Active jobs</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  {activeBookingCount}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Confirmed, scheduled, paid, and delivered bookings
                </div>
              </div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <TicketIcon className="h-6 w-6" />
              </span>
            </div>
          </div>

          <div className={cardShell("p-5")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-500">Holds in view</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  {holdsVisible.length}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {holdsView === "expired" ? "Expired holds" : "Active holds"} plus {todayBookingCount} deliveries today
                </div>
              </div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <ClockIcon className="h-6 w-6" />
              </span>
            </div>
          </div>
        </section>

        {/* Layout */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Filters */}
          <section className="lg:col-span-4">
            <details
              data-filters
              className={cardShell("group overflow-hidden")}
              open={hasFilters}
            >
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-4 px-6 py-5">
                  {/* LEFT: icon + title */}
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F97316]/10 text-[#F97316]">
                      <FunnelIcon className="h-6 w-6" />
                    </span>

                    <div className="min-w-0">
                      <div className="text-base font-semibold leading-5 text-slate-900">Filters</div>
                      <div className="mt-1 text-sm text-slate-500">
                        Narrow bookings by date, status, pickup mode, and ZIP.
                      </div>
                    </div>
                  </div>

                  {/* visual-only control (don’t steal clicks from <summary>) */}
                  <span
                    aria-hidden="true"
                    className="
                      pointer-events-none select-none
                      inline-flex h-8 items-stretch overflow-hidden rounded-xl
                      shrink-0
                    "
                    style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
                  >
                    <span className="flex items-center px-3 text-sm font-semibold text-slate-700">
                      <span className="filters-expand">Expand</span>
                      <span className="filters-collapse">Collapse</span>
                    </span>

                    <span
                      className="flex items-center justify-center px-3 text-slate-500"
                      style={{ borderLeft: "1px solid #E2E8F0" }}
                    >
                      <ChevronDownIcon className="filters-chevron h-4 w-4" />
                    </span>
                  </span>
                </div>
              </summary>


              
              
              <div className="border-t border-slate-200 bg-slate-50/70 px-6 py-6">
                <form action="/admin/bookings" method="GET" className="grid gap-4">
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                    <div>
                      <label className={labelClass}>When</label>
                      <div className="relative">
                        <select
                          name="when"
                          defaultValue={when}
                          className={selectClass}
                        >
                          <option value="all">All</option>
                          <option value="past">Past</option>
                          <option value="current">Current (today)</option>
                          <option value="future">Future</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Status</label>
                      <div className="relative">
                        <select
                          name="status"
                          defaultValue={status}
                          className={selectClass}
                        >
                          <option value="all">All</option>
                          <option value="draft">draft</option>
                          <option value="paid">paid</option>
                          <option value="scheduled">scheduled</option>
                          <option value="confirmed">confirmed</option>
                          <option value="delivered">delivered</option>
                          <option value="cancelled">cancelled</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Pickup</label>
                      <div className="relative">
                        <select
                          name="pickup"
                          defaultValue={pickup}
                          className={selectClass}
                        >
                          <option value="all">All</option>
                          <option value="request">request</option>
                          <option value="scheduled">scheduled</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>ZIP</label>
                      <div className="relative">
                        <input
                          name="zip"
                          inputMode="numeric"
                          defaultValue={zip}
                          placeholder="e.g., 13032"
                          className={controlClass}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Delivery from</label>
                      <div className="relative">
                        <input
                          type="date"
                          name="from"
                          defaultValue={dateFrom}
                          className={dateClass}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Delivery to</label>
                      <div className="relative">
                        <input
                          type="date"
                          name="to"
                          defaultValue={dateTo}
                          className={dateClass}
                        />
                      </div>
                    </div>
                  </div>

                  
                  <div className="flex flex-wrap items-center gap-3 pt-5">
                    <button
                      type="submit"
                      className="inline-flex h-12 items-center rounded-2xl bg-[#F97316] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
                    >
                      Apply filters
                    </button>

                    <Link
                      href="/admin/bookings"
                      className="inline-flex h-12 items-center rounded-2xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      Clear
                    </Link>
                  </div>
                </form>
              </div>
            </details>
          </section>

          {/* Content */}
          <section className="space-y-6 lg:col-span-8">
            {/* Bookings card */}
            <div
              id="bookings"
              className={`scroll-mt-24 overflow-hidden ${cardShell()}`}
            >
                <div className="border-b border-slate-200 px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">Bookings</div>
                    <div className="mt-1 text-sm text-slate-500">Showing {bookings.length} bookings</div>
                  </div>

                  <span
                    className={pillBase(
                      isDefaultView
                        ? "bg-slate-100 text-slate-700 ring-slate-200"
                        : "bg-[#F97316]/10 text-[#F97316] ring-[#F97316]/20"
                    )}
                  >
                    {isDefaultView ? "DEFAULT VIEW" : "FILTERED"}
                  </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 border-b border-slate-200 bg-slate-50/60 px-6 py-4 text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">Delivery timing:</span>

                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
                    Overdue
                  </span>

                  <span className="flex items-center gap-2">
                    <span style={{ width: 10, height: 10, borderRadius: 9999, background: "#f97316", display: "inline-block" }} />
                    Today
                  </span>

                  <span className="flex items-center gap-2">
                    <span style={{ width: 10, height: 10, borderRadius: 9999, background: "#22c55e", display: "inline-block" }} />
                    Next 7 days
                  </span>

                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                    Future
                  </span>
                </div>
              
              <div className="space-y-4 px-6 py-5 overflow-visible">
                {bookings.map((b) => (
                  <div
                    key={b.id}
                    className={[
                      "group relative overflow-visible rounded-[28px] border p-5 pl-7 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md",
                      bookingUrgencyTone(b) === "overdue"
                        ? "border-rose-200 bg-rose-50/50 ring-1 ring-rose-200/70"
                        : bookingUrgencyTone(b) === "today"
                          ? "border-[#F97316]/25 bg-[#F97316]/[0.06] ring-1 ring-[#F97316]/20"
                        : bookingUrgencyTone(b) === "soon"
                            ? "border-emerald-200/70 bg-emerald-50/30 ring-1 ring-emerald-200/40"
                            : "border-slate-200 bg-white",
                    ].join(" ")}
                  >
                    {/* LEFT quick indicator rail */}
                    <div
                      className="absolute left-0 top-0 h-full w-2 rounded-l-2xl"
                      style={{ backgroundColor: bookingIndicatorColor(b) }}
                    />

                    <div className="flex items-start justify-between gap-4">
                      {/* LEFT */}
                      <div className="min-w-0 flex-1 relative z-0">
                        {(() => {
                          const placementView = getPlacementViewModel(b);
                          const pickupView = getPickupViewModel(
                            b,
                            futureInventoryDeliveries
                              .filter((row) => row.id !== b.id)
                              .map((row) => row.deliveryDate as string),
                          );

                          return (
                            <>
                        {/* Row 1: Title + pills */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold text-slate-900">
                            {b.customer_name ?? "—"}
                          </div>

                          <span className={pillBase(statusPillClass(b.status))}>
                            {(b.status ?? "—").toUpperCase()}
                          </span>

                          {b.reordered_from_booking_id ? (
                            <span className={pillBase("bg-orange-50 text-orange-700 ring-orange-200")}>
                              Reorder
                            </span>
                          ) : null}
                        </div>

                        {/* Row 2: Location */}
                        <div className="mt-1 text-sm text-slate-600">
                          {b.customer_city ?? "—"}, NY{" "}
                          <span className="font-medium text-slate-900">{b.customer_zip ?? "—"}</span>
                        </div>

                        {placementView.preferenceLabel || placementView.signals.length ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {placementView.preferenceLabel ? (
                              <span className={pillBase("bg-slate-100 text-slate-700 ring-slate-200")}>
                                {placementView.preferenceLabel}
                              </span>
                            ) : null}
                            {placementView.signals.map((signal) => (
                              <span
                                key={signal.key}
                                className={pillBase(placementSignalClasses(signal.tone))}
                              >
                                {signal.label}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {/* Meta panel */}
                        <div className="mt-3 rounded-2xl bg-slate-50/80 px-4 py-3 ring-1 ring-slate-200">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-700">
                            {/* Delivery */}
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">Delivery:</span>
                              <span className="font-semibold text-slate-900">{b.delivery_date ?? "—"}</span>

                              {b.delivery_date
                                ? (() => {
                                    const badge = deliveryBadge(b.delivery_date);
                                    return <span className={pillBase(badge.color)}>{badge.label}</span>;
                                  })()
                                : null}
                            </div>

                            <span className="text-slate-300">•</span>

                            {/* Pickup */}
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">Pickup:</span>
                              <span className="font-semibold text-slate-900">
                                {pickupView.pickupStatus === "scheduled"
                                  ? `Scheduled: ${pickupView.scheduledPickupDate ?? "—"}`
                                  : pickupView.pickupStatusLabel}
                              </span>
                            </div>
                          </div>

                          {/* ID row */}
                          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                            <span className="text-slate-500">ID:</span>
                            <span className="font-mono break-all">{b.id}</span>

                            {/* optional “copy” affordance (visual only, since this is server component) */}
                            <span className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200">
                              ⧉
                            </span>
                          </div>

                          {b.reordered_from_booking_id ? (
                            <div className="mt-2 text-xs text-slate-500">
                              Based on prior rental{" "}
                              <span className="font-mono text-slate-700">
                                {b.reordered_from_booking_id.slice(0, 8)}
                              </span>
                            </div>
                          ) : null}

                          {placementView.summary !== "No placement details collected" ? (
                            <div className="mt-3 rounded-xl bg-white px-3 py-2.5 text-sm text-slate-600 ring-1 ring-slate-200">
                              <span className="font-semibold text-slate-900">Dispatch:</span>{" "}
                              {placementView.summary}
                            </div>
                          ) : null}

                          {(pickupView.expectedAvailableDate || pickupView.risk !== "none") ? (
                            <div className="mt-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
                              {pickupView.expectedAvailableDate ? (
                                <div className="text-sm text-slate-600">
                                  <span className="font-semibold text-slate-900">Expected available:</span>{" "}
                                  {formatDateLabel(pickupView.expectedAvailableDate)}
                                </div>
                              ) : null}
                              {pickupView.risk !== "none" ? (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span
                                    className={pillBase(
                                      getAvailabilityRiskClasses(pickupView.risk),
                                    )}
                                  >
                                    {pickupView.riskLabel}
                                  </span>
                                  {pickupView.riskMessage ? (
                                    <span className="text-xs text-slate-500">{pickupView.riskMessage}</span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* RIGHT actions */}
                      <div className="relative shrink-0 z-10">
                        <details className="group relative">
                          <summary
                            className="
                              list-none cursor-pointer
                              inline-flex h-10 w-10 items-center justify-center
                              rounded-2xl border border-slate-200 bg-white
                              text-slate-700 shadow-sm
                              hover:bg-slate-50
                              focus:outline-none focus:ring-4 focus:ring-[#F97316]/10
                            "
                            aria-label="Booking actions"
                            title="Actions"
                          >
                            <EllipsisHorizontalIcon className="h-5 w-5" />
                          </summary>

                          <div className="absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                            <Link
                              href={`/admin/bookings/${encodeURIComponent(b.id)}`}
                              className="block whitespace-nowrap px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </Link>

                            <form action="/api/admin/mark-delivered?debug=1" method="POST">
                              <input type="hidden" name="id" value={b.id} />
                              <input
                                type="hidden"
                                name="redirectTo"
                                value={`/admin/bookings?${baseQs.toString()}#bookings`}
                              />
                              <button
                                type="submit"
                                className="w-full whitespace-nowrap text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Mark delivered
                              </button>
                            </form>

                            <form action="/api/admin/mark-picked-up" method="POST">
                              <input type="hidden" name="id" value={b.id} />
                              <input
                                type="hidden"
                                name="redirectTo"
                                value={`/admin/bookings?${baseQs.toString()}#bookings`}
                              />
                              <button
                                type="submit"
                                className="w-full whitespace-nowrap text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Mark picked up
                              </button>
                            </form>

                            <div className="h-px bg-slate-200" />

                            <form action="/api/admin/delete-booking" method="POST">
                              <input type="hidden" name="id" value={b.id} />
                              <input
                                type="hidden"
                                name="redirectTo"
                                value={`/admin/bookings?${baseQs.toString()}#bookings`}
                              />
                              <button
                                type="submit"
                                className="w-full whitespace-nowrap text-left px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                              >
                                Delete
                              </button>
                            </form>
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                ))}

                {bookings.length === 0 ? (
                  <div className="p-6">
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-sm text-slate-600">
                      No bookings found.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Holds card */}
              <div
                id="holds"
                className={`scroll-mt-24 overflow-hidden ${cardShell()}`}
              >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Booking holds</div>
                  <div className="mt-1 text-sm text-slate-500">
                    Showing {holdsVisible.length} {holdsView === "expired" ? "expired" : "active"} holds
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                    <a
                      href={holdsActiveHref}
                      className={[
                        "px-3 py-1.5 text-xs font-semibold rounded-full transition",
                        holdsView === "active"
                          ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                          : "text-slate-500 hover:text-slate-700",
                      ].join(" ")}
                    >
                      Active
                    </a>
                    <a
                      href={holdsExpiredHref}
                      className={[
                        "px-3 py-1.5 text-xs font-semibold rounded-full transition",
                        holdsView === "expired"
                          ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                          : "text-slate-500 hover:text-slate-700",
                      ].join(" ")}
                    >
                      Expired
                    </a>
                  </div>

                  <span className={pillBase("bg-slate-100 text-slate-700 ring-slate-200")}>
                    {holdsVisible.length}
                  </span>
                </div>
              </div>

              <div className="space-y-3 p-4 sm:p-6">
                {holdsVisible.map((h: HoldRow) => {
                  const expired = holdsView === "expired" ? true : isHoldExpired(h.expires_at);
                  const zipVal = (h.zip ?? "").toString().trim();
                  const isToday = holdsView !== "expired" && (h.delivery_date ?? "") === todayET;

                  return (
                    <div
                      key={h.id}
                      className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div
                        className={`absolute left-0 top-0 h-full w-1.5 ${
                          expired ? "bg-rose-500" : "bg-[#F97316]"
                        }`}
                      />
                      <div className="flex items-start justify-between gap-4 pl-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-slate-900">
                              Hold for {h.delivery_date ?? "—"}
                            </div>
                            <span
                              className={pillBase(
                                expired
                                  ? "bg-rose-100 text-rose-800 ring-rose-200"
                                  : "bg-emerald-100 text-emerald-800 ring-emerald-200"
                              )}
                            >
                              {expired ? "EXPIRED" : "ACTIVE"}
                            </span>
                            {isToday ? (
                              <span className={pillBase("bg-amber-100 text-amber-900 ring-amber-200")}>
                                TODAY
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-2 text-sm text-slate-600">
                            ZIP <span className="font-medium text-slate-900">{zipVal || "—"}</span>
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            Expires: {h.expires_at
                              ? new Date(h.expires_at).toLocaleString("en-US", { timeZone: "America/New_York" })
                              : "—"}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            ID: <span className="font-mono">{h.id}</span>
                          </div>
                        </div>

                        <form action="/api/admin/delete-hold" method="POST">
                          <input type="hidden" name="id" value={h.id} />
                          <input
                            type="hidden"
                            name="redirectTo"
                            value={`/admin/bookings?${holdsView === "expired" ? expiredQs.toString() : activeQs.toString()}#holds`}
                          />
                          <button
                            type="submit"
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-[#F97316]/10"
                          >
                            Delete hold
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })}

                {/* ✅ Empty state row: more vertical spacing */}
                {holdsVisible.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10">
                    <div className="flex items-center gap-4">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200">
                        💤
                      </span>
                      <div className="text-sm font-medium text-slate-700">
                        No {holdsView === "expired" ? "expired" : "active"} holds right now.
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
