"use client";

export function EmptyState() {
  return (
    <div className="rounded-[14px] border border-dashed border-slate-300 bg-white p-10 text-center">
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
        className="admin-btn admin-btn-primary mt-6"
      >
        Add ZIP
      </button>
    </div>
  );
}
