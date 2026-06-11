"use client";

import { ArrowRightOnRectangleIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
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
        "fixed left-5 top-24 hidden h-[calc(100vh-8rem)] rounded-[30px] border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/70 shadow-[0_16px_34px_rgba(15,23,42,0.065)] transition-[width,left] duration-300 lg:flex lg:flex-col xl:left-6 2xl:left-8",
        collapsed ? "lg:w-[84px] xl:w-[88px]" : "lg:w-[232px] xl:w-[256px] 2xl:w-[272px]",
      ].join(" ")}
    >
      <div className={["border-b border-slate-200/80", collapsed ? "px-3 pb-3 pt-4" : "px-5 pb-[14px] pt-[18px]"].join(" ")}>
        <div className={["flex items-start", collapsed ? "justify-center" : "justify-between gap-3"].join(" ")}>
          <div className={collapsed ? "hidden" : "min-w-0 max-w-[12.5rem]"}>
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Tan Can Man
            </div>
            <h1 className="mt-2.5 text-[1.6rem] font-semibold tracking-tight text-slate-900">Admin</h1>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Dispatch, customers, website settings, and admin tools.
            </p>
            <a
              href="/admin/logout"
              target="_self"
              data-no-prefetch
              className="relative z-10 mt-3 inline-flex pointer-events-auto items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              Sign out
            </a>
          </div>

          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={[
              "inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/50 focus-visible:ring-offset-2",
              collapsed ? "mx-auto" : "",
            ].join(" ")}
          >
            {collapsed ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronLeftIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <nav
        aria-label="Admin sidebar"
        className={["flex-1 overflow-y-auto", collapsed ? "space-y-2.5 px-3 py-3.5" : "space-y-3.5 px-4 py-4"].join(" ")}
      >
        {adminNavGroups.map((group) => (
          <div key={group.label} className="rounded-[22px]">
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
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
