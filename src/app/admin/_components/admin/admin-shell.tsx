"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { getActiveAdminNavItem } from "./admin-nav";
import { AdminMobileNav } from "./admin-mobile-nav";
import {
  AdminSidebar,
  persistSidebarState,
  readStoredSidebarState,
  subscribeToSidebarState,
} from "./admin-sidebar";

export function AdminShell({
  children,
  businessName,
  canSwitchBusiness = false,
}: {
  children: React.ReactNode;
  businessName: string;
  canSwitchBusiness?: boolean;
}) {
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
    pathname !== "/admin/settings/payments" &&
    pathname !== "/admin/settings/users" &&
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
      <AdminMobileNav
        pathname={pathname}
        businessName={businessName}
        canSwitchBusiness={canSwitchBusiness}
      />

      <div className="w-full xl:pb-6 xl:pt-6 xl:px-6 2xl:px-8">
        <AdminSidebar
          pathname={pathname}
          businessName={businessName}
          canSwitchBusiness={canSwitchBusiness}
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        />

        <div
          className={[
            "min-w-0 transition-[padding-left] duration-300",
            sidebarCollapsed ? "xl:pl-[116px]" : "xl:pl-[296px] 2xl:pl-[312px]",
          ].join(" ")}
        >
          <div className="min-w-0 px-4 sm:px-6 lg:px-7 xl:px-8 2xl:px-10">
            {showShellHeader ? (
              <div className="border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur sm:px-6 lg:rounded-[20px] lg:border lg:px-8 lg:py-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {businessName} Admin
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {activeItem?.label ?? "Admin"}
                    </p>
                  </div>
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
