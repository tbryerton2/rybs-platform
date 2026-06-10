"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import {
  ArrowUturnLeftIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { adminSummaryCardShell } from "@/app/admin/_components/AdminSummaryCard";
import ScheduleBoard from "./schedule-board";

type BookingRow = {
  id: string;
  booking_ref: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  delivery_date: string | null;
  pickup_date: string | null;
  pickup_mode: "request" | "schedule" | null;
  dumpster_id: string | null;
  dumpster_size: string | null;
  assigned_dumpster:
    | {
        display_name: string | null;
        equipment_id: string | null;
      }
    | null;
  status: "confirmed" | "scheduled" | "delivered" | "picked_up" | "cancelled";
  created_at: string | null;
  notes?: string | null;
  placement_preference: string | null;
  placement_details: string | null;
  access_issues: string[] | null;
  gate_instructions: string | null;
  delivery_presence: string | null;
  alternate_contact_name: string | null;
  alternate_contact_phone: string | null;
  placement_photo_url: string | null;
  special_delivery_instructions: string | null;
};

type DayData = {
  iso: string;
  dateLabel: string;
  isToday: boolean;
  deliveries: BookingRow[];
  pickups: BookingRow[];
  startOnSite: number;
  endOnSite: number;
  remaining: number;
  hasCapacityIssue: boolean;
  totalStops: number;
  workloadLabel: string | null;
};

export type ScheduleBoardFilter =
  | "stops"
  | "deliveries"
  | "pickups"
  | "overdueDeliveries"
  | "overduePickups";

function OctagonAlert(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.172 2.75h5.656a2 2 0 0 1 1.414.586l5.172 5.172a2 2 0 0 1 .586 1.414v4.156a2 2 0 0 1-.586 1.414l-5.172 5.172a2 2 0 0 1-1.414.586H9.172a2 2 0 0 1-1.414-.586l-5.172-5.172A2 2 0 0 1 2 14.078V9.922a2 2 0 0 1 .586-1.414L7.758 3.336a2 2 0 0 1 1.414-.586Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.75v5.5" />
      <circle cx="12" cy="16.25" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

type StatTone = "orange" | "blue" | "emerald" | "slate" | "rose";

function FilterSummaryCard({
  icon: Icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: number;
  tone: StatTone;
  active: boolean;
  onClick: () => void;
}) {
  const toneClasses: Record<StatTone, { card: string; icon: string; activeRing: string }> = {
    orange: {
      card: adminSummaryCardShell("amber", "h-full p-5"),
      icon: "bg-amber-100/95 text-amber-700 ring-amber-200/90",
      activeRing: "ring-2 ring-amber-300/90",
    },
    blue: {
      card: adminSummaryCardShell("blue", "h-full p-5"),
      icon: "bg-sky-100/95 text-sky-700 ring-sky-200/90",
      activeRing: "ring-2 ring-sky-300/90",
    },
    emerald: {
      card: adminSummaryCardShell("green", "h-full p-5"),
      icon: "bg-emerald-100/95 text-emerald-700 ring-emerald-200/90",
      activeRing: "ring-2 ring-emerald-300/90",
    },
    slate: {
      card: adminSummaryCardShell("violet", "h-full p-5"),
      icon: "bg-violet-100/95 text-violet-700 ring-violet-200/90",
      activeRing: "ring-2 ring-violet-300/90",
    },
    rose: {
      card: adminSummaryCardShell("rose", "h-full p-5"),
      icon: "bg-rose-100/95 text-rose-700 ring-rose-200/90",
      activeRing: "ring-2 ring-rose-300/90",
    },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${toneClasses[tone].card} text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 ${
        active ? toneClasses[tone].activeRing : "ring-1 ring-transparent"
      }`}
    >
      <div className="flex gap-4">
        <div
          className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/65 ring-1 ring-inset ${toneClasses[tone].icon}`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="flex h-12 items-center text-sm font-medium leading-5 text-slate-600">{label}</div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{value}</div>
        </div>
      </div>
    </button>
  );
}

export default function ScheduleBoardView({
  days,
  totalStops,
  totalDeliveries,
  totalPickups,
  overdueDeliveriesCount,
  overduePickupsCount,
}: {
  days: DayData[];
  totalStops: number;
  totalDeliveries: number;
  totalPickups: number;
  overdueDeliveriesCount: number;
  overduePickupsCount: number;
}) {
  const [activeFilter, setActiveFilter] = useState<ScheduleBoardFilter>("stops");

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <FilterSummaryCard
          icon={MapPinIcon}
          label="Stops scheduled"
          value={totalStops}
          tone="orange"
          active={activeFilter === "stops"}
          onClick={() => setActiveFilter("stops")}
        />
        <FilterSummaryCard
          icon={TruckIcon}
          label="Deliveries"
          value={totalDeliveries}
          tone="emerald"
          active={activeFilter === "deliveries"}
          onClick={() => setActiveFilter("deliveries")}
        />
        <FilterSummaryCard
          icon={ArrowUturnLeftIcon}
          label="Pickups"
          value={totalPickups}
          tone="blue"
          active={activeFilter === "pickups"}
          onClick={() => setActiveFilter("pickups")}
        />
        <FilterSummaryCard
          icon={OctagonAlert}
          label="Overdue deliveries"
          value={overdueDeliveriesCount}
          tone="slate"
          active={activeFilter === "overdueDeliveries"}
          onClick={() => setActiveFilter("overdueDeliveries")}
        />
        <FilterSummaryCard
          icon={ExclamationTriangleIcon}
          label="Overdue pickups"
          value={overduePickupsCount}
          tone="rose"
          active={activeFilter === "overduePickups"}
          onClick={() => setActiveFilter("overduePickups")}
        />
      </div>

      <div className="mt-6">
        <ScheduleBoard days={days} activeFilter={activeFilter} />
      </div>
    </>
  );
}
