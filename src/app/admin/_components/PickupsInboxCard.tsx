import Link from "next/link";
import { Card } from "./Card";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import { formatCustomerName } from "@/lib/customer-name";

type PickupItem = {
  id: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string;
  pickup_mode: "request" | "schedule" | null;
  pickup_date: string | null;
};

function getDaysOnSite(deliveryDate: string) {
  const delivered = new Date(`${deliveryDate}T00:00:00`);
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const diffMs = todayStart.getTime() - delivered.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(diffDays, 0);
}

export function PickupsInboxCard(props: {
  items: PickupItem[];
  onMarkPickedUp: (formData: FormData) => Promise<void>;
}) {
  return (
    <Card
      title="Pickups Inbox"
      subtitle={`${props.items.length} dumpsters awaiting pickup`}
      actionHref="/admin/bookings"
      actionLabel="View all"
    >
      <div className="mt-2 rounded-2xl bg-slate-50 ring-1 ring-slate-200">
        {props.items.length === 0 ? (
          <div className="px-5 py-5 text-sm text-slate-600">
            No pickups waiting.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {props.items.map((item) => {
              const daysOnSite = getDaysOnSite(item.delivery_date);

              return (
                <li key={item.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {formatCustomerName(item.customer_first_name, item.customer_last_name, "Unnamed customer")}
                      </div>

                      <div className="mt-0.5 text-xs text-slate-600">
                        {item.customer_city ?? "—"} • {item.customer_zip ?? "—"}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="text-xs text-slate-500">
                          Delivered {item.delivery_date}
                        </div>

                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                          {daysOnSite} day{daysOnSite === 1 ? "" : "s"} on site
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.pickup_mode === "request" && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                          Request
                        </span>
                      )}

                      {item.pickup_mode === "schedule" && item.pickup_date && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {item.pickup_date}
                        </span>
                      )}

                      <Link
                        href={`/admin/bookings?bookingId=${encodeURIComponent(item.id)}`}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                      >
                        View
                      </Link>

                      <form action={props.onMarkPickedUp}>
                        <input type="hidden" name="id" value={item.id} />
                        <FormSubmitButton
                          loadingLabel="Marking..."
                          className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          Mark picked up
                        </FormSubmitButton>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
