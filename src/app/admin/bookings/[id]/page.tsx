export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatUsdFromCents } from "@/lib/money";
import {
  quickCancelBookingAction,
  quickMarkDeliveredAction,
  quickMarkPickedUpAction,
  updateBookingStatusAction,
  updateDeliveryDateAction,
  updatePickupDetailsAction,
  updateNotesAction,
} from "./actions";

import {
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/solid";

import {
  ArrowUturnLeftIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CurrencyDollarIcon,
  FlagIcon,
  PencilSquareIcon,
  TruckIcon,
  UserIcon,
} from "@heroicons/react/24/outline";


type BookingStatus =
  | "confirmed"
  | "scheduled"
  | "delivered"
  | "picked_up"
  | "cancelled";

type PickupMode = "request" | "schedule" | null;

type Booking = {
  id: string;
  created_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string | null;
  pickup_mode: PickupMode;
  pickup_date: string | null;
  status: BookingStatus;
  total_price_cents: number | null;
  service_county: string | null;
  service_town: string | null;
  delivered_at: string | null;
  picked_up_at: string | null;
  job_type: string | null;
  notes: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
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

function isFilled(value: string | null | undefined) {
  return !!value;
}

function timelineDotClasses(done: boolean, active = false) {
  if (done) return "bg-emerald-500 ring-emerald-200";
  if (active) return "bg-[#F97316] ring-[#F97316]/20";
  return "bg-slate-300 ring-slate-200";
}

function toSmsHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `sms:${digits}`;
}

function toTelHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `tel:${digits}`;
}

function getDaysOnSite(deliveredAt: string | null, deliveryDate: string | null) {
  const source = deliveredAt ?? deliveryDate;
  if (!source) return null;

  const start = new Date(source);
  if (Number.isNaN(start.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

function daysOnSiteClasses(days: number | null) {
  if (days == null) return "text-slate-900";
  if (days >= 7) return "text-rose-600 font-semibold";
  if (days >= 5) return "text-amber-600 font-semibold";
  return "text-slate-900";
}

function statusClasses(status: BookingStatus) {
  switch (status) {
    case "confirmed":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "scheduled":
      return "bg-indigo-50 text-indigo-700 ring-indigo-200";
    case "delivered":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "picked_up":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "cancelled":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200";
  }
}


function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2.5 gap-y-2">
          {icon ? (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
              {icon}
            </span>
          ) : (
            <span />
          )}

          <h2 className="text-base font-semibold text-slate-900">{title}</h2>

          {description ? (
            <p className="col-start-2 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-900">{value || "—"}</div>
    </div>
  );
}

function TimelineItem({
  label,
  value,
  done,
  active = false,
  isLast = false,
}: {
  label: string;
  value: string;
  done: boolean;
  active?: boolean;
  isLast?: boolean;
}) {
  return (
    <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
      {!isLast && (
        <div className="absolute left-[6px] top-3 bottom-[-12px] w-px bg-slate-200" />
      )}
      <span
        className={`relative z-10 inline-flex h-3 w-3 rounded-full ring-4 ${timelineDotClasses(
          done,
          active
        )}`}
        aria-hidden="true"
      />
      <div className={`min-w-0 text-sm font-medium ${active ? "text-slate-900" : "text-slate-700"}`}>
        {label}
      </div>
      <div className="text-sm text-slate-500">{value}</div>
    </div>
  );
}

export default async function AdminBookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select(`
      id,
      created_at,
      customer_name,
      customer_email,
      customer_phone,
      customer_street,
      customer_city,
      customer_zip,
      delivery_date,
      pickup_mode,
      pickup_date,
      status,
      total_price_cents,
      service_county,
      service_town,
      delivered_at,
      picked_up_at,
      job_type,
      notes
    `)
    .eq("id", id)
    .single<Booking>();

  if (error) {
    throw new Error(error.message);
  }

  if (!booking) {
    notFound();
  }

  const onSite = booking.status === "delivered";
  const deliveryPending =
    booking.status === "confirmed" || booking.status === "scheduled";
  const pickupRequested =
    booking.status === "delivered" && booking.pickup_mode === "request";
  const pickupScheduled =
    booking.status === "delivered" &&
    booking.pickup_mode === "schedule" &&
    !!booking.pickup_date;

  const canMarkDelivered =
  booking.status === "confirmed" || booking.status === "scheduled";

  const canCancel =
    booking.status === "confirmed" ||
    booking.status === "scheduled" ||
    booking.status === "delivered";

  const canSchedulePickup =
    booking.status === "delivered" && booking.pickup_mode === "request";

  const canMarkPickedUp = booking.status === "delivered";

  const createdDone = isFilled(booking.created_at);
  const deliveryScheduledDone = isFilled(booking.delivery_date);
  const deliveredDone = isFilled(booking.delivered_at) || booking.status === "delivered" || booking.status === "picked_up";
  const pickupRequestedDone = booking.pickup_mode === "request";
  const pickupScheduledDone = isFilled(booking.pickup_date) && booking.pickup_mode === "schedule";
  const pickedUpDone = isFilled(booking.picked_up_at) || booking.status === "picked_up";
  const daysOnSite =
  booking.status === "delivered"
    ? getDaysOnSite(booking.delivered_at, booking.delivery_date)
    : null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <Link
          href="/admin/bookings"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Back to bookings
        </Link>
      </div>

      <div className="mb-6 rounded-[32px] bg-white px-6 py-6 shadow-xl ring-1 ring-slate-200/70 sm:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Booking
              </h1>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(
                  booking.status
                )}`}
              >
                {booking.status.replace("_", " ")}
              </span>
            </div>

            <div className="mt-2 break-all text-sm text-slate-500">
              {booking.id}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Delivery date" value={formatDate(booking.delivery_date)} />
              <Field label="Created" value={formatDateTime(booking.created_at)} />
              <Field
                label="Pickup"
                value={
                  booking.pickup_mode === "schedule"
                    ? booking.pickup_date
                      ? formatDate(booking.pickup_date)
                      : "Scheduled"
                    : booking.pickup_mode === "request"
                    ? "Pickup requested"
                    : "—"
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
            {canMarkDelivered ? (
              <form action={quickMarkDeliveredAction}>
                <input type="hidden" name="id" value={booking.id} />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Mark delivered
                </button>
              </form>
            ) : null}

            {canSchedulePickup ? (
              <Link
                href="#pickup"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Schedule pickup
              </Link>
            ) : null}

            {canMarkPickedUp ? (
              <form action={quickMarkPickedUpAction}>
                <input type="hidden" name="id" value={booking.id} />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Mark picked up
                </button>
              </form>
            ) : null}

            {canCancel ? (
              <form action={quickCancelBookingAction}>
                <input type="hidden" name="id" value={booking.id} />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                >
                  Cancel booking
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-[32px] bg-white px-6 py-6 shadow-sm ring-1 ring-slate-200/70 sm:px-8">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2.5 gap-y-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
              <ClockIcon className="h-4 w-4" />
            </span>

            <h2 className="text-base font-semibold text-slate-900">Job timeline</h2>

            <p className="col-start-2 text-sm text-slate-500">
              Operational view of where this booking is in the lifecycle.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <TimelineItem
            label="Booking created"
            value={formatDateTime(booking.created_at)}
            done={createdDone}
          />

          <TimelineItem
            label="Delivery scheduled"
            value={formatDate(booking.delivery_date)}
            done={deliveryScheduledDone}
            active={deliveryScheduledDone && !deliveredDone}
          />

          <TimelineItem
            label="Delivered"
            value={formatDateTime(booking.delivered_at)}
            done={deliveredDone}
            active={booking.status === "delivered" && !pickedUpDone}
          />

          {booking.pickup_mode === "request" ? (
            <TimelineItem
              label="Pickup requested"
              value="Requested"
              done={true}
              active={!pickedUpDone}
            />
          ) : null}

          {booking.pickup_mode === "schedule" ? (
            <TimelineItem
              label="Pickup scheduled"
              value={formatDate(booking.pickup_date)}
              done={pickupScheduledDone}
              active={!pickedUpDone}
            />
          ) : null}

          <TimelineItem
            label="Picked up"
            value={formatDateTime(booking.picked_up_at)}
            done={pickedUpDone}
            isLast
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="min-w-0 space-y-6">
          <Section title="Customer" description="Contact and service location" icon={<UserIcon className="h-4 w-4" />}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Customer name" value={booking.customer_name} />
              <Field
                label="Phone"
                value={
                  booking.customer_phone ? (
                    <a
                      href={toTelHref(booking.customer_phone)}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {booking.customer_phone}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <Field
                label="Email"
                value={
                  booking.customer_email ? (
                    <a
                      href={`mailto:${booking.customer_email}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {booking.customer_email}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
            </div>

            {booking.customer_phone || booking.customer_email ? (
  <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-6">
    {booking.customer_phone ? (
      <>
        <a
          href={toTelHref(booking.customer_phone)}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <PhoneIcon className="h-4 w-4" />
          Call customer
        </a>

        <a
          href={toSmsHref(booking.customer_phone)}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ChatBubbleLeftRightIcon className="h-4 w-4" />
          Text customer
        </a>
      </>
    ) : null}

    {booking.customer_email ? (
      <a
        href={`mailto:${booking.customer_email}`}
        className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <EnvelopeIcon className="h-4 w-4" />
        Email customer
      </a>
    ) : null}
  </div>
) : null}

            <div className="mt-6 border-t border-slate-200 pt-6">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Service address
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-900">
                <div>{booking.customer_street || "—"}</div>
                <div>
                  {[booking.customer_city, booking.customer_zip]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </div>
              </div>
              <div className="mt-6 grid gap-5 border-t border-slate-200 pt-6 sm:grid-cols-2">
                <Field label="Service town" value={booking.service_town} />
                <Field label="Service county" value={booking.service_county} />
              </div>
            </div>
          </Section>

          <div id="delivery">
            <Section title="Delivery details" description="Control delivery timing and state" icon={<TruckIcon className="h-4 w-4" />}>
              <div className="max-w-[820px] space-y-5">
                {saved === "delivery-date" ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    Delivery date saved.
                  </div>
                ) : null}

                <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">Delivery state:</span>
                    <span className="text-sm text-slate-600">
                      {onSite && "Dumpster currently on site."}
                      {deliveryPending && "Delivery is still pending."}
                      {booking.status === "picked_up" && "Job is complete."}
                      {booking.status === "cancelled" && "Booking is cancelled."}
                    </span>
                  </div>
                </div>

                <form action={updateDeliveryDateAction} className="space-y-3">
                  <input type="hidden" name="id" value={booking.id} />

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">
                      Delivery date
                    </span>

                    <div className="h-12 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                      <input
                        type="date"
                        name="delivery_date"
                        defaultValue={booking.delivery_date ?? ""}
                        className="h-full w-full border-0 bg-transparent px-4 text-sm text-slate-900 outline-none"
                      />
                    </div>
                  </label>

                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Save delivery date
                  </button>
                </form>
              </div>
            </Section>
          </div>

          <div id="pickup">
            <Section title="Pickup details" description="Handle pickup requests and scheduling" icon={<ArrowUturnLeftIcon className="h-4 w-4" />}>
              <div className="max-w-[820px] space-y-5">
                {saved === "pickup-details" ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    Pickup details saved.
                  </div>
                ) : null}

                <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Current pickup state
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-900">
                    {booking.pickup_mode === "request" && "Pickup requested"}
                    {booking.pickup_mode === "schedule" &&
                      (booking.pickup_date
                        ? `Scheduled for ${formatDate(booking.pickup_date)}`
                        : "Scheduled")}
                    {!booking.pickup_mode && "No pickup details set"}
                  </div>
                </div>

                <form action={updatePickupDetailsAction} className="space-y-4">
                  <input type="hidden" name="id" value={booking.id} />

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        Pickup mode
                      </span>
                      <select
                        name="pickup_mode"
                        defaultValue={booking.pickup_mode ?? "request"}
                        className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                      >
                        <option value="request">Request</option>
                        <option value="schedule">Scheduled</option>
                      </select>
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">
                          Pickup date
                        </span>

                        <div className="h-12 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                          <input
                            type="date"
                            name="pickup_date"
                            defaultValue={booking.pickup_date ?? ""}
                            className="h-full w-full border-0 bg-transparent px-4 text-sm text-slate-900 outline-none"
                          />
                        </div>
                      </label>
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Save pickup details
                  </button>
                </form>
              </div>
            </Section>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <Section title="Operational summary" icon={<ClipboardDocumentListIcon className="h-4 w-4" />}>
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Job state
                </div>
                <div className="mt-2 text-sm font-medium text-slate-900">
                  {onSite && "On site"}
                  {deliveryPending && "Awaiting delivery"}
                  {booking.status === "picked_up" && "Completed"}
                  {booking.status === "cancelled" && "Cancelled"}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Job type" value={booking.job_type} />
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Days on site
                    </div>

                    <div className={`mt-1 text-sm ${daysOnSiteClasses(daysOnSite)}`}>
                      {daysOnSite == null
                        ? "—"
                        : `${daysOnSite} day${daysOnSite === 1 ? "" : "s"}`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Dispatch signals
                </div>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  <div>{pickupRequested ? "• Pickup requested and needs scheduling" : "• No unscheduled pickup request"}</div>
                  <div>{pickupScheduled ? "• Pickup date is set" : "• No pickup date scheduled"}</div>
                  <div>{onSite ? "• Dumpster currently with customer" : "• Dumpster not currently on site"}</div>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Delivered at" value={formatDateTime(booking.delivered_at)} />
                <Field label="Picked up at" value={formatDateTime(booking.picked_up_at)} />
              </div>
            </div>
            </div>
          </Section>

          <Section title="Financial" icon={<CurrencyDollarIcon className="h-4 w-4" />}>
            <div className="grid gap-4">
              <Field label="Price" value={formatUsdFromCents(booking.total_price_cents)} />
            </div>
          </Section>

          <div id="status">
            <Section title="Status" icon={<FlagIcon className="h-4 w-4" />}>
              {saved === "status" ? (
                <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  Status saved.
                </div>
              ) : null}
              <form action={updateBookingStatusAction} className="space-y-3">
                <input type="hidden" name="id" value={booking.id} />

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Booking status
                  </span>
                  <select
                    name="status"
                    defaultValue={booking.status}
                    className="h-12 min-w-0 w-full rounded-2xl border border-slate-300 px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                  >
                    <option value="confirmed">confirmed</option>
                    <option value="scheduled">scheduled</option>
                    <option value="delivered">delivered</option>
                    <option value="picked_up">picked_up</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </label>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Save status
                </button>
              </form>
            </Section>
          </div>

          <div id="notes">
            <Section title="Admin notes" icon={<PencilSquareIcon className="h-4 w-4" />}>
              {saved === "notes" ? (
                <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  Notes saved.
                </div>
              ) : null}

              <form action={updateNotesAction} className="space-y-4">
                <input type="hidden" name="id" value={booking.id} />

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Internal notes
                  </span>
                  <textarea
                    name="notes"
                    defaultValue={booking.notes ?? ""}
                    rows={6}
                    placeholder="Customer instructions, driveway notes, gate code, placement details, call before arrival, internal follow-up..."
                    className="w-full resize-y rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                  />
                </label>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Save notes
                </button>
              </form>
            </Section>
          </div>

  
        </div>
      </div>
    </div>
  );
}
