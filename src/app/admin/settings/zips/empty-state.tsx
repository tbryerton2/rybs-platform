"use client";

export function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="text-base font-semibold text-slate-900">
        No service area yet
      </div>

      <p className="mt-2 text-sm text-slate-500">
        Add the first ZIP code to start accepting bookings.
      </p>

      <button
        type="button"
        onClick={() => {
          const input = document.getElementById("zip");
          input?.focus();
        }}
        className="mt-6 inline-flex items-center rounded-2xl bg-[#F97316] px-4 py-2 text-sm font-medium text-white transition hover:opacity-95"
      >
        Add ZIP code
      </button>
    </div>
  );
}