"use client";

import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ChatBubbleLeftRightIcon,
  HomeIcon,
  LifebuoyIcon,
  MapPinIcon,
  PlusIcon,
  RectangleStackIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type PortalNavItem = {
  href: string;
  label: string;
  active: boolean;
  icon: "dashboard" | "rentals" | "locations" | "profile" | "support" | "feedback" | "signout";
};

const iconMap: Record<PortalNavItem["icon"], IconComponent> = {
  dashboard: HomeIcon,
  rentals: RectangleStackIcon,
  locations: MapPinIcon,
  profile: UserCircleIcon,
  support: LifebuoyIcon,
  feedback: ChatBubbleLeftRightIcon,
  signout: ArrowRightOnRectangleIcon,
};

function MobileNavLink({
  item,
  onClick,
}: {
  item: PortalNavItem;
  onClick: () => void;
}) {
  const Icon = iconMap[item.icon];

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={[
        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
        item.active
          ? "bg-[#fff4eb] text-slate-950"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition",
          item.active
            ? "border-[#f9c39d] bg-[#f97316] text-white shadow-[0_10px_24px_rgba(249,115,22,0.22)]"
            : "border-slate-200 bg-white text-slate-500",
        ].join(" ")}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

export function PortalNavDrawer({
  navItems,
  utilityItems,
}: {
  navItems: PortalNavItem[];
  utilityItems: PortalNavItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-3 shadow-sm lg:hidden">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Customer Portal
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open portal navigation"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close portal navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]"
          />

          <div className="absolute inset-y-0 left-0 w-[88vw] max-w-sm overflow-y-auto border-r border-slate-200 bg-white px-5 py-5 shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Customer Portal
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close portal navigation"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <nav aria-label="Portal navigation" className="mt-6 space-y-1">
              {navItems.map((item) => (
                <MobileNavLink key={item.href} item={item} onClick={() => setOpen(false)} />
              ))}
            </nav>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <div className="space-y-1">
                {utilityItems.map((item) => (
                  <MobileNavLink key={item.href} item={item} onClick={() => setOpen(false)} />
                ))}
              </div>

              <Link
                href="/book"
                onClick={() => setOpen(false)}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#c2410c] bg-[#f97316] px-4 py-3 text-sm font-semibold text-white transition hover:border-[#9a3412] hover:bg-[#ea580c]"
              >
                <PlusIcon className="h-4 w-4" />
                New booking
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
