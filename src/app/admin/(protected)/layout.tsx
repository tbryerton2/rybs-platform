import { AdminShell } from "../_components/admin/admin-shell";
import { AdminToastProvider } from "../_components/admin/admin-toast-provider";
import {
  AdminAccessDeniedError,
  type AdminSessionContext,
  requireAdminOwner,
} from "@/lib/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function AdminAccessDenied({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <section className="w-full rounded-[20px] border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          Admin access
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
          Access denied
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {message}
        </p>
        <div className="mt-6">
          <a
            href="/admin/logout"
            className="admin-btn admin-btn-primary"
          >
            Sign out
          </a>
        </div>
      </section>
    </main>
  );
}

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let adminSession: AdminSessionContext;

  try {
    adminSession = await requireAdminOwner();
  } catch (error) {
    if (error instanceof AdminAccessDeniedError) {
      return <AdminAccessDenied message={error.message} />;
    }

    throw error;
  }

  return (
    <>
      <AdminToastProvider />
      <AdminShell businessName={adminSession.tenant.name}>{children}</AdminShell>
    </>
  );
}
