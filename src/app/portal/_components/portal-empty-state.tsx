import Link from "next/link";

export function PortalEmptyState() {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <h2 className="text-xl font-semibold text-slate-900">No active rental right now</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
        When you make a booking, your live rental status, next step, and self-service actions will
        appear here.
      </p>
      <div className="mt-6">
        <Link
          href="/pricing"
          className="inline-flex items-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          View dumpster pricing
        </Link>
      </div>
    </div>
  );
}
