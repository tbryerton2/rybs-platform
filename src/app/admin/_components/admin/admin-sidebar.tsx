"use client";

import Link from "next/link";
import { ArrowsRightLeftIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { AdminNavigation } from "./admin-navigation";

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
  businessName,
  canSwitchBusiness,
  collapsed,
  onToggle,
}: {
  pathname: string;
  businessName: string;
  canSwitchBusiness: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      id="admin-sidebar"
      className={[
        "fixed left-5 top-24 hidden h-[calc(100vh-8rem)] rounded-[20px] border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/70 shadow-[0_16px_34px_rgba(15,23,42,0.065)] transition-[width,left] duration-300 xl:flex xl:flex-col xl:left-6 2xl:left-8",
        collapsed ? "xl:w-[88px]" : "xl:w-[256px] 2xl:w-[272px]",
      ].join(" ")}
    >
      <div className={["border-b border-slate-200/80", collapsed ? "px-3 pb-3 pt-4" : "px-5 pb-[14px] pt-[18px]"].join(" ")}>
        <div className={["flex items-start", collapsed ? "justify-center" : "justify-between gap-3"].join(" ")}>
          <div className={collapsed ? "hidden" : "flex min-w-0 max-w-[12.5rem] flex-col items-start"}>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-[#F97316]/40 bg-orange-50 px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F97316] transition-colors hover:border-[#F97316]/60 hover:bg-orange-100 hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/50 focus-visible:ring-offset-2"
            >
              {businessName}
            </a>
            {canSwitchBusiness ? (
              <Link
                href="/admin/select-business"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900"
              >
                <ArrowsRightLeftIcon className="h-3.5 w-3.5" />
                Switch business
              </Link>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={[
              "admin-btn admin-btn-secondary admin-btn-icon h-[38px] min-h-[38px] w-[38px] min-w-[38px] shrink-0 shadow-sm",
              collapsed ? "mx-auto" : "",
            ].join(" ")}
          >
            {collapsed ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronLeftIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AdminNavigation pathname={pathname} collapsed={collapsed} />
    </aside>
  );
}
