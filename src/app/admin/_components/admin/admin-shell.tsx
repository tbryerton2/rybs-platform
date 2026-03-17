"use client";

import Link from "next/link";
import { Bars3Icon } from "@heroicons/react/24/outline";
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
            <p className="text-base font-semibold text-slate-900">Admin</p>
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

      <div className="mx-auto max-w-[1720px] lg:px-6 lg:pb-6 lg:pt-6">
        <AdminSidebar
          pathname={pathname}
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        />

        <div
          className={[
            "min-w-0 transition-[padding-left] duration-300",
            sidebarCollapsed ? "lg:pl-[110px]" : "lg:pl-[318px]",
          ].join(" ")}
        >
          <div className="min-w-0">
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
                <p className="hidden text-sm text-slate-500 md:block">
                  Shared navigation shell for the operations workspace.
                </p>
              </div>
            </div>

            <main className="min-w-0">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
