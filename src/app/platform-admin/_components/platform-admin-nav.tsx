"use client";

import {
  BuildingOffice2Icon,
  Squares2X2Icon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname } from "next/navigation";

type PlatformAdminNavItem = {
  label: string;
  href: string;
  icon: typeof Squares2X2Icon;
  exact?: boolean;
};

const navItems: PlatformAdminNavItem[] = [
  { label: "Dashboard", href: "/platform-admin", icon: Squares2X2Icon, exact: true },
  { label: "Businesses", href: "/platform-admin/businesses", icon: BuildingOffice2Icon },
  { label: "Users", href: "/platform-admin/users", icon: UsersIcon },
];

function isActivePath(pathname: string, item: PlatformAdminNavItem) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function PlatformAdminNav({
  currentPath,
  variant,
}: {
  currentPath: string;
  variant: "desktop" | "mobile";
}) {
  const pathname = usePathname() || currentPath;
  const isMobile = variant === "mobile";

  return (
    <nav
      className={isMobile ? "mt-3 grid grid-cols-3 gap-2" : "flex-1 space-y-1 px-3 py-4"}
      aria-label="Platform admin navigation"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = isActivePath(pathname, item);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={[
              isMobile
                ? "flex items-center justify-center gap-2 rounded-[8px] px-3 py-2 text-sm font-semibold transition"
                : "flex items-center gap-3 rounded-[8px] px-3 py-2 text-sm font-semibold transition",
              isActive
                ? "bg-white text-slate-950 ring-2 ring-blue-600 shadow-sm"
                : isMobile
                  ? "text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            ].join(" ")}
          >
            <Icon
              className={isMobile ? "h-4 w-4 text-slate-500" : "h-5 w-5 text-slate-500"}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
