export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminToastTrigger } from "@/app/admin/_components/admin/admin-toast-trigger";
import { ContextHelpCard } from "@/app/admin/_components/admin/context-help-card";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { getCustomerFacingBookingLabel } from "@/lib/identity";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { setCustomerPortalStatusAction, updateCustomerIdentityAction } from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string }>;
};

type BookingRow = {
  id: string;
  booking_ref: string | null;
  customer_id: string | null;
  booking_contact_name: string | null;
  booking_contact_email: string | null;
  booking_contact_phone: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string | null;
  pickup_date: string | null;
  status: string | null;
  total_price_cents: number | null;
  created_at: string | null;
};

type HistoryRow = {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_type: string | null;
  change_reason: string | null;
  created_at: string;
};

type SavedLocationRow = {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string | null;
  zip: string;
  delivery_notes: string | null;
  is_default: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function formatUsd(cents: number | null) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function getSavedMessage(saved: string | undefined) {
  switch (saved) {
    case "identity":
      return "Customer details saved.";
    case "portal":
      return "Portal access updated.";
    default:
      return null;
  }
}

export default async function CustomerDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { saved } = (await searchParams) ?? {};
  const savedMessage = getSavedMessage(saved);

  const [{ data: customer, error: customerError }, { data: bookingsData, error: bookingsError }, { data: historyData, error: historyError }, { data: savedLocationsData, error: savedLocationsError }] =
    await Promise.all([
      supabaseAdmin
        .from("customers")
        .select("id, created_at, name, email, phone, primary_street, primary_city, primary_state, primary_zip, portal_status, deactivated_at, deactivation_reason")
        .eq("id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("bookings")
        .select("id, booking_ref, customer_id, booking_contact_name, booking_contact_email, booking_contact_phone, customer_street, customer_city, customer_zip, delivery_date, pickup_date, status, total_price_cents, created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("entity_history")
        .select("id, field_name, old_value, new_value, changed_by_type, change_reason, created_at")
        .eq("entity_type", "customer")
        .eq("entity_id", id)
        .order("created_at", { ascending: false })
        .limit(25),
      supabaseAdmin
        .from("customer_locations")
        .select("id, label, street, city, state, zip, delivery_notes, is_default")
        .eq("customer_id", id)
        .order("is_default", { ascending: false })
        .order("updated_at", { ascending: false }),
    ]);

  if (customerError) throw new Error(customerError.message);
  if (bookingsError) throw new Error(bookingsError.message);
  if (historyError) throw new Error(historyError.message);
  if (savedLocationsError) throw new Error(savedLocationsError.message);
  if (!customer) notFound();

  const bookings = (bookingsData ?? []) as BookingRow[];
  const history = (historyData ?? []) as HistoryRow[];
  const savedLocations = (savedLocationsData ?? []) as SavedLocationRow[];
  const activeBookings = bookings.filter((booking) =>
    ["confirmed", "scheduled", "delivered"].includes((booking.status ?? "").toLowerCase()),
  );
  const lifetimeValue = bookings.reduce((sum, booking) => sum + (booking.total_price_cents ?? 0), 0);

  return (
    <AdminPage className="py-8">
      <AdminToastTrigger success={savedMessage} trigger={saved} clearParam="saved" />

      <AdminPageHeader
        title={customer.name || customer.email || "Customer account"}
        eyebrow="Customers"
        description={
          <span className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span>{customer.email || "No email"}</span>
            <span>{customer.phone || "No phone"}</span>
            <span>
              UUID: <span className="font-mono">{customer.id}</span>
            </span>
          </span>
        }
        className="mb-6"
        actions={
          <Link
            href="/admin/customers"
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Back to customers
          </Link>
        }
      />

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Portal status", value: customer.portal_status ?? "invited" },
            { label: "Linked bookings", value: bookings.length },
            { label: "Active bookings", value: activeBookings.length },
            { label: "Lifetime value", value: formatUsd(lifetimeValue) },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Customer account owner</h2>
              <p className="mt-1 text-sm text-slate-500">
                Portal identity is tied to this email address, while bookings retain their own historical snapshots.
              </p>
            </div>
            <div className="mb-6">
              <ContextHelpCard
                eyebrow="How to read this record"
                title="This is one customer record, even if past bookings look a little different."
                body="One customer can have many bookings. Different bookings can have different service addresses, and older bookings may keep older contact details from the time they were created. Updating the customer email does not create a new customer."
                learnMoreHref="/admin/docs/customer-booking-identity"
              />
            </div>
            <form action={updateCustomerIdentityAction} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="id" value={customer.id} />
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
                <input
                  name="name"
                  defaultValue={customer.name ?? ""}
                  className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900 outline-none focus:border-[#F97316]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
                <input
                  name="email"
                  defaultValue={customer.email ?? ""}
                  className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900 outline-none focus:border-[#F97316]"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Phone</span>
                <input
                  name="phone"
                  defaultValue={customer.phone ?? ""}
                  className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900 outline-none focus:border-[#F97316]"
                />
              </label>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Save customer details
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Linked bookings</h2>
              <p className="mt-1 text-sm text-slate-500">
                Customer/account owner, booking contact, and service location can differ across bookings.
              </p>
            </div>

            <div className="mb-6">
              <ContextHelpCard
                eyebrow="Booking relationship"
                title="Linked bookings can represent different jobs, contacts, and addresses."
                body="Use this list to confirm which rental the customer is asking about. The account stays the same, but each booking keeps its own job details and historical contact snapshot."
                learnMoreHref="/admin/docs/customer-booking-identity"
                tone="slate"
                compact
              />
            </div>

            <div className="space-y-3">
              {bookings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
                  No bookings are linked to this customer yet.
                </div>
              ) : (
                bookings.map((booking) => (
                  <div key={booking.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Link href={`/admin/bookings/${booking.id}`} className="text-sm font-semibold text-slate-900 hover:underline">
                          {getCustomerFacingBookingLabel(booking.booking_ref)}
                        </Link>
                        <div className="mt-1 text-sm text-slate-600">
                          Booking contact: {booking.booking_contact_name || "—"} • {booking.booking_contact_email || "—"}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {[booking.customer_street, booking.customer_city, booking.customer_zip].filter(Boolean).join(", ") || "Address unavailable"}
                        </div>
                      </div>
                      <div className="text-sm text-slate-500">
                        Delivery {formatDate(booking.delivery_date)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Saved service locations</h2>
            <p className="mt-1 text-sm text-slate-500">
              Reusable customer locations. These are separate from booking address snapshots.
            </p>

            <div className="mt-4 space-y-3">
              {savedLocations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
                  No saved service locations on this customer yet.
                </div>
              ) : (
                savedLocations.map((location) => (
                  <div key={location.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">{location.label}</div>
                      {location.is_default ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                          Default
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {[location.street, [location.city, location.state].filter(Boolean).join(", "), location.zip]
                        .filter(Boolean)
                        .join(" ")}
                    </div>
                    {location.delivery_notes ? (
                      <div className="mt-2 text-sm leading-6 text-slate-500">{location.delivery_notes}</div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Portal access</h2>
            <p className="mt-1 text-sm text-slate-500">
              Deactivating portal access is soft-only. It does not delete customers or bookings.
            </p>
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{customer.portal_status ?? "invited"}</div>
              {customer.deactivated_at ? (
                <div className="mt-2 text-sm text-slate-500">
                  Deactivated {formatDate(customer.deactivated_at)}{customer.deactivation_reason ? ` • ${customer.deactivation_reason}` : ""}
                </div>
              ) : null}
            </div>

            <div className="mt-4">
              <ContextHelpCard
                eyebrow="Access behavior"
                title="Turning off portal access only affects sign-in and self-service access."
                body="Customer records, linked bookings, and operational history remain intact after deactivation."
                learnMoreHref="/admin/docs/customer-booking-identity"
                tone="slate"
                compact
              />
            </div>

            <form action={setCustomerPortalStatusAction} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={customer.id} />
              <input
                type="hidden"
                name="portal_status"
                value={customer.portal_status === "deactivated" ? "active" : "deactivated"}
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {customer.portal_status === "deactivated" ? "Reactivate portal access" : "Deactivate portal access"}
              </button>
            </form>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">History</h2>
            <p className="mt-1 text-sm text-slate-500">Important identity and portal-status changes.</p>

            <div className="mt-4 space-y-3">
              {history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
                  No customer history recorded yet.
                </div>
              ) : (
                history.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                    <div className="text-sm font-semibold text-slate-900">{entry.field_name.replaceAll("_", " ")}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      {entry.old_value ? `${entry.old_value} → ` : ""}
                      {entry.new_value || "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDate(entry.created_at)} • {entry.changed_by_type || "system"}
                      {entry.change_reason ? ` • ${entry.change_reason}` : ""}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </AdminPage>
  );
}
