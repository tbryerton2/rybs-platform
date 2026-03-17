"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { adminNavGroups, isAdminNavItemActive } from "./admin-nav";
import { AdminNavItem } from "./admin-nav-item";

const STORAGE_KEY = "admin_sidebar_collapsed";
const SIDEBAR_EVENT = "admin-sidebar-collapsed-change";

export function readStoredSidebarState() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

export function persistSidebarState(collapsed: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  window.dispatchEvent(new Event(SIDEBAR_EVENT));
}

export function subscribeToSidebarState(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const handler = () => onChange();

  window.addEventListener("storage", handler);
  window.addEventListener(SIDEBAR_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(SIDEBAR_EVENT, handler);
  };
}

export function AdminSidebar({
  pathname,
  collapsed,
  onToggle,
}: {
  pathname: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={[
        "fixed left-6 top-24 hidden h-[calc(100vh-8rem)] rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition-[width] duration-300 lg:flex lg:flex-col",
        collapsed ? "w-20" : "w-72",
      ].join(" ")}
    >
      <div className={["border-b border-slate-200", collapsed ? "px-3 pb-4 pt-5" : "px-5 pb-5 pt-6"].join(" ")}>
        <div className={["flex items-start", collapsed ? "justify-center" : "justify-between gap-3"].join(" ")}>
          <div className={collapsed ? "hidden" : "min-w-0"}>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Tan Can Man
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Admin</h1>
            <p className="mt-1 text-sm text-slate-500">
              Dispatch, bookings, customers, and system controls.
            </p>
          </div>

          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={[
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900",
              collapsed ? "mx-auto" : "",
            ].join(" ")}
          >
            {collapsed ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronLeftIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <nav
        aria-label="Admin sidebar"
        className={["flex-1 overflow-y-auto", collapsed ? "space-y-4 px-3 py-5" : "space-y-6 px-4 py-6"].join(" ")}
      >
        {adminNavGroups.map((group) => (
          <div key={group.label}>
            <p
              className={[
                "font-semibold uppercase tracking-[0.18em] text-slate-400 transition-opacity duration-200",
                collapsed ? "px-0 text-center text-[10px] opacity-0" : "px-3 text-[11px] opacity-100",
              ].join(" ")}
              aria-hidden={collapsed}
            >
              {group.label}
            </p>
            <div className={collapsed ? "mt-0 space-y-2" : "mt-2 space-y-1"}>
              {group.items.map((item) => (
                <AdminNavItem
                  key={item.href}
                  item={item}
                  isActive={isAdminNavItemActive(pathname, item)}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
