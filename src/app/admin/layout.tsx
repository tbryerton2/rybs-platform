import { AdminToastProvider } from "./_components/admin/admin-toast-provider";
import { AdminShell } from "./_components/admin/admin-shell";
import { headers } from "next/headers";
import { AdminAccessDeniedError, requireAdminOwner } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getPathnameFromHeaders(headerStore: Awaited<ReturnType<typeof headers>>) {
  const explicitPath = headerStore.get("x-current-pathname");
  if (explicitPath) return explicitPath;

  const nextUrl = headerStore.get("next-url");
  if (!nextUrl) return "";

  try {
    return new URL(nextUrl, "http://localhost").pathname;
  } catch {
    return nextUrl.startsWith("/") ? nextUrl.split("?")[0] : "";
  }
}

function isPublicAdminAuthPath(pathname: string) {
  return (
    pathname === "/admin/login" ||
    pathname.startsWith("/admin/login/") ||
    pathname === "/admin/logout" ||
    pathname.startsWith("/admin/logout/") ||
    pathname === "/admin/auth/callback" ||
    pathname.startsWith("/admin/auth/callback/") ||
    pathname === "/admin/auth/session" ||
    pathname.startsWith("/admin/auth/session/")
  );
}

function AdminAccessDenied() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <section className="w-full rounded-[32px] border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          Admin access
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
          Access denied
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          You are signed in, but this account does not have active owner access for the current business.
        </p>
        <div className="mt-6">
          <a
            href="/admin/logout"
            className="inline-flex items-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Sign out
          </a>
        </div>
      </section>
    </main>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const pathname = getPathnameFromHeaders(headerStore);

  if (isPublicAdminAuthPath(pathname)) {
    return <>{children}</>;
  }

  try {
    await requireAdminOwner();
  } catch (error) {
    if (error instanceof AdminAccessDeniedError) {
      return <AdminAccessDenied />;
    }

    throw error;
  }

  return (
    <>
      <AdminToastProvider />
      <AdminShell>{children}</AdminShell>
    </>
  );
}
