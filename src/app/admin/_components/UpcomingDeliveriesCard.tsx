import Link from "next/link";
import { Card } from "./Card";
import { formatCustomerName } from "@/lib/customer-name";

type UpcomingItem = {
  id: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string;
  status: string;
};

export function UpcomingDeliveriesCard(props: { items: UpcomingItem[] }) {
  return (
    <Card
      title="Upcoming Deliveries"
      subtitle="Next 7 days"
      actionHref="/admin/bookings"
      actionLabel="View all"
    >
      <div className="mt-2 rounded-[14px] bg-slate-50 ring-1 ring-slate-200">
        {props.items.length === 0 ? (
          <div className="px-5 py-5 text-sm text-slate-600">
            No upcoming deliveries in the next 7 days.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-[14px]">
            {props.items.slice(0, 10).map((b) => (
              <li key={b.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {formatCustomerName(b.customer_first_name, b.customer_last_name, "Unnamed customer")}
                    </div>

                    <div className="mt-0.5 text-xs text-slate-600">
                      {b.customer_city ?? "—"} • {b.customer_zip ?? "—"}
                    </div>

                    <div className="mt-2 inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                      Delivery {b.delivery_date}
                    </div>
                  </div>

                  <Link
                    href={`/admin/bookings?bookingId=${encodeURIComponent(b.id)}`}
                    className="shrink-0 admin-btn admin-btn-secondary admin-btn-sm"
                  >
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
