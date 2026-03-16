import Link from "next/link";
import { Card } from "./Card";

type OverdueDelivery = {
  id: string;
  customer_name: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string;
  status: string;
};

type ExpiringHold = {
  id: string;
  delivery_date: string;
  expires_at: string;
};

function SectionHeader(props: {
  title: string;
  count: number;
  tone?: "danger" | "warning" | "neutral";
}) {
  const tone =
    props.tone === "danger"
      ? "bg-rose-100 text-rose-700"
      : props.tone === "warning"
      ? "bg-amber-100 text-amber-800"
      : "bg-slate-100 text-slate-700";

  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="text-sm font-medium text-slate-900">{props.title}</div>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
        {props.count}
      </span>
    </div>
  );
}

export function AttentionIssuesCard(props: {
  overdueDeliveries: OverdueDelivery[];
  pickupRequestsWaitingCount: number;
  holdsExpiringSoon: ExpiringHold[];
}) {
  return (
    <Card title="Attention / Issues" subtitle="Items that need action">
      <div className="mt-2 space-y-4">
        {/* Overdue deliveries */}
        <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
          <SectionHeader
            title="Overdue deliveries"
            count={props.overdueDeliveries.length}
            tone="danger"
          />

          {props.overdueDeliveries.length > 0 ? (
            <>
              <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {props.overdueDeliveries.slice(0, 3).map((b) => (
                  <li key={b.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">
                          {b.customer_name ?? "Unnamed customer"}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-600">
                          {b.customer_city ?? "—"} • {b.customer_zip ?? "—"} • Due {b.delivery_date}
                        </div>
                      </div>

                      <Link
                        href={`/admin/bookings?bookingId=${encodeURIComponent(b.id)}`}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-3">
                <Link
                  href="/admin/bookings"
                  className="text-xs font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
                >
                  View overdue in bookings
                </Link>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-600">No overdue deliveries.</div>
          )}
        </div>

        {/* Pickup requests waiting */}
        <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
          <SectionHeader
            title="Pickup requests waiting"
            count={props.pickupRequestsWaitingCount}
            tone="warning"
          />

          <div className="text-xs text-slate-600">Delivered + pickup_mode=request</div>

          {props.pickupRequestsWaitingCount > 0 ? (
            <div className="mt-3">
              <Link
                href="/admin/bookings"
                className="text-xs font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
              >
                View pickup requests
              </Link>
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-600">None waiting.</div>
          )}
        </div>

        {/* Holds expiring soon */}
        <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
          <SectionHeader
            title="Holds expiring soon"
            count={props.holdsExpiringSoon.length}
            tone="neutral"
          />

          {props.holdsExpiringSoon.length > 0 ? (
            <>
              <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {props.holdsExpiringSoon.slice(0, 3).map((h) => (
                  <li key={h.id} className="px-4 py-3">
                    <div className="text-xs text-slate-700">
                      Hold for <span className="font-medium">{h.delivery_date}</span> expires{" "}
                      <span className="font-medium">
                        {new Date(h.expires_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-3">
                <Link
                  href="/admin/bookings"
                  className="text-xs font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
                >
                  View bookings / holds
                </Link>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-600">No holds expiring soon.</div>
          )}
        </div>
      </div>
    </Card>
  );
}