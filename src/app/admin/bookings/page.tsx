// src/app/admin/bookings/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { deleteBookingAction } from "./actions";

type SearchParams = Record<string, string | string[] | undefined>;

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

function applyWhenFilter(q: any, when: string | undefined, today: string) {
  if (!when || when === "all") return q;
  if (when === "past") return q.lt("delivery_date", today);
  if (when === "current") return q.eq("delivery_date", today);
  if (when === "future") return q.gt("delivery_date", today);
  return q;
}

function statusPillClass(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();


  if (s === "confirmed" || s === "paid")
    return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (s === "scheduled") return "bg-blue-100 text-blue-800 ring-blue-200";
  if (s === "draft") return "bg-slate-100 text-slate-800 ring-slate-200";
  if (s === "cancelled") return "bg-rose-100 text-rose-800 ring-rose-200";
  if (s === "delivered") return "bg-slate-900 text-white ring-slate-900/20";
  if (s === "picked_up") return "bg-slate-900 text-white ring-slate-900/20";

  return "bg-slate-100 text-slate-800 ring-slate-200";
}

function parseISODateOnly(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d); // local midnight
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
  const todayET = todayISOET();

  let q = supabaseAdmin
    .from("bookings")
    .select(
      "id, created_at, status, customer_name, customer_city, customer_zip, delivery_date, pickup_mode, pickup_date"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  q = applyWhenFilter(q, filters.when, today);

  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.pickup && filters.pickup !== "all") q = q.eq("pickup_mode", filters.pickup);
  if (filters.zip) q = q.eq("customer_zip", filters.zip);
  if (filters.dateFrom) q = q.gte("delivery_date", filters.dateFrom);
  if (filters.dateTo) q = q.lte("delivery_date", filters.dateTo);

  const { data, error } = await q;
  if (error) {
    console.error("ADMIN BOOKINGS ERROR:", error);
    return [];
  }
  return data ?? [];
}

function bookingIndicatorColor(b: any) {
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

function bookingUrgencyTone(b: any) {
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
  

  const fieldClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 " +
    "shadow-sm placeholder:text-slate-400 " +
    "focus:outline-none focus:ring-4 focus:ring-[#F97316]/15 focus:border-[#F97316]/40";

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
      const { data: active } = await supabaseAdmin
        .from("bookings")
        .select(
          "id, created_at, status, customer_name, customer_city, customer_zip, delivery_date, pickup_mode, pickup_date"
        )
        .lte("delivery_date", today)
        .in("status", ["confirmed", "paid", "scheduled", "delivered"])
        .order("delivery_date", { ascending: true });

      // 2️⃣ This week (Sun-Sat)
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);

      const { data: week } = await supabaseAdmin
        .from("bookings")
        .select(
          "id, created_at, status, customer_name, customer_city, customer_zip, delivery_date, pickup_mode, pickup_date"
        )
        .gte("delivery_date", startStr)
        .lte("delivery_date", endStr)
        .order("delivery_date", { ascending: true });

      const combinedRaw = [...(active ?? []), ...(week ?? [])];
      const combined = Array.from(new Map(combinedRaw.map((b: any) => [b.id, b])).values());

      if (combined.length > 0) return combined;

      // 3️⃣ Fallback: next 3 upcoming
      const { data: upcoming } = await supabaseAdmin
        .from("bookings")
        .select(
          "id, created_at, status, customer_name, customer_city, customer_zip, delivery_date, pickup_mode, pickup_date"
        )
        .gt("delivery_date", today)
        .order("delivery_date", { ascending: true })
        .limit(3);

      return upcoming ?? [];
    })(),
    holdsView === "expired" ? getExpiredHolds() : getActiveHolds(),
  ]);

  const holdsVisible = holds ?? [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <style>{`
        /* default */
        [data-filters] .filters-collapse { display: none; }

        /* when <details> is open */
        [data-filters][open] .filters-expand { display: none; }
        [data-filters][open] .filters-collapse { display: inline-block; }

        [data-filters] .filters-chevron { transition: transform 200ms ease; }
        [data-filters][open] .filters-chevron { transform: rotate(180deg); }
      `}</style>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Bookings</h1>
            <p className="mt-1 text-sm text-slate-600">Manage bookings and holds</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-sm text-slate-500 sm:block">Today: {todayET}</div>
            <span className="inline-flex items-center rounded-full bg-[#F97316]/10 px-3 py-1 text-sm font-semibold text-[#F97316] ring-1 ring-inset ring-[#F97316]/20">
              Admin
            </span>
          </div>
        </div>

        {/* Layout */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Filters */}
          <section className="lg:col-span-4">
            <details
              data-filters
              style={{ backgroundColor: "#2C394A" }}
              className="group rounded-2xl border border-slate-900/10 shadow-sm"
              open={hasFilters}
            >
              <summary className="cursor-pointer list-none text-white">
                <div className="flex items-center justify-between gap-4 px-6 py-4">
                  {/* LEFT: icon + title */}
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#F97316]"
                      aria-hidden="true"
                    >
                      ⚙️
                    </span>

                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold leading-5 text-white">Filters</div>

                      {/* ✅ keep this to ONE line so the header doesn't get tall */}
                      
                    </div>
                  </div>

                  {/* visual-only control (don’t steal clicks from <summary>) */}
                  <span
                    aria-hidden="true"
                    className="
                      pointer-events-none select-none
                      inline-flex h-8 items-stretch overflow-hidden rounded-xl
                      shrink-0
                      mr-2
                    "
                    style={{
                      marginRight: 12,
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    <span className="flex items-center px-3 text-sm font-semibold text-white">
                      <span className="filters-expand">Expand</span>
                      <span className="filters-collapse">Collapse</span>
                    </span>

                    <span
                      className="flex items-center justify-center px-4 text-white/80"
                      style={{ borderLeft: "1px solid rgba(255,255,255,0.15)" }}
                    >
                      <svg className="filters-chevron" width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 4L6 8L10 4"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </span>
                </div>
              </summary>


              
              

              <div className="border-t border-white/10 bg-slate-50 px-6 py-6">
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

                  
                  <div className="flex items-center gap-3 pt-5">
                    <button
                      type="submit"
                      className="
                        h-12
                        rounded-xl
                        bg-[#F97316]
                        px-6
                        text-sm font-semibold text-white
                        shadow-sm
                        hover:bg-[#F97316]/90
                        transition
                        shadow-[0_4px_14px_rgba(249,115,22,0.35)]
                      "
                    >
                      Apply filters
                    </button>

                    <a
                      href="/admin/bookings"
                      className="
                        h-12
                        inline-flex items-center
                        rounded-xl
                        border border-slate-200
                        bg-white
                        px-6
                        text-sm font-semibold text-slate-700
                        shadow-sm
                        hover:bg-slate-100
                        transition
                      "
                    >
                      Clear
                    </a>
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
              className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              
                <div
                  style={{ backgroundColor: "#2C394A" }}
                  className="flex items-center justify-between px-6 py-4 text-white border-b border-slate-900/10 rounded-t-2xl"
                >
                  
                  <div>
                    <div className="text-lg font-semibold text-white">Bookings</div>
                    <div className="text-sm text-white/70">Showing {bookings.length} bookings</div>
                  </div>

                  <span
                    className={pillBase(
                      isDefaultView
                        ? "bg-white text-slate-700 ring-slate-200"
                        : "bg-[#F97316]/10 text-[#F97316] ring-[#F97316]/20"
                    )}
                  >
                    {isDefaultView ? "DEFAULT VIEW" : "FILTERED"}
                  </span>
            
                </div>

                <div className="flex flex-wrap items-center gap-8 border-b border-slate-200 bg-white px-6 py-3 text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">Status:</span>

                  <span className="flex items-center gap-2">
                    <span style={{ width: 10, height: 10, borderRadius: 9999, background: "#ef4444", display: "inline-block" }} />
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
                    <span style={{ width: 10, height: 10, borderRadius: 9999, background: "#3b82f6", display: "inline-block" }} />
                    Future
                  </span>
                </div>
              
              <div className="divide-y divide-slate-100 space-y-4 px-6 py-5 overflow-visible">
                {bookings.map((b: any) => (
                  <div
                    key={b.id}
                    className={[
                      "group relative overflow-visible rounded-2xl p-5 pl-7 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md",
                      bookingUrgencyTone(b) === "overdue"
                        ? "border-rose-200 bg-rose-50/40 ring-1 ring-rose-200/60"
                        : bookingUrgencyTone(b) === "today"
                          ? "border-[#F97316]/25 bg-[#F97316]/[0.06] ring-1 ring-[#F97316]/20"
                          : bookingUrgencyTone(b) === "soon"
                            ? "border-emerald-200/60 bg-emerald-50/30"
                            : "border-slate-200/50 bg-white",
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
                        {/* Row 1: Title + pills */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold text-slate-900">
                            {b.customer_name ?? "—"}
                          </div>

                          <span className={pillBase(statusPillClass(b.status))}>
                            {(b.status ?? "—").toUpperCase()}
                          </span>
                        </div>

                        {/* Row 2: Location */}
                        <div className="mt-1 text-sm text-slate-600">
                          {b.customer_city ?? "—"}, NY{" "}
                          <span className="font-medium text-slate-900">{b.customer_zip ?? "—"}</span>
                        </div>

                        {/* Meta panel */}
                        <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
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
                                {b.pickup_mode === "scheduled"
                                  ? `Scheduled: ${b.pickup_date ?? "—"}`
                                  : "Request"}
                              </span>
                            </div>
                          </div>

                          {/* ID row */}
                          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                            <span className="text-slate-500">ID:</span>
                            <span className="font-mono break-all">{b.id}</span>

                            {/* optional “copy” affordance (visual only, since this is server component) */}
                            <span className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 ring-1 ring-slate-200">
                              ⧉
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* RIGHT actions */}
                      <div className="relative shrink-0 z-10">
                        <details className="group relative">
                          <summary
                            className="
                              list-none cursor-pointer
                              inline-flex h-9 w-9 items-center justify-center
                              rounded-xl border border-slate-200 bg-white
                              text-slate-700 shadow-sm
                              hover:bg-slate-50
                              focus:outline-none focus:ring-4 focus:ring-[#F97316]/10
                            "
                            aria-label="Booking actions"
                            title="Actions"
                          >
                            <span className="text-xl leading-none">…</span>
                          </summary>

                          <div className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                            <a
                              href={`/admin/bookings/${encodeURIComponent(b.id)}`}
                              className="block whitespace-nowrap px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </a>

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
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                      No bookings found.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Holds card */}
              <div
                id="holds"
                className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
              {/* ✅ Header background matches bookings header */}
              <div
                style={{ backgroundColor: "#2C394A" }}
                className="flex items-center justify-between px-6 py-4 text-white border-b border-slate-900/10 rounded-t-2xl"
              >
                <div>
                  <div className="text-lg font-semibold text-white">Booking holds</div>
                  <div className="text-sm text-white/70">
                    Showing {holdsVisible.length} {holdsView === "expired" ? "expired" : "active"} holds
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="inline-flex rounded-full bg-white/10 p-1 ring-1 ring-white/20">
                    <a
                      href={holdsActiveHref}
                      className={[
                        "px-3 py-1.5 text-xs font-semibold rounded-full transition",
                        holdsView === "active"
                          ? "bg-white text-slate-900"
                          : "text-white/80 hover:text-white",
                      ].join(" ")}
                    >
                      Active
                    </a>
                    <a
                      href={holdsExpiredHref}
                      className={[
                        "px-3 py-1.5 text-xs font-semibold rounded-full transition",
                        holdsView === "expired"
                          ? "bg-white text-slate-900"
                          : "text-white/80 hover:text-white",
                      ].join(" ")}
                    >
                      Expired
                    </a>
                  </div>

                  <span className={pillBase("bg-white/10 text-white ring-white/20")}>
                    {holdsVisible.length}
                  </span>
                </div>
              </div>

              <div className="space-y-3 p-4 sm:p-6">
                {holdsVisible.map((h: any) => {
                  const expired = holdsView === "expired" ? true : isHoldExpired(h.expires_at);
                  const zipVal = (h.zip ?? "").toString().trim();
                  const isToday = holdsView !== "expired" && (h.delivery_date ?? "") === todayET;

                  return (
                    <div
                      key={h.id}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
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
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-[#F97316]/10"
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
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10">
                    <div className="flex items-center gap-4">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200">
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