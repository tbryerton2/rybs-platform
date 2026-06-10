// src/app/admin/system/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatCustomerName } from "@/lib/customer-name";

type BookingStatus =
  | "confirmed"
  | "scheduled"
  | "delivered"
  | "picked_up"
  | "cancelled";

type BookingRow = {
  id: string;
  created_at: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_zip: string | null;
  delivery_date: string | null;
  status: BookingStatus | null;
};

type HoldRow = {
  id: string;
  created_at: string | null;
  delivery_date: string | null;
  expires_at: string | null;
  status: string | null;
};

type ActivityItem =
  | {
      type: "booking";
      id: string;
      created_at: string | null;
      title: string;
      subtitle: string;
      status: string;
      href: string;
    }
  | {
      type: "hold";
      id: string;
      created_at: string | null;
      title: string;
      subtitle: string;
      status: string;
      href: string;
    };

function todayISOET() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function startOfDayET(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")?.value ?? "0");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "1");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "1");

  // This is a pragmatic V1 boundary.
  // It works well enough for app-level "today" metrics on this page.
  return new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00-04:00`);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
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

function formatDate(value: string | null) {
  if (!value) return "—";

  // Handles YYYY-MM-DD safely for display
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function statusPillClasses(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "delivered" || normalized === "picked_up") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (normalized === "confirmed" || normalized === "scheduled" || normalized === "active") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (normalized === "cancelled" || normalized === "expired") {
    return "bg-slate-100 text-slate-600 ring-slate-200";
  }

  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function metricTone(value: number) {
  if (value === 0) return "text-slate-900";
  return "text-slate-900";
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function StatusCard({
  label,
  value,
  tone = "good",
}: {
  label: string;
  value: string;
  tone?: "good" | "neutral" | "warning";
}) {
  const toneClasses =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-3 flex items-center gap-3">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ${toneClasses}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className={`mt-3 text-3xl font-semibold ${metricTone(value)}`}>{value}</div>
      {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
              item.type === "booking"
                ? "bg-orange-50 text-[#F97316] ring-orange-200"
                : "bg-sky-50 text-sky-700 ring-sky-200"
            }`}
          >
            {item.type === "booking" ? "Booking" : "Hold"}
          </span>

          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusPillClasses(item.status)}`}>
            {item.status}
          </span>
        </div>

        <div className="mt-2 text-sm font-semibold text-slate-900">{item.title}</div>
        <div className="mt-1 text-sm text-slate-500">{item.subtitle}</div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
        <div className="text-xs text-slate-500">{formatDateTime(item.created_at)}</div>
        <Link
          href={item.href}
          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        >
          Open
        </Link>
      </div>
    </div>
  );
}

function AlertRow({
  label,
  count,
  description,
  href,
}: {
  label: string;
  count: number;
  description: string;
  href: string;
}) {
  const tone =
    count === 0
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : "bg-amber-50 text-amber-700 ring-amber-200";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone}`}>
            {count}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <Link
        href={href}
        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      >
        Review
      </Link>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
    >
      <div className="text-base font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      <div className="mt-4 text-sm font-medium text-[#F97316] group-hover:text-orange-600">Open →</div>
    </Link>
  );
}

export default async function AdminSystemPage() {
  const todayISO = todayISOET();
  const startToday = startOfDayET();
  const startTomorrow = addDays(startToday, 1);
  const nowIso = new Date().toISOString();

  const [
    lastBookingResult,
    lastHoldResult,
    bookingsTodayResult,
    activeHoldsResult,
    overdueDeliveriesResult,
    pendingPickupsResult,
    recentBookingsResult,
    recentHoldsResult,
    expiredActiveHoldsResult,
    incompleteBookingsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .limit(1),

    supabaseAdmin
      .from("booking_holds")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .limit(1),

    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startToday.toISOString())
      .lt("created_at", startTomorrow.toISOString()),

    supabaseAdmin
      .from("booking_holds")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),

    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .lt("delivery_date", todayISO)
      .not("status", "in", '("delivered","picked_up","cancelled")'),

    // V1 definition: delivered = currently on-site / awaiting pickup
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "delivered"),

    supabaseAdmin
      .from("bookings")
      .select("id, created_at, customer_first_name, customer_last_name, customer_zip, delivery_date, status")
      .order("created_at", { ascending: false })
      .limit(10),

    supabaseAdmin
      .from("booking_holds")
      .select("id, created_at, delivery_date, expires_at, status")
      .order("created_at", { ascending: false })
      .limit(10),

    supabaseAdmin
      .from("booking_holds")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .lt("expires_at", nowIso),

    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .neq("status", "cancelled")
      .or("and(customer_first_name.is.null,customer_last_name.is.null),customer_zip.is.null,delivery_date.is.null"),
  ]);

  const queryErrors = [
    lastBookingResult.error,
    lastHoldResult.error,
    bookingsTodayResult.error,
    activeHoldsResult.error,
    overdueDeliveriesResult.error,
    pendingPickupsResult.error,
    recentBookingsResult.error,
    recentHoldsResult.error,
    expiredActiveHoldsResult.error,
    incompleteBookingsResult.error,
  ].filter(Boolean);

  const systemOperational = queryErrors.length === 0;

  const lastBooking = (lastBookingResult.data?.[0] ?? null) as { id: string; created_at: string | null } | null;
  const lastHold = (lastHoldResult.data?.[0] ?? null) as { id: string; created_at: string | null } | null;

  const bookingsToday = bookingsTodayResult.count ?? 0;
  const activeHolds = activeHoldsResult.count ?? 0;
  const overdueDeliveries = overdueDeliveriesResult.count ?? 0;
  const pendingPickups = pendingPickupsResult.count ?? 0;

  const expiredActiveHolds = expiredActiveHoldsResult.count ?? 0;
  const incompleteBookings = incompleteBookingsResult.count ?? 0;

  const bookingItems: ActivityItem[] = ((recentBookingsResult.data ?? []) as BookingRow[]).map((row) => ({
    type: "booking",
    id: row.id,
    created_at: row.created_at,
    title: formatCustomerName(row.customer_first_name, row.customer_last_name, "Unnamed booking"),
    subtitle: [
      row.customer_zip ? `ZIP ${row.customer_zip}` : "ZIP missing",
      row.delivery_date ? `Delivery ${formatDate(row.delivery_date)}` : "Delivery date missing",
    ].join(" • "),
    status: row.status ?? "unknown",
    href: `/admin/bookings/${row.id}`,
  }));

  const holdItems: ActivityItem[] = ((recentHoldsResult.data ?? []) as HoldRow[]).map((row) => ({
    type: "hold",
    id: row.id,
    created_at: row.created_at,
    title: row.delivery_date ? `Hold for ${formatDate(row.delivery_date)}` : "Hold created",
    subtitle: row.expires_at ? `Expires ${formatDateTime(row.expires_at)}` : "Expiration not set",
    status: row.status ?? "unknown",
    href: "/admin/bookings",
  }));

  const recentActivity = [...bookingItems, ...holdItems]
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 15);

  return (
    <AdminPage>
      <AdminPageHeader
        title="Admin Tools"
        description="Monitor system activity and operational health."
      />

      <div className="space-y-6">
        <SectionCard
          title="System status"
          description="A quick health check so you can confirm the system is active and receiving traffic."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <StatusCard
              label="Current status"
              value={systemOperational ? "System operational" : "Needs review"}
              tone={systemOperational ? "good" : "warning"}
            />

            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="text-sm font-medium text-slate-500">Last booking created</div>
              <div className="mt-3 text-base font-semibold text-slate-900">
                {lastBooking ? formatDateTime(lastBooking.created_at) : "No bookings yet"}
              </div>
              <div className="mt-3">
                <Link
                  href={lastBooking ? `/admin/bookings/${lastBooking.id}` : "/admin/bookings"}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                >
                  Open booking
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="text-sm font-medium text-slate-500">Last hold created</div>
              <div className="mt-3 text-base font-semibold text-slate-900">
                {lastHold ? formatDateTime(lastHold.created_at) : "No holds yet"}
              </div>
              <div className="mt-3">
                <Link
                  href="/admin/bookings"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                >
                  View bookings
                </Link>
              </div>
            </div>
          </div>

          {!systemOperational ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              One or more data queries failed while loading this page. The app may still be running, but this page could not confirm all system signals.
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Today’s snapshot"
          description="Simple operating signals pulled from live booking and hold data."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Bookings today"
              value={bookingsToday}
              hint="New bookings created today."
            />
            <MetricCard
              label="Active holds"
              value={activeHolds}
              hint="Open reservation holds still in the system."
            />
            <MetricCard
              label="Overdue deliveries"
              value={overdueDeliveries}
              hint="Delivery date has passed, but booking is not delivered or closed."
            />
            <MetricCard
              label="Pending pickups"
              value={pendingPickups}
              hint="V1 counts jobs currently marked delivered and still on-site."
            />
          </div>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <SectionCard
            title="Recent activity"
            description="Latest bookings and holds, newest first."
          >
            <div className="space-y-3">
              {recentActivity.length > 0 ? (
                recentActivity.map((item) => <ActivityRow key={`${item.type}-${item.id}`} item={item} />)
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                  No recent activity found.
                </div>
              )}
            </div>
          </SectionCard>

          <div className="space-y-6">
            <SectionCard
              title="Alerts / issues"
              description="A few simple warnings to help you catch problems early."
            >
              <div className="space-y-3">
                <AlertRow
                  label="Overdue deliveries"
                  count={overdueDeliveries}
                  description="Bookings with a delivery date in the past that are still not delivered or closed."
                  href="/admin/bookings"
                />
                <AlertRow
                  label="Expired holds still active"
                  count={expiredActiveHolds}
                  description="Reservation holds whose expiration time has passed but are still marked active."
                  href="/admin/bookings"
                />
                <AlertRow
                  label="Incomplete bookings"
                  count={incompleteBookings}
                  description="Active bookings missing customer name, ZIP, or delivery date."
                  href="/admin/bookings"
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Quick actions"
              description="Jump straight to the areas most likely to need attention."
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <QuickActionCard
                  title="View bookings"
                  description="Review booking records, status, and issues."
                  href="/admin/bookings"
                />
                <QuickActionCard
                  title="Open schedule"
                  description="Check delivery and pickup flow for today."
                  href="/admin/schedule"
                />
                <QuickActionCard
                  title="View customers"
                  description="Open the customer list and booking history."
                  href="/admin/customers"
                />
                <QuickActionCard
                  title="Manage pricing"
                  description="Review pricing rules and business settings."
                  href="/admin/settings/pricing"
                />
                <QuickActionCard
                  title="Manage ZIPs"
                  description="Adjust service area and ZIP configuration."
                  href="/admin/settings/zips"
                />
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </AdminPage>
  );
}
