"use client";

import Link from "next/link";
import { ArrowRightOnRectangleIcon, Bars3Icon } from "@heroicons/react/24/outline";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { adminNavGroups, getActiveAdminNavItem, isAdminNavItemActive } from "./admin-nav";
import {
  AdminSidebar,
  persistSidebarState,
  readStoredSidebarState,
  subscribeToSidebarState,
} from "./admin-sidebar";

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <div className="border-b border-slate-200 bg-white lg:hidden">
      <div className="px-4 pb-3 pt-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-900 p-2 text-white">
            <Bars3Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Tan Can Man
            </p>
            <div className="flex items-center gap-3">
              <p className="text-base font-semibold text-slate-900">Admin</p>
              <a
                href="/admin/logout"
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-slate-900"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                Sign out
              </a>
            </div>
          </div>
        </div>
      </div>

      <nav
        aria-label="Admin navigation"
        className="flex gap-2 overflow-x-auto px-4 pb-4 sm:px-6"
      >
        {adminNavGroups.flatMap((group) => group.items).map((item) => {
          const isActive = isAdminNavItemActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeItem = getActiveAdminNavItem(pathname);
  const showShellHeader =
    pathname !== "/admin" &&
    !pathname.startsWith("/admin/bookings") &&
    !pathname.startsWith("/admin/customers") &&
    !pathname.startsWith("/admin/docs") &&
    pathname !== "/admin/portal-requests" &&
    pathname !== "/admin/system" &&
    pathname !== "/admin/schedule" &&
    !pathname.startsWith("/admin/employees") &&
    pathname !== "/admin/financials" &&
    !pathname.startsWith("/admin/expenses") &&
    !pathname.startsWith("/admin/trucks-trailers") &&
    pathname !== "/admin/taxes" &&
    !pathname.startsWith("/admin/equipment") &&
    !pathname.startsWith("/admin/analytics") &&
    pathname !== "/admin/settings/pricing" &&
    !pathname.startsWith("/admin/settings/zips") &&
    pathname !== "/admin/settings/retail-site" &&
    !pathname.startsWith("/admin/cms");
  const sidebarCollapsed = useSyncExternalStore(
    subscribeToSidebarState,
    readStoredSidebarState,
    () => false,
  );

  function toggleSidebar() {
    persistSidebarState(!sidebarCollapsed);
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <MobileNav pathname={pathname} />

      <div className="w-full lg:px-5 lg:pb-6 lg:pt-6 xl:px-6 2xl:px-8">
        <AdminSidebar
          pathname={pathname}
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        />

        <div
          className={[
            "min-w-0 transition-[padding-left] duration-300",
            sidebarCollapsed ? "lg:pl-[108px] xl:pl-[116px]" : "lg:pl-[272px] xl:pl-[296px] 2xl:pl-[312px]",
          ].join(" ")}
        >
          <div className="min-w-0 px-4 sm:px-6 lg:px-7 xl:px-8 2xl:px-10">
            {showShellHeader ? (
              <div className="border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur sm:px-6 lg:rounded-[28px] lg:border lg:px-8 lg:py-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Tan Can Man Admin
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {activeItem?.label ?? "Admin"}
                    </p>
                  </div>
                  <a
                    href="/admin/logout"
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    Sign out
                  </a>
                </div>
              </div>
            ) : null}

            <main className="min-w-0">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
