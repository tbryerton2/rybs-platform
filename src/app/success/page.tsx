// src/app/success/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";

export default function SuccessPage() {
  const params = useSearchParams();
  const router = useRouter();

  const bookingId = params.get("bookingId");

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-[#EEF2F7] text-[#0F172A]">
      <div className="mx-auto max-w-2xl px-6 pt-16 pb-20">
        <div className="rounded-[32px] bg-white px-10 py-12 shadow-xl ring-1 ring-slate-200/70 text-center">
          
          {/* Success Icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <span className="text-2xl">✅</span>
          </div>

          <h1 className="text-3xl font-semibold text-[#0F172A]">
            Booking Confirmed
          </h1>

          <p className="mt-3 text-[#475569]">
            Your dumpster has been successfully reserved.
          </p>

          {bookingId && (
            <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
              Booking ID:{" "}
              <span className="font-semibold text-slate-900">
                {bookingId}
              </span>
            </div>
          )}

          <p className="mt-6 text-sm text-slate-600">
            You’ll receive a confirmation email shortly with your delivery details.
          </p>

          <div className="mt-8">
            <button
              onClick={() => router.push("/")}
              className="h-12 rounded-2xl bg-[#F97316] px-6 font-semibold text-white shadow-sm transition hover:bg-[#EA580C] active:scale-[0.99]"
            >
              Return to homepage
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}