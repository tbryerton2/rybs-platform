export const dynamic = "force-dynamic";
export const revalidate = 0;

import {
  BanknotesIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  HashtagIcon,
  SignalIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminSummaryCard } from "@/app/admin/_components/AdminSummaryCard";
import { AdminAuditHistoryCard } from "@/app/admin/_components/admin/admin-audit-history-card";
import { AdminToastTrigger } from "@/app/admin/_components/admin/admin-toast-trigger";
import { BookingListRow } from "@/app/admin/_components/admin/booking-list-row";
import { AdminPage } from "@/app/admin/_components/admin/admin-page";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminOwner } from "@/lib/admin/auth";
import { EditCustomerDetailsModal } from "./edit-customer-details-modal";
import { InteractiveInfoPopover } from "./interactive-info-popover";
import { setCustomerPortalStatusAction } from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string }>;
};

type BookingRow = {
  id: string;
  booking_ref: string | null;
  customer_id: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
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

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function formatStatusLabel(value: string | null) {
  if (!value) return "Unknown";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizePhoneDigits(value: string | null) {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return null;
}

function formatPhoneNumber(value: string | null) {
  const digits = normalizePhoneDigits(value);
  if (!digits) return value || "No phone";
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function getTelHref(value: string | null) {
  const digits = normalizePhoneDigits(value);
  return digits ? `tel:+1${digits}` : null;
}

function getSmsHref(value: string | null) {
  const digits = normalizePhoneDigits(value);
  return digits ? `sms:+1${digits}` : null;
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
  const adminSession = await requireAdminOwner();
  const { id } = await params;
  const { saved } = (await searchParams) ?? {};
  const savedMessage = getSavedMessage(saved);

  const [{ data: customer, error: customerError }, { data: bookingsData, error: bookingsError }, { data: historyData, error: historyError }, { data: savedLocationsData, error: savedLocationsError }] =
    await Promise.all([
      supabaseAdmin
        .from("customers")
        .select("id, created_at, name, email, phone, primary_street, primary_city, primary_state, primary_zip, portal_status, deactivated_at, deactivation_reason")
        .eq("id", id)
        .eq("business_id", adminSession.business.id)
        .maybeSingle(),
      supabaseAdmin
        .from("bookings")
        .select("id, booking_ref, customer_id, customer_first_name, customer_last_name, customer_email, customer_phone, customer_street, customer_city, customer_zip, delivery_date, pickup_date, status, total_price_cents, created_at")
        .eq("business_id", adminSession.business.id)
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
        .eq("business_id", adminSession.business.id)
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
  const visibleLinkedBookings = bookings.slice(0, 10);
  const lifetimeValue = bookings.reduce((sum, booking) => sum + (booking.total_price_cents ?? 0), 0);
  const mostRecentBooking = bookings[0] ?? null;
  const mostRecentBookingValue = mostRecentBooking
    ? formatDate(mostRecentBooking.created_at)
    : "No bookings yet";
  const customerEmail = customer.email?.trim() || null;
  const formattedPhone = formatPhoneNumber(customer.phone);
  const telHref = getTelHref(customer.phone);
  const smsHref = getSmsHref(customer.phone);

  const contactActions = [
    { label: "Email Customer", href: customerEmail ? `mailto:${customerEmail}` : null },
    { label: "Text Customer", href: smsHref },
    { label: "Call Customer", href: telHref },
  ];
  const bookingsSearchTerm = customerEmail || customer.phone || customer.name || customer.id;
  const viewAllBookingsHref = `/admin/bookings?q=${encodeURIComponent(bookingsSearchTerm)}`;
  const linkedBookingsCountLabel =
    bookings.length > visibleLinkedBookings.length
      ? `${visibleLinkedBookings.length} of ${bookings.length}`
      : `${bookings.length} booking${bookings.length === 1 ? "" : "s"}`;
  const savedLocationsCountLabel = `${savedLocations.length} location${savedLocations.length === 1 ? "" : "s"}`;

  return (
    <AdminPage className="space-y-6 py-8">
      <AdminToastTrigger success={savedMessage} trigger={saved} clearParam="saved" />

      <div>
        <Link href="/admin/customers" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to customers
        </Link>
      </div>

      <section className="space-y-3">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Customer Details</div>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {customer.name || customer.email || "Customer account"}
            </h1>
            <EditCustomerDetailsModal
              customerId={customer.id}
              customerName={customer.name}
              customerEmail={customer.email}
              customerPhone={customer.phone}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            {contactActions.map((action) =>
              action.href ? (
                <a
                  key={action.label}
                  href={action.href}
                  className="inline-flex h-10 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {action.label}
                </a>
              ) : (
                <span
                  key={action.label}
                  aria-disabled="true"
                  className="inline-flex h-10 cursor-not-allowed items-center rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-400"
                >
                  {action.label}
                </span>
              ),
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center text-sm text-slate-600">
          <span>{customerEmail || "No email"}</span>
          <span className="px-4 text-slate-300" aria-hidden="true">
            |
          </span>
          <span>{formattedPhone}</span>
          <span className="px-4 text-slate-300" aria-hidden="true">
            |
          </span>
          <span>
            UUID: <span className="font-mono text-slate-900">{customer.id}</span>
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AdminSummaryCard
          label="Most Recent Booking"
          value={mostRecentBookingValue}
          icon={CalendarDaysIcon}
          tone="blue"
          compact
          stretch
          href={mostRecentBooking ? `/admin/bookings/${mostRecentBooking.id}` : undefined}
        />
        <AdminSummaryCard
          label="Total Bookings"
          value={bookings.length}
          icon={HashtagIcon}
          tone="violet"
          compact
          stretch
        />
        <AdminSummaryCard
          label="Active Bookings"
          value={activeBookings.length}
          icon={SignalIcon}
          tone="teal"
          compact
          stretch
        />
        <AdminSummaryCard
          label="Portal Status"
          value={formatStatusLabel(customer.portal_status ?? "invited")}
          icon={UserCircleIcon}
          tone="amber"
          compact
          stretch
        />
        <AdminSummaryCard
          label="Lifetime Value"
          value={formatUsd(lifetimeValue)}
          icon={BanknotesIcon}
          tone="green"
          compact
          stretch
        />
      </section>

      <div className="mt-8 space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Linked bookings</h2>
                <InteractiveInfoPopover
                  label="Linked bookings explanation"
                  title="Booking relationship"
                  body="Customer/account owner, booking contact, and service location can differ across bookings."
                  learnMoreHref="/admin/docs/customer-booking-identity"
                />
              </div>
              <div className="text-sm font-medium text-slate-500">{linkedBookingsCountLabel}</div>
            </div>
          </div>

          <div className="space-y-3">
            {bookings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
                No bookings are linked to this customer yet.
              </div>
            ) : (
              <>
                <div
                  role="row"
                  className="hidden rounded-[22px] border border-slate-200/90 bg-slate-100 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)_minmax(260px,0.86fr)_minmax(240px,0.95fr)_56px] lg:items-center lg:gap-4"
                >
                  <div>ID / Status</div>
                  <div>Customer</div>
                  <div>Service Location</div>
                  <div>Dates</div>
                </div>
                {visibleLinkedBookings.map((booking) => (
                  <BookingListRow key={booking.id} booking={booking} />
                ))}
              </>
            )}
          </div>

          {bookings.length > visibleLinkedBookings.length ? (
            <div className="mt-5">
              <Link href={viewAllBookingsHref} className="text-sm font-semibold text-[#F97316] hover:text-orange-600">
                View all bookings
              </Link>
            </div>
          ) : null}
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Saved service locations</h2>
              <InteractiveInfoPopover
                label="Saved service locations explanation"
                title="Saved service locations"
                body="Reusable customer locations. These are separate from booking address snapshots."
              />
            </div>
            <div className="text-sm font-medium text-slate-500">{savedLocationsCountLabel}</div>
          </div>

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
        </section>

        <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Audit History</h2>
            <p className="mt-1 text-sm text-slate-500">Important identity and portal-status changes.</p>

            <div className="mt-4 space-y-3">
              {history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
                  No customer history recorded yet.
                </div>
              ) : (
                history.map((entry) => (
                  <AdminAuditHistoryCard
                    key={entry.id}
                    title={entry.field_name.replaceAll("_", " ")}
                    beforeValue={entry.old_value || "—"}
                    afterValue={entry.new_value || "—"}
                    changedAt={entry.created_at}
                    changedBy={entry.changed_by_type}
                    formatDateTime={formatDateTime}
                  />
                ))
              )}
            </div>
          </div>

          <div className="self-start rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Portal access</h2>
              <InteractiveInfoPopover
                label="Portal access explanation"
                title="Access behavior"
                body="Deactivating portal access is soft-only. It does not delete customers or bookings. Turning off portal access only affects sign-in and self-service access."
                learnMoreHref="/admin/docs/customer-booking-identity"
              />
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{customer.portal_status ?? "invited"}</div>
              {customer.deactivated_at ? (
                <div className="mt-2 text-sm text-slate-500">
                  Deactivated {formatDate(customer.deactivated_at)}{customer.deactivation_reason ? ` • ${customer.deactivation_reason}` : ""}
                </div>
              ) : null}
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

              {customer.portal_status === "active" || customer.portal_status === "invited" ? (
                <div className="flex items-start gap-2 text-sm text-slate-500">
                  <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <p>Deactivating portal access prevents the user from managing their booking.</p>
                </div>
              ) : null}
            </form>
          </div>
        </div>
      </div>
    </AdminPage>
  );
}
