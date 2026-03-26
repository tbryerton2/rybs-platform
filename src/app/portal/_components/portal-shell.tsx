import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  ArrowRightOnRectangleIcon,
  ChatBubbleLeftRightIcon,
  HomeIcon,
  LifebuoyIcon,
  MapPinIcon,
  PlusIcon,
  RectangleStackIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { PortalNavDrawer, type PortalNavItem } from "./portal-nav-drawer";

function isActivePath(pathname: string, href: string) {
  return href === "/portal" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const iconMap: Record<PortalNavItem["icon"], IconComponent> = {
  dashboard: HomeIcon,
  rentals: RectangleStackIcon,
  locations: MapPinIcon,
  profile: UserCircleIcon,
  support: LifebuoyIcon,
  feedback: ChatBubbleLeftRightIcon,
  signout: ArrowRightOnRectangleIcon,
};

const navItems: Array<Pick<PortalNavItem, "href" | "label" | "icon">> = [
  { href: "/portal", label: "Dashboard", icon: "dashboard" },
  { href: "/portal/rentals", label: "My rentals", icon: "rentals" },
  { href: "/portal/locations", label: "Locations", icon: "locations" },
  { href: "/portal/account", label: "Account", icon: "profile" },
];

const utilityItems: Array<Pick<PortalNavItem, "href" | "label" | "icon">> = [
  { href: "/portal/help", label: "Support", icon: "support" },
  { href: "/portal/feedback", label: "Feedback", icon: "feedback" },
  { href: "/portal/logout", label: "Sign out", icon: "signout" },
];

function SidebarLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: PortalNavItem["icon"];
  active: boolean;
}) {
  const Icon = iconMap[icon];

  return (
    <Link
      href={href}
      className={[
        "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
        active
          ? "bg-[#fff4eb] text-slate-950"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition",
          active
            ? "border-[#f9c39d] bg-[#f97316] text-white shadow-[0_10px_24px_rgba(249,115,22,0.22)]"
            : "border-slate-200 bg-white text-slate-500 group-hover:border-slate-300 group-hover:text-slate-700",
        ].join(" ")}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span>{label}</span>
    </Link>
  );
}

export function PortalShell({
  children,
  pathname,
}: {
  children: React.ReactNode;
  pathname: string;
}) {
  const resolvedNavItems = navItems.map((item) => ({
    ...item,
    active: isActivePath(pathname, item.href),
  }));
  const resolvedUtilityItems = utilityItems.map((item) => ({
    ...item,
    active: isActivePath(pathname, item.href),
  }));

  return (
    <div className="min-h-screen bg-[#f6f4ef]">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <PortalNavDrawer
          navItems={resolvedNavItems}
          utilityItems={resolvedUtilityItems}
        />

        <div className="mt-4 lg:mt-0 lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-6">
          <aside className="sticky top-6 hidden h-fit rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] lg:block">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Customer Portal
              </p>
            </div>

            <nav aria-label="Portal sidebar" className="mt-6 space-y-1">
              {resolvedNavItems.map((item) => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={item.active}
                />
              ))}
            </nav>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <div className="space-y-1">
                {resolvedUtilityItems.map((item) => (
                  <SidebarLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={item.active}
                  />
                ))}
              </div>

              <Link
                href="/book"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#c2410c] bg-[#f97316] px-4 py-3 text-sm font-semibold text-white transition hover:border-[#9a3412] hover:bg-[#ea580c]"
              >
                <PlusIcon className="h-4 w-4" />
                New booking
              </Link>
            </div>
          </aside>

          <main className="min-w-0 rounded-[30px] border border-slate-200 bg-white px-4 py-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
