"use client";

import { adminNavGroups, isAdminNavItemActive } from "./admin-nav";
import { AdminNavItem } from "./admin-nav-item";

// Both layouts use the same filtered groups, matching rules, and link renderer.
export function AdminNavigation({
  pathname,
  collapsed = false,
  onNavigate,
}: {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav
      aria-label="Admin navigation"
      className={["min-h-0 flex-1 overflow-y-auto overscroll-contain", collapsed ? "space-y-2.5 px-3 py-3.5" : "space-y-3.5 px-4 py-4"].join(" ")}
    >
      {adminNavGroups.map((group) => (
        <div key={group.label} className="rounded-[14px]">
          <p
            className={[
              "font-semibold uppercase tracking-[0.16em] text-slate-400 transition-opacity duration-200",
              collapsed ? "px-0 text-center text-[10px] opacity-0" : "px-3 pb-0.5 text-[10px] opacity-100",
            ].join(" ")}
            aria-hidden={collapsed}
          >
            {group.label}
          </p>
          <div className={collapsed ? "mt-0 space-y-1" : "mt-0.5 space-y-0.5"}>
            {group.items.map((item) => (
              <AdminNavItem
                key={item.href}
                item={item}
                isActive={isAdminNavItemActive(pathname, item)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
