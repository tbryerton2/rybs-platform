"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentType, KeyboardEvent, SVGProps } from "react";
import {
  CalendarDaysIcon,
  ChatBubbleBottomCenterTextIcon,
  ChevronRightIcon,
  ClockIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { canReorderBooking } from "@/lib/reorder";
import type { PortalBookingSummary } from "@/lib/portal/data";
import { getPortalRentalLabel } from "@/lib/portal/rental-number";
import { PortalStatusBadge } from "./portal-status-badge";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00`));
}

function getPickupValue(booking: PortalBookingSummary) {
  if (booking.pickup_mode === "schedule" && booking.pickup_date) {
    return formatDate(booking.pickup_date);
  }
  if (booking.pickup_mode === "request") {
    return "Requested";
  }
  return "Not scheduled";
}

function needsCustomerAction(booking: PortalBookingSummary) {
  return booking.portalStage === "delivered" || booking.portalStage === "pickup_requested";
}

function MetaBox({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: "delivery" | "pickup" | "next" | "requests" | "requestsActive" | "nextActive";
}) {
  const styles = {
    delivery: {
      box: "border-blue-200/80 bg-blue-50/70",
      icon: "bg-white text-blue-700 ring-blue-100",
      label: "text-blue-700/80",
      value: "text-slate-900",
    },
    pickup: {
      box: "border-emerald-200/80 bg-emerald-50/65",
      icon: "bg-white text-emerald-700 ring-emerald-100",
      label: "text-emerald-700/80",
      value: "text-slate-900",
    },
    next: {
      box: "border-amber-200/80 bg-amber-50/65",
      icon: "bg-white text-amber-700 ring-amber-100",
      label: "text-amber-800/80",
      value: "text-slate-900",
    },
    nextActive: {
      box: "border-amber-300 bg-amber-50/90",
      icon: "bg-white text-amber-700 ring-amber-100",
      label: "text-amber-800",
      value: "text-slate-950",
    },
    requests: {
      box: "border-slate-200/80 bg-slate-50/55",
      icon: "bg-white/90 text-slate-500 ring-slate-200/80",
      label: "text-slate-500",
      value: "text-slate-700",
    },
    requestsActive: {
      box: "border-slate-300 bg-slate-100/90",
      icon: "bg-white text-slate-700 ring-slate-200",
      label: "text-slate-700",
      value: "text-slate-950",
    },
  }[tone];

  return (
    <div className={`rounded-2xl border px-3 py-3 ${styles.box}`}>
      <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide ${styles.label}`}>
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ring-1 ${styles.icon}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span>{label}</span>
      </div>
      <div className={`mt-2 text-sm leading-6 ${styles.value}`}>{value}</div>
    </div>
  );
}

export function PortalBookingCard({
  booking,
  compact = false,
}: {
  booking: PortalBookingSummary;
  compact?: boolean;
}) {
  const reorderEligible = canReorderBooking(booking.status);
  const router = useRouter();
  const rentalHref = `/portal/rentals/${booking.id}`;

  function openRental() {
    router.push(rentalHref);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openRental();
    }
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Open rental ${getPortalRentalLabel(booking.booking_ref)}`}
      onClick={openRental}
      onKeyDown={handleKeyDown}
      className="group cursor-pointer rounded-[28px] border border-slate-300 bg-white px-4 py-4 shadow-[0_22px_44px_rgba(15,23,42,0.1)] transition hover:-translate-y-[5px] hover:border-slate-400 hover:shadow-[0_32px_62px_rgba(15,23,42,0.16)] focus:outline-none focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f6f4ef] sm:px-5"
    >
      <div className="-mx-1 rounded-[22px] border border-slate-200 bg-slate-50 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition group-hover:border-slate-300 group-hover:bg-white sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-slate-900">{getPortalRentalLabel(booking.booking_ref)}</div>
            </div>
            <div className="mt-1 text-sm leading-6 text-slate-500">
              {booking.customer_street || "Address pending"}
              {booking.customer_city || booking.customer_zip
                ? `, ${[booking.customer_city, booking.customer_zip].filter(Boolean).join(" ")}`
                : ""}
            </div>
          </div>
          <div className="flex items-center gap-2 self-start">
            <PortalStatusBadge stage={booking.portalStage} />
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_4px_12px_rgba(15,23,42,0.05)] transition group-hover:border-[#f4c7ab] group-hover:bg-[#fff4eb] group-hover:text-[#ea580c]">
              <ChevronRightIcon className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-200/80 pt-4">
        <div className={`grid gap-3 ${compact ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
          <MetaBox
            label="Delivery"
            value={formatDate(booking.delivery_date)}
            icon={TruckIcon}
            tone="delivery"
          />
          <MetaBox
            label="Pickup"
            value={getPickupValue(booking)}
            icon={CalendarDaysIcon}
            tone="pickup"
          />
          <MetaBox
            label="Next step"
            value={booking.nextAction}
            icon={ClockIcon}
            tone={needsCustomerAction(booking) ? "nextActive" : "next"}
          />
          {!compact ? (
            <MetaBox
              label="Requests"
              value={`${booking.requestCount} submitted`}
              icon={ChatBubbleBottomCenterTextIcon}
              tone={booking.requestCount > 0 ? "requestsActive" : "requests"}
            />
          ) : null}
        </div>
      </div>

      {booking.latestRequestSummary ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-600">
          Latest request: {booking.latestRequestSummary}
        </div>
      ) : null}

      {reorderEligible ? (
        <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-200/80 pt-4" onClick={(event) => event.stopPropagation()}>
          <Link
            href={`/book/address?reorderFrom=${encodeURIComponent(booking.id)}`}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          >
            Book again
          </Link>
        </div>
      ) : null}
    </div>
  );
}
