import Link from "next/link";

type PortalNavItem = {
  href: string;
  label: string;
};

const navItems: PortalNavItem[] = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/account", label: "Account" },
];

export function PortalShell({
  children,
  pathname,
}: {
  children: React.ReactNode;
  pathname: string;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full bg-[#F97316]/10 px-3 py-1 text-xs font-semibold text-[#F97316]">
                Customer Portal
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                Manage your rental
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Track progress, request help, and stay on top of what happens next.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/portal"
                    ? pathname === "/portal"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <Link
                href="/portal/logout"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                Sign out
              </Link>
            </div>
          </div>
        </div>

        <div className="px-5 py-6 sm:px-8">{children}</div>
      </div>
    </div>
  );
}
