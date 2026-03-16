// src/app/admin/page.tsx
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { DeliveriesTodayCard } from "./_components/DeliveriesTodayCard";
import { PickupsInboxCard } from "./_components/PickupsInboxCard";
import { FleetCapacityCard } from "./_components/FleetCapacityCard";
import { AttentionIssuesCard } from "./_components/AttentionIssuesCard";
import { UpcomingDeliveriesCard } from "./_components/UpcomingDeliveriesCard";
import { RevenueMTDCard } from "./_components/RevenueMTDCard";
import { TopZipCodesCard } from "./_components/TopZipCodesCard";
import { revalidatePath } from "next/cache";
import { SummaryStatCard } from "./_components/SummaryStatCard";

export const dynamic = "force-dynamic";

function todayISOET() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}


export default async function AdminDashboardPage() {
    const supabase = supabaseServer();

    async function markDelivered(formData: FormData) {
        "use server";
        const id = String(formData.get("id") ?? "");
        if (!id) return;

        const supabase = supabaseServer();
        await supabase.from("bookings").update({ status: "delivered" }).eq("id", id);

        revalidatePath("/admin");
        revalidatePath("/admin/bookings");
    }

    async function markPickedUp(formData: FormData) {
        "use server";
        const id = String(formData.get("id") ?? "");
        if (!id) return;

        const supabase = supabaseServer();
        await supabase.from("bookings").update({ status: "picked_up" }).eq("id", id);

        revalidatePath("/admin");
        revalidatePath("/admin/bookings");
    }

    const todayStr = todayISOET();
    const next7 = new Date();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    }).format(monthStart);

    next7.setDate(next7.getDate() + 7);
    const next7Str = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(next7);

    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);
    const since30Str = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(since30);

    const FLEET_SIZE = 3;

    const { data: deliveriesToday, error } = await supabase
        .from("bookings")
        .select("id, customer_name, customer_city, customer_zip, delivery_date, status")
        .eq("delivery_date", todayStr)
        .in("status", ["confirmed", "scheduled"])
        .order("delivery_date", { ascending: true });

    const { count: onSiteNowCount } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "delivered");

    const { data: pickupsInbox } = await supabase
        .from("bookings")
        .select(
            "id, customer_name, customer_city, customer_zip, delivery_date, pickup_mode, pickup_date"
        )
        .eq("status", "delivered")
        .or(`pickup_mode.eq.request,pickup_date.eq.${todayStr}`)
        .order("delivery_date", { ascending: true });

    // Overdue deliveries: delivery_date < today AND status in confirmed/scheduled
    const { data: overdueDeliveries } = await supabase
        .from("bookings")
        .select("id, customer_name, customer_city, customer_zip, delivery_date, status")
        .lt("delivery_date", todayStr)
        .in("status", ["confirmed", "scheduled"])
        .order("delivery_date", { ascending: true });

    // Pickup requests waiting: delivered + request
    const { count: pickupRequestsWaitingCount } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "delivered")
        .eq("pickup_mode", "request");

    const { data: upcomingDeliveries } = await supabase
        .from("bookings")
        .select("id, customer_name, customer_city, customer_zip, delivery_date, status")
        .gte("delivery_date", todayStr)
        .lte("delivery_date", next7Str)
        .in("status", ["confirmed", "scheduled"])
        .order("delivery_date", { ascending: true });

    const { data: revenueRows } = await supabase
        .from("bookings")
        .select("price")
        .gte("delivery_date", monthStartStr)
        .lte("delivery_date", todayStr)
        .in("status", ["delivered", "picked_up"]);

    const revenueMTD =
        (revenueRows ?? []).reduce((sum, r) => sum + Number(r.price ?? 0), 0);

    // Holds expiring soon: active holds expiring in next 30 minutes
    const nowIso = new Date().toISOString();
    const soonIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { data: zipRows } = await supabase
        .from("bookings")
        .select("customer_zip")
        .gte("delivery_date", since30Str)
        .lte("delivery_date", todayStr)
        .neq("status", "cancelled");

    const zipCounts = new Map<string, number>();

    for (const r of zipRows ?? []) {
        const zip = (r.customer_zip ?? "").trim();
        if (!zip) continue;
        zipCounts.set(zip, (zipCounts.get(zip) ?? 0) + 1);
    }

    const topZipCodes = Array.from(zipCounts.entries())
        .map(([zip, count]) => ({ zip, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    const { data: holdsExpiringSoon } = await supabase
        .from("booking_holds")
        .select("id, delivery_date, expires_at")
        .eq("status", "active")
        .gt("expires_at", nowIso)
        .lt("expires_at", soonIso)
        .order("expires_at", { ascending: true });

    if (error) {
        console.error("Dashboard deliveries query failed:", error);
    }

    return (
        <div className="mx-auto max-w-6xl px-6 pb-16 pt-10">
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
                <p className="mt-1 text-sm text-slate-600">Dispatch view for {todayStr}</p>
                </div>

                <div className="flex gap-2">
                <Link
                    href="/admin/bookings"
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                    Operations
                </Link>
                </div>
            </div>


            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryStatCard
                    label="Deliveries Today"
                    value={(deliveriesToday ?? []).length}
                    href={`/admin/bookings?view=deliveries-today&date=${todayStr}`}
                />

                <SummaryStatCard
                    label="Pickups Waiting"
                    value={(pickupsInbox ?? []).length}
                    tone="warning"
                    href="/admin/bookings?view=pickups-waiting"
                />

                <SummaryStatCard
                    label="On-Site Now"
                    value={onSiteNowCount ?? 0}
                    href="/admin/bookings?view=on-site"
                />

                <SummaryStatCard
                    label="Revenue MTD"
                    value={revenueMTD.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                    })}
                    tone="success"
                    href={`/admin/bookings?view=revenue-mtd&from=${monthStartStr}&to=${todayStr}`}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <DeliveriesTodayCard
                    items={deliveriesToday ?? []}
                    onMarkDelivered={markDelivered}
                />

                <PickupsInboxCard
                    items={pickupsInbox ?? []}
                    onMarkPickedUp={markPickedUp}
                />

                <FleetCapacityCard
                    fleetSize={FLEET_SIZE}
                    deliveriesToday={(deliveriesToday ?? []).length}
                    onSiteNow={onSiteNowCount ?? 0}
                />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <AttentionIssuesCard
                    overdueDeliveries={overdueDeliveries ?? []}
                    pickupRequestsWaitingCount={pickupRequestsWaitingCount ?? 0}
                    holdsExpiringSoon={holdsExpiringSoon ?? []}
                />

                <UpcomingDeliveriesCard items={upcomingDeliveries ?? []} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <RevenueMTDCard amount={revenueMTD} />
                <TopZipCodesCard items={topZipCodes} />
            </div>
        </div>
        
    );
}