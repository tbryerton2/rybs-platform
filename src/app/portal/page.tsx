import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ChatBubbleBottomCenterTextIcon,
  ClockIcon,
  CurrencyDollarIcon,
  LifebuoyIcon,
  MapPinIcon,
  PlusIcon,
  RectangleStackIcon,
  SparklesIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { formatUsdFromCents } from "@/lib/money";
import { requirePortalCustomer } from "@/lib/portal/auth";
import { getPortalDashboardData, type PortalBookingSummary } from "@/lib/portal/data";
import { getPortalRentalLabel } from "@/lib/portal/rental-number";
import { canReorderBooking } from "@/lib/reorder";
import { PortalShell } from "./_components/portal-shell";
import { PortalStatusBadge } from "./_components/portal-status-badge";

function formatDate(value: string | null) {
  if (!value) return "No upcoming date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00`));
}

function formatShortDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00`));
}

function getFirstName(name: string | null) {
  const value = name?.trim();
  if (!value) return "there";
  return value.split(/\s+/)[0] || "there";
}

function formatAddress(booking: PortalBookingSummary) {
  const parts = [
    booking.customer_street,
    [booking.customer_city, booking.customer_zip].filter(Boolean).join(" "),
  ].filter(Boolean);
  return parts.join(", ") || "Address pending";
}

function getPickupLabel(booking: PortalBookingSummary) {
  if (booking.pickup_mode === "schedule" && booking.pickup_date) {
    return formatDate(booking.pickup_date);
  }
  if (booking.pickup_mode === "request") {
    return "Requested";
  }
  return "Not scheduled";
}

function getNextDateLabel(booking: PortalBookingSummary) {
  if (booking.portalStage === "pickup_requested") {
    return "Awaiting team review";
  }

  if (booking.portalStage === "pickup_scheduled" && booking.pickup_date) {
    return `Pickup ${formatShortDate(booking.pickup_date)}`;
  }

  if (
    (booking.portalStage === "booked" ||
      booking.portalStage === "confirmed" ||
      booking.portalStage === "scheduled") &&
    booking.delivery_date
  ) {
    return `Delivery ${formatShortDate(booking.delivery_date)}`;
  }

  if (booking.pickup_date) {
    return `Pickup ${formatShortDate(booking.pickup_date)}`;
  }

  if (booking.latestRequestSummary) {
    return booking.latestRequestSummary;
  }

  return "No upcoming dates";
}

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
type SummaryTone = "orange" | "blue" | "emerald" | "slate";

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {action}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  href,
  actionLabel,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: IconComponent;
  tone: SummaryTone;
  href?: string;
  actionLabel?: string;
}) {
  const toneClasses = {
    orange: {
      icon: "bg-[#fff0e6] text-[#ea580c] ring-[#fed7aa]",
      accent: "bg-[#fff7f2]",
    },
    blue: {
      icon: "bg-blue-50 text-blue-700 ring-blue-200",
      accent: "bg-blue-50/60",
    },
    emerald: {
      icon: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      accent: "bg-emerald-50/60",
    },
    slate: {
      icon: "bg-slate-100 text-slate-700 ring-slate-200",
      accent: "bg-slate-50",
    },
  }[tone];

  return (
    <div className={`rounded-[24px] border border-slate-200 px-4 py-4 shadow-sm sm:px-5 ${toneClasses.accent}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${toneClasses.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
        {href && actionLabel ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            {actionLabel}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
      <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.8rem]">{value}</div>
      {hint ? <p className="mt-2 text-sm font-medium text-slate-500">{hint}</p> : null}
    </div>
  );
}

function QuickAction({
  title,
  href,
  icon: Icon,
  hint,
  primary = false,
}: {
  title: string;
  href: string;
  icon: IconComponent;
  hint?: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "group rounded-[24px] border px-4 py-4 shadow-sm transition sm:px-5",
        primary
          ? "border-[#ea580c] bg-[#f97316] text-white shadow-[0_18px_32px_rgba(249,115,22,0.22)] hover:bg-[#ea580c]"
          : "border-slate-200 bg-white text-slate-900 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={[
            "inline-flex h-11 w-11 items-center justify-center rounded-2xl ring-1",
            primary
              ? "bg-white/16 text-white ring-white/20"
              : "bg-slate-100 text-slate-700 ring-slate-200 group-hover:bg-white",
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </span>
        <ArrowRightIcon
          className={[
            "h-4 w-4 transition",
            primary ? "text-white/80" : "text-slate-400 group-hover:text-slate-700",
          ].join(" ")}
        />
      </div>
      <div className="mt-4 text-base font-semibold">{title}</div>
      {hint ? (
        <div className={["mt-1 text-sm", primary ? "text-white/85" : "text-slate-500"].join(" ")}>{hint}</div>
      ) : null}
    </Link>
  );
}

function RentalFact({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: IconComponent;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        <Icon className="h-4 w-4 text-slate-400" />
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function RentalActionItem({
  title,
  subtitle,
  href,
  ctaLabel,
  icon: Icon,
  eligible,
  reason,
  primary = false,
}: {
  title: string;
  subtitle?: string;
  href: string;
  ctaLabel: string;
  icon: IconComponent;
  eligible: boolean;
  reason: string | null;
  primary?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 py-4 first:border-t-0 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
        </div>
      </div>

      {eligible ? (
        <Link
          href={href}
          className={[
            "inline-flex shrink-0 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
            primary
              ? "bg-slate-900 text-white hover:bg-slate-800"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          ].join(" ")}
        >
          {ctaLabel}
        </Link>
      ) : (
        <div className="text-sm text-slate-500 sm:max-w-xs">{reason}</div>
      )}
    </div>
  );
}

function SingleActiveRentalCard({ booking }: { booking: PortalBookingSummary }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Active rental
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {getPortalRentalLabel(booking.booking_ref)}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{formatAddress(booking)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PortalStatusBadge stage={booking.portalStage} />
          {booking.requestCount > 0 ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {booking.requestCount} request{booking.requestCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <RentalFact label="Delivery" value={formatDate(booking.delivery_date)} icon={TruckIcon} />
        <RentalFact label="Pickup" value={getPickupLabel(booking)} icon={CalendarDaysIcon} />
        <RentalFact
          label="Rental total"
          value={formatUsdFromCents(booking.total_price_cents)}
          icon={CurrencyDollarIcon}
        />
      </div>

      <div className="mt-5 rounded-[24px] border border-amber-100 bg-amber-50/80 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800">
          <ClockIcon className="h-4 w-4" />
          <span>What happens next</span>
        </div>
        <div className="mt-2 text-base font-semibold text-slate-900">{getNextDateLabel(booking)}</div>
        <div className="mt-1 text-sm text-slate-600">{booking.nextAction}</div>
        {booking.latestRequestSummary ? (
          <div className="mt-2 text-sm text-slate-600">Latest request: {booking.latestRequestSummary}</div>
        ) : null}
      </div>

      <div className="mt-5 space-y-1">
        <RentalActionItem
          title="View rental"
          subtitle="Status, details, and request history"
          href={`/portal/rentals/${booking.id}`}
          ctaLabel="View rental"
          icon={RectangleStackIcon}
          eligible
          reason={null}
          primary
        />
        <RentalActionItem
          title="Request pickup"
          subtitle="Finished and ready for removal"
          href={`/portal/rentals/${booking.id}/pickup-request`}
          ctaLabel="Request pickup"
          icon={TruckIcon}
          eligible={booking.pickupEligibility.eligible}
          reason={booking.pickupEligibility.reason}
        />
        <RentalActionItem
          title="Request more time"
          subtitle="Ask to keep the rental longer"
          href={`/portal/rentals/${booking.id}/extension-request`}
          ctaLabel="Request more time"
          icon={ClockIcon}
          eligible={booking.extensionEligibility.eligible}
          reason={booking.extensionEligibility.reason}
        />
        <RentalActionItem
          title="Report an issue"
          subtitle="Get help with a current problem"
          href={`/portal/rentals/${booking.id}/issue-report`}
          ctaLabel="Report issue"
          icon={LifebuoyIcon}
          eligible={booking.issueReportEligibility.eligible}
          reason={booking.issueReportEligibility.reason}
        />
      </div>
    </div>
  );
}

function MultiRentalCard({ booking }: { booking: PortalBookingSummary }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-base font-semibold text-slate-900">{getPortalRentalLabel(booking.booking_ref)}</div>
          <div className="mt-1 text-sm leading-6 text-slate-500">{formatAddress(booking)}</div>
        </div>
        <PortalStatusBadge stage={booking.portalStage} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <RentalFact label="Next step" value={getNextDateLabel(booking)} icon={ClockIcon} />
        <RentalFact
          label="Latest update"
          value={booking.latestRequestSummary || booking.nextAction}
          icon={ChatBubbleBottomCenterTextIcon}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          {booking.requestCount > 0
            ? `${booking.requestCount} request${booking.requestCount === 1 ? "" : "s"}`
            : "No requests"}
        </div>
        <Link
          href={`/portal/rentals/${booking.id}`}
          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          View rental
        </Link>
      </div>
    </div>
  );
}

function PreviousRentalCard({ booking }: { booking: PortalBookingSummary }) {
  const reorderEligible = canReorderBooking(booking.status);

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Most recent rental
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {getPortalRentalLabel(booking.booking_ref)}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{formatAddress(booking)}</p>
        </div>
        <PortalStatusBadge stage={booking.portalStage} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <RentalFact label="Delivery" value={formatDate(booking.delivery_date)} icon={TruckIcon} />
        <RentalFact label="Pickup" value={getPickupLabel(booking)} icon={CalendarDaysIcon} />
        <RentalFact
          label="Rental total"
          value={formatUsdFromCents(booking.total_price_cents)}
          icon={CurrencyDollarIcon}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {reorderEligible ? (
          <Link
            href={`/book/address?reorderFrom=${encodeURIComponent(booking.id)}`}
            className="inline-flex items-center justify-center rounded-2xl bg-[#f97316] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#ea580c]"
          >
            Book again
          </Link>
        ) : (
          <Link
            href="/book"
            className="inline-flex items-center justify-center rounded-2xl bg-[#f97316] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#ea580c]"
          >
            New booking
          </Link>
        )}
        <Link
          href={`/portal/rentals/${booking.id}`}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          View rental
        </Link>
        <Link
          href="/portal/rentals"
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          History
        </Link>
      </div>
    </div>
  );
}

function EmptyDashboardState() {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-[#fff0e6] text-[#ea580c] ring-1 ring-[#fed7aa]">
        <SparklesIcon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">No rentals yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Start your first booking and this dashboard will track what comes next.
      </p>
      <div className="mt-6">
        <Link
          href="/book"
          className="inline-flex items-center rounded-2xl bg-[#f97316] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ea580c]"
        >
          Start a booking
        </Link>
      </div>
    </div>
  );
}

export default async function PortalHomePage() {
  const customer = await requirePortalCustomer();
  const {
    bookings,
    activeRentals,
    latestPastRental,
    completedRentals,
    totalSpentCents,
    locations,
  } = await getPortalDashboardData(customer.id);

  const firstName = getFirstName(customer.name);
  const activeCount = activeRentals.length;
  const openRequestCount = activeRentals.reduce((sum, booking) => sum + booking.requestCount, 0);
  const deliveriesComingUp = activeRentals.filter((booking) => Boolean(booking.delivery_date)).length;
  const pickupsComingUp = activeRentals.filter(
    (booking) => booking.pickup_mode === "schedule" && Boolean(booking.pickup_date),
  ).length;
  const hasHistory = bookings.length > 0;
  const showSaveLocation = bookings.length > 2 || locations.length > 0;
  const helpHref = activeRentals[0] ? `/portal/rentals/${activeRentals[0].id}/issue-report` : "/portal/help";

  const summaryCards =
    activeCount > 1
      ? [
          {
            label: "Active rentals",
            value: String(activeCount),
            hint: "In progress",
            icon: RectangleStackIcon,
            tone: "orange" as const,
          },
          {
            label: "Deliveries",
            value: String(deliveriesComingUp),
            hint: deliveriesComingUp > 0 ? "Coming up" : "None scheduled",
            icon: TruckIcon,
            tone: "blue" as const,
          },
          {
            label: "Pickups",
            value: String(pickupsComingUp),
            hint: pickupsComingUp > 0 ? "Already scheduled" : "No dates set",
            icon: CalendarDaysIcon,
            tone: "emerald" as const,
          },
          {
            label: "Open requests",
            value: String(openRequestCount),
            hint: openRequestCount > 0 ? "Awaiting follow-up" : "All clear",
            icon: ChatBubbleBottomCenterTextIcon,
            tone: "slate" as const,
          },
        ]
      : activeCount === 1
        ? [
            {
              label: "Active rental",
              value: "1",
              hint: "In progress",
              icon: RectangleStackIcon,
              tone: "orange" as const,
            },
            {
              label: "What happens next",
              value: getNextDateLabel(activeRentals[0]),
              hint: activeRentals[0].nextAction,
              icon: ClockIcon,
              tone: "blue" as const,
            },
            {
              label: "Open requests",
              value: String(openRequestCount),
              hint:
                openRequestCount > 0
                  ? activeRentals[0].latestRequestSummary || "Latest request is still active"
                  : "No open requests",
              icon: ChatBubbleBottomCenterTextIcon,
              tone: "slate" as const,
            },
            {
              label: "Lifetime rentals",
              value: String(bookings.length),
              hint: bookings.length > 1 ? `${formatUsdFromCents(totalSpentCents)} total` : "First rental",
              icon: CurrencyDollarIcon,
              tone: "emerald" as const,
            },
          ]
        : hasHistory && latestPastRental
          ? [
              {
                label: "Last rental",
                value: formatDate(latestPastRental.pickup_date || latestPastRental.delivery_date),
                hint: "Most recent visit",
                icon: CalendarDaysIcon,
                tone: "blue" as const,
              },
              {
                label: "Lifetime rentals",
                value: String(bookings.length),
                hint: "All time",
                icon: RectangleStackIcon,
                tone: "orange" as const,
              },
              {
                label: "Total spent",
                value: formatUsdFromCents(totalSpentCents),
                hint: "Across all rentals",
                icon: CurrencyDollarIcon,
                tone: "emerald" as const,
              },
              {
                label: "Book again",
                value: "Ready when you are",
                hint: "Start another rental",
                icon: SparklesIcon,
                tone: "slate" as const,
                href: canReorderBooking(latestPastRental.status)
                  ? `/book/address?reorderFrom=${encodeURIComponent(latestPastRental.id)}`
                  : "/book",
                actionLabel: "Book now",
              },
            ]
          : [
              {
                label: "Active rentals",
                value: "0",
                hint: "Nothing active",
                icon: RectangleStackIcon,
                tone: "orange" as const,
              },
              {
                label: "Completed rentals",
                value: "0",
                hint: "No history yet",
                icon: CalendarDaysIcon,
                tone: "blue" as const,
              },
              {
                label: "First booking",
                value: "Start now",
                hint: "Track everything here",
                icon: SparklesIcon,
                tone: "emerald" as const,
                href: "/book",
                actionLabel: "Book now",
              },
            ];

  return (
    <PortalShell pathname="/portal">
      <div className="space-y-8">
        <section>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            Track progress, request help, and stay on top of what happens next.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard key={`${card.label}-${card.value}`} {...card} />
          ))}
        </section>

        <section>
          <SectionHeader title="Quick actions" />

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QuickAction
              title="View rentals"
              hint="Open active and past rentals"
              href="/portal/rentals"
              icon={RectangleStackIcon}
            />
            <QuickAction title="Request help" hint="Get support fast" href={helpHref} icon={LifebuoyIcon} />
            {showSaveLocation ? (
              <QuickAction
                title="Save service location"
                hint="Reuse job site details"
                href="/portal/locations"
                icon={MapPinIcon}
              />
            ) : null}
            <QuickAction title="New booking" hint="Start a rental" href="/book" icon={PlusIcon} primary />
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            title={
              activeCount > 1
                ? "Active rentals"
                : activeCount === 1
                  ? "Your rental"
                  : hasHistory
                    ? "Previous rental"
                    : "Start here"
            }
            action={
              activeCount > 1 ? (
                <Link href="/portal/rentals" className="text-sm font-semibold text-slate-600 transition hover:text-slate-900">
                  View all
                </Link>
              ) : undefined
            }
          />

          {activeCount > 1 ? (
            <div className="space-y-4">
              {activeRentals.map((booking) => (
                <MultiRentalCard key={booking.id} booking={booking} />
              ))}
            </div>
          ) : activeCount === 1 ? (
            <SingleActiveRentalCard booking={activeRentals[0]} />
          ) : latestPastRental ? (
            <PreviousRentalCard booking={latestPastRental} />
          ) : (
            <EmptyDashboardState />
          )}
        </section>

        {completedRentals.length > 0 && activeCount > 0 ? (
          <section className="rounded-[26px] border border-slate-200 bg-slate-50/70 px-5 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Rental history</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {completedRentals.length} completed rental{completedRentals.length === 1 ? "" : "s"}
                </p>
              </div>
              <Link
                href="/portal/rentals"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                View rental history
              </Link>
            </div>
          </section>
        ) : null}
      </div>
    </PortalShell>
  );
}
