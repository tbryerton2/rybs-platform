import { PlusIcon } from "@heroicons/react/24/outline";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";

function LoadingCard() {
  return <div className="h-32 animate-pulse rounded-[20px] border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60" />;
}

export default function Loading() {
  return (
    <AdminPage width="wide">
      <AdminPageHeader
        title="Trucks & Trailers"
        actions={(
          <button
            type="button"
            className="admin-btn admin-btn-primary h-11 gap-2 px-5"
          >
            <PlusIcon className="h-4 w-4" />
            Add truck or trailer
          </button>
        )}
      />
      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-3">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </section>

        <section className="rounded-[20px] bg-white px-6 pb-6 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-8 sm:pt-7">
          <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-5 h-12 animate-pulse rounded-[14px] bg-slate-100" />
        </section>

        <section className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)]">
          <div className="overflow-hidden rounded-[20px] bg-white shadow-xl ring-1 ring-slate-200/70">
            <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
              <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="space-y-4 px-6 py-6 sm:px-8">
              <div className="h-16 animate-pulse rounded-[14px] bg-slate-100" />
              <div className="h-16 animate-pulse rounded-[14px] bg-slate-100" />
              <div className="h-16 animate-pulse rounded-[14px] bg-slate-100" />
            </div>
          </div>

          <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-slate-100" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="h-24 animate-pulse rounded-[14px] bg-slate-100" />
              <div className="h-24 animate-pulse rounded-[14px] bg-slate-100" />
              <div className="h-24 animate-pulse rounded-[14px] bg-slate-100" />
              <div className="h-24 animate-pulse rounded-[14px] bg-slate-100" />
            </div>
          </div>
        </section>
      </div>
    </AdminPage>
  );
}
