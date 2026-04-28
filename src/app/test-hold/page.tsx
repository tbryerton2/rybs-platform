"use client";

import { useState } from "react";

type HoldTestResult = {
  status: number;
  json: unknown;
};

export default function TestHoldPage() {
  const [date, setDate] = useState("2026-02-21");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HoldTestResult | null>(null);
  const [error, setError] = useState<string>("");

  async function run() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryDate: date,
          dumpsterSize: "14 yard",
          dumpsterProductId: "default",
        }),
      });

      const json = await res.json().catch(() => ({}));
      setResult({ status: res.status, json });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-[#EEF2F7] text-[#0F172A]">
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-16">
        <div className="rounded-[32px] bg-white px-10 pb-12 pt-5 sm:px-12 sm:pt-8 shadow-xl ring-1 ring-slate-200/70">
          <div className="space-y-3">
            <div className="inline-flex w-fit items-center rounded-full bg-[#F97316]/10 px-4 py-1 text-xs font-semibold text-[#F97316]">
              Test
            </div>

            <h1 className="mt-2 text-3xl font-semibold text-[#0F172A]">
              /api/hold tester
            </h1>

            <p className="text-[#475569]">
              Posts <span className="font-semibold text-slate-900">deliveryDate</span> to{" "}
              <span className="font-semibold text-slate-900">/api/hold</span>.
            </p>
          </div>

          <section className="mt-8 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                deliveryDate (YYYY-MM-DD)
              </label>
              <input
                className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/15 transition"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="2026-02-21"
                inputMode="numeric"
              />
            </div>

            <button
              type="button"
              onClick={run}
              disabled={loading}
              className="group w-full h-14 rounded-2xl bg-[#F97316] text-white font-semibold text-base shadow-md transition-all duration-200 ease-out hover:bg-[#EA6A10] hover:shadow-lg active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="flex items-center justify-center gap-2">
                {loading ? "Posting..." : "POST /api/hold"}
                <span className="transition-transform group-hover:translate-x-1 text-white/90">
                  →
                </span>
              </span>
            </button>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                ❌ {error}
              </div>
            )}

            {result && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900 mb-2">
                  Response (status {result.status})
                </div>
                <pre className="text-xs sm:text-sm leading-relaxed overflow-auto whitespace-pre-wrap break-words text-slate-900">
{JSON.stringify(result.json, null, 2)}
                </pre>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
