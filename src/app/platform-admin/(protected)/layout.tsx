import { PlatformAdminShell } from "../_components/platform-admin-shell";
import { headers } from "next/headers";
import {
  PlatformAdminAccessDeniedError,
  type PlatformAdminSessionContext,
  requirePlatformAdmin,
} from "@/lib/platform-admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function PlatformAdminAccessDenied() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <section className="w-full rounded-[20px] border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          Platform access
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
          Access denied
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          You are signed in, but this account does not have active platform owner or admin access.
        </p>
        <div className="mt-6">
          <a href="/platform-admin/logout" className="admin-btn admin-btn-primary">
            Sign out
          </a>
        </div>
      </section>
    </main>
  );
}

export default async function ProtectedPlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session: PlatformAdminSessionContext;

  try {
    session = await requirePlatformAdmin();
  } catch (error) {
    if (error instanceof PlatformAdminAccessDeniedError) {
      return <PlatformAdminAccessDenied />;
    }

    throw error;
  }

  const currentPath = (await headers()).get("x-current-pathname") ?? "/platform-admin";

  return (
    <PlatformAdminShell session={session} currentPath={currentPath}>
      {children}
    </PlatformAdminShell>
  );
}
