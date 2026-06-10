import { Suspense } from "react";
import { AdminAuthCallbackClient } from "./admin-auth-callback-client";

export default function AdminAuthCallbackPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="w-full rounded-[32px] border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
              Admin access
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              Finishing admin sign-in
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Please wait while we verify your secure access link.
            </p>
          </div>
        }
      >
        <AdminAuthCallbackClient />
      </Suspense>
    </main>
  );
}
