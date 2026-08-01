// src/app/admin/_components/DeliveriesTodayCard.tsx
import Link from "next/link";
import { Card } from "./Card";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import { formatCustomerName } from "@/lib/customer-name";

type DeliveryItem = {
  id: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string;
  status: string;
};

export function DeliveriesTodayCard(props: {
  items: DeliveryItem[];
  onMarkDelivered: (formData: FormData) => Promise<void>;
}) {
  return (
    <Card
      title="Deliveries Today"
      subtitle={`${props.items.length} pending delivery`}
      actionHref="/admin/bookings"
      actionLabel="View all"
    >
      <div className="mt-2 rounded-[14px] bg-slate-50 ring-1 ring-slate-200">
        {props.items.length === 0 ? (
          <div className="px-5 py-5 text-sm text-slate-600">
            No deliveries scheduled for today.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {props.items.map((item) => (
              <li key={item.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {formatCustomerName(item.customer_first_name, item.customer_last_name, "Unnamed customer")}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {item.customer_city ?? "—"} • {item.customer_zip ?? "—"}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/admin/bookings?bookingId=${encodeURIComponent(item.id)}`}
                      className="admin-btn admin-btn-secondary admin-btn-sm"
                    >
                      View
                    </Link>

                    <form action={props.onMarkDelivered}>
                      <input type="hidden" name="id" value={item.id} />
                      <FormSubmitButton
                        loadingLabel="Marking..."
                        className="admin-btn admin-btn-primary admin-btn-sm"
                      >
                        Mark delivered
                      </FormSubmitButton>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
