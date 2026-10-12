import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import type { PlatformAdminSessionContext } from "@/lib/platform-admin/auth";
import { PlatformAdminNav } from "./platform-admin-nav";

function roleLabel(role: PlatformAdminSessionContext["membership"]["role"]) {
  return role === "owner" ? "Owner" : "Admin";
}

export function PlatformAdminShell({
  children,
  session,
  currentPath,
}: {
  children: React.ReactNode;
  session: PlatformAdminSessionContext;
  currentPath: string;
}) {
  const userLabel = session.user.email ?? session.user.id;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold tracking-tight">Platform Admin</div>
            <div className="truncate text-xs text-slate-500">{userLabel}</div>
          </div>
          <a href="/platform-admin/logout" className="admin-btn admin-btn-secondary admin-btn-sm">
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            Logout
          </a>
        </div>
        <PlatformAdminNav currentPath={currentPath} variant="mobile" />
      </header>

      <div className="lg:grid lg:min-h-screen lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <PlatformAdminNav currentPath={currentPath} variant="desktop" />

          <div className="border-t border-slate-200 p-4">
            <div className="rounded-[12px] bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="truncate text-sm font-semibold text-slate-900">{userLabel}</div>
              <div className="mt-1 inline-flex rounded-[4px] bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {roleLabel(session.membership.role)}
              </div>
            </div>
            <a href="/platform-admin/logout" className="admin-btn admin-btn-secondary mt-3 w-full">
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              Logout
            </a>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
