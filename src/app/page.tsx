"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export default function HomePage() {
  const [zipUnsupported, setZipUnsupported] = useState(false);
  const [serviceAreaOpen, setServiceAreaOpen] = useState(false);
  const [highlightError, setHighlightError] = useState(false);
  const router = useRouter();
  const [zip, setZip] = useState("");
  const zipErrorRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [scrollToZipErrorTick, setScrollToZipErrorTick] = useState(0);

  useEffect(() => {
    if (!highlightError) return;

    const timeout = setTimeout(() => setHighlightError(false), 1200);
    return () => clearTimeout(timeout);
  }, [highlightError]);

  useEffect(() => {
    if (!zipUnsupported) return;

    // Try immediately after render
    requestAnimationFrame(() => {
      zipErrorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [scrollToZipErrorTick, zipUnsupported]);

  const zipDigits = useMemo(() => zip.replace(/\D/g, "").slice(0, 5), [zip]);
  const zipValid = zipDigits.length === 5;

  const checkAvailability = async () => {
    if (!zipValid) {
      setLoading(false); // safety
      return;
    }

    const res = await fetch("/api/check-zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zip: zipDigits }),
    });

    const data = await res.json();

    if (!data.serviceable) {
      setLoading(false);
      nudgeZipUnsupported();
      return;
    }

    setZipUnsupported(false);

    router.push(`/pricing?zip=${zipDigits}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // If the error is already showing, clicking again should still scroll + highlight.
    if (zipUnsupported) {
      nudgeZipUnsupported();
      return;
    }

    setLoading(true);
    await checkAvailability();
  };

  function nudgeZipUnsupported() {
    setZipUnsupported(true);
    setHighlightError(true);

    // Trigger a "scroll request" that will run after the DOM renders the error box
    setScrollToZipErrorTick((n) => n + 1);
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">

      {/* Hero */}
      <section className="bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-6 pt-12 pb-16 md:pt-16 md:pb-20">
          <div className="grid items-start gap-12 lg:grid-cols-2">
            
            {/* LEFT SIDE */}
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-[#0F172A] leading-[1.1]">
                Dumpster Rentals Made Easy
              </h1>
              <p className="mt-4 text-xl font-medium text-[#0F172A]/80 leading-relaxed max-w-2xl">
                Proudly serving Central New York with fast delivery and honest pricing.
              </p>

              <div className="mt-8 flex flex-col gap-3">
                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-gray-200"
                >
                  <input
                    inputMode="numeric"
                    autoComplete="postal-code"
                    id="zip-input"
                    value={zipDigits}
                    onChange={(e) => {
                      setZip(e.target.value);
                      setZipUnsupported(false);
                    }}
                    placeholder="Enter ZIP code"
                    className="h-12 flex-1 rounded-2xl border border-transparent bg-gray-50 px-4 text-[#0F172A] shadow-inner outline-none focus:bg-white focus:ring-2 focus:ring-[#F97316]/20"
                  />

                  <button
                    type="submit"
                    disabled={!zipValid || loading}
                    className="h-12 rounded-2xl bg-[#F97316] px-6 font-semibold text-white transition hover:bg-[#EA580C] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                  >
                    {loading ? "Checking..." : "Check Availability"}
                  </button>
                </form>
                {zipUnsupported && (
                <div
  ref={zipErrorRef}
  className={`mt-4 rounded-2xl px-4 py-3 text-sm shadow-sm transition-all duration-500 ${
    highlightError
      ? "border-2 border-[#F97316] bg-[#FFF7ED]"
      : "border border-slate-200 bg-white"
  }`}
>
                  <div>
                    We don’t currently serve ZIP <span className="font-semibold">{zipDigits}</span>.
                  </div>

                  <button
                    type="button"
                    onClick={() => setServiceAreaOpen(true)}
                    className="mt-1.5 inline-flex items-center font-medium text-[#F97316] hover:text-[#EA580C]"
                  >
                    View service area <span className="ml-1">→</span>
                  </button>
                </div>
              )}

                {serviceAreaOpen && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Service area"
                    onClick={() => setServiceAreaOpen(false)}
                  >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/40" />

                    {/* Modal */}
                    <div
                      className="relative z-10 w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">Service area</h3>
                          <p className="mt-1 text-sm text-slate-600">
                            We serve select areas in Central New York.
                          </p>
                        </div>

                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">Currently covered</div>

                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          <li>• Syracuse + surrounding suburbs</li>
                          <li>• Clay, Cicero, Liverpool</li>
                          <li>• Fayetteville, Manlius, DeWitt</li>
                          <li>• Baldwinsville, North Syracuse</li>
                        </ul>

                        <p className="mt-3 text-xs text-slate-500">
                          We’re expanding coverage. More areas coming soon.
                        </p>
                      </div>

                      <div className="mt-6 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setServiceAreaOpen(false)}
                          className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#F97316] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#EA580C]"
                        >
                          Got it
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-sm text-[#475569]">
                  Get instant pricing and availability in your area.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#475569]">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#F97316]" />
                  Locally owned
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#F97316]" />
                  Fully insured
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#F97316]" />
                  Upfront pricing
                </span>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="lg:mt-8">
              <div className="overflow-hidden rounded-3xl shadow-lg">
                <img
                  src="/hero-dumpster.png"
                  alt="Clean roll-off dumpster delivery in Central New York"
                  className="h-[260px] w-full object-cover sm:h-[320px] lg:h-[420px]"
                />
              </div>
            </div>

          </div>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-6 space-y-16 pb-24">

        {/* Why choose */}
        <section>
          <div className="flex items-end justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold text-[#0F172A]">
                Why choose Tan Can Man?
              </h2>
              <p className="mt-2 text-[#475569]">
                Simple pricing, reliable delivery, and easy online booking.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-[#F97316]">Upfront pricing</div>
              <div className="mt-2 text-lg font-semibold text-[#0F172A]">Flat-rate, no surprises</div>
              <p className="mt-2 text-sm text-[#475569] leading-relaxed">
                Know your total cost up front. No surprise fees or confusing add-ons.
              </p>
            </div>

            <div className="rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-[#F97316]">Reliable service</div>
              <div className="mt-2 text-lg font-semibold text-[#0F172A]">On-time delivery & pickup</div>
              <p className="mt-2 text-sm text-[#475569] leading-relaxed">
                We show up when we say we will—and make pickup just as easy.
              </p>
            </div>

            <div className="rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-[#F97316]">Local & trusted</div>
              <div className="mt-2 text-lg font-semibold text-[#0F172A]">Proudly Central New York</div>
              <p className="mt-2 text-sm text-[#475569] leading-relaxed">
                Locally owned and operated, focused on dependable service and straightforward pricing.
              </p>
            </div>
          </div>
        </section>

        

        {/* How it works */}
        <section>
          <h2 className="text-2xl font-semibold text-[#0F172A]">How it works</h2>
          <p className="mt-2 text-[#475569]">
            Simple from delivery to pickup — we’ll keep it easy.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-[#F97316]">Step 1</div>
              <div className="mt-2 text-lg font-semibold text-[#0F172A]">Pick your delivery date</div>
              <p className="mt-2 text-sm text-[#475569] leading-relaxed">
                Choose a date that works for your project — we’ll confirm quickly.
              </p>
            </div>

            <div className="rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-[#F97316]">Step 2</div>
              <div className="mt-2 text-lg font-semibold text-[#0F172A]">We drop it where you want it</div>
              <p className="mt-2 text-sm text-[#475569] leading-relaxed">
                Driveway placement notes supported — we’ll place it safely and neatly.
              </p>
            </div>

            <div className="rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-[#F97316]">Step 3</div>
              <div className="mt-2 text-lg font-semibold text-[#0F172A]">Fill it, then request pickup</div>
              <p className="mt-2 text-sm text-[#475569] leading-relaxed">
                When you’re ready, request pickup and we’ll haul it away.
              </p>
            </div>
          </div>

          <p className="mt-6 text-sm text-[#475569]">
            Includes up to 3 tons. Overages billed only if exceeded.
          </p>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-2xl font-semibold text-[#0F172A]">FAQs</h2>
          <p className="mt-2 text-[#475569]">
            Quick answers to the most common questions.
          </p>

          <div className="mt-8 grid gap-4">
            <details className="group rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <summary className="cursor-pointer list-none font-semibold text-[#0F172A] flex items-center justify-between">
                <span>What’s included in the flat-rate price?</span>
                <span className="text-[#F97316] group-open:rotate-180 transition">⌄</span>
              </summary>
              <p className="mt-3 text-sm text-[#475569] leading-relaxed">
                Delivery, pickup, and your included weight allowance are all covered. If you exceed the included tonnage,
                we only charge the overage — no surprise fees.
              </p>
            </details>

            <details className="group rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <summary className="cursor-pointer list-none font-semibold text-[#0F172A] flex items-center justify-between">
                <span>How long can I keep the dumpster?</span>
                <span className="text-[#F97316] group-open:rotate-180 transition">⌄</span>
              </summary>
              <p className="mt-3 text-sm text-[#475569] leading-relaxed">
                Most rentals include a standard rental period (we’ll confirm when you book). If you need extra time,
                just text us — extensions are easy.
              </p>
            </details>

            <details className="group rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <summary className="cursor-pointer list-none font-semibold text-[#0F172A] flex items-center justify-between">
                <span>Where can you place the dumpster?</span>
                <span className="text-[#F97316] group-open:rotate-180 transition">⌄</span>
              </summary>
              <p className="mt-3 text-sm text-[#475569] leading-relaxed">
                Driveways are most common. If placement on a street is needed, permits may be required depending on the town.
                We’ll help you confirm what’s needed.
              </p>
            </details>

            <details className="group rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <summary className="cursor-pointer list-none font-semibold text-[#0F172A] flex items-center justify-between">
                <span>What items are not allowed?</span>
                <span className="text-[#F97316] group-open:rotate-180 transition">⌄</span>
              </summary>
              <p className="mt-3 text-sm text-[#475569] leading-relaxed">
                Common restricted items include tires, batteries, paint, chemicals, and certain electronics.
                If you’re unsure, text us a photo or list and we’ll confirm quickly.
              </p>
            </details>

            <details className="group rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <summary className="cursor-pointer list-none font-semibold text-[#0F172A] flex items-center justify-between">
                <span>How fast can you deliver?</span>
                <span className="text-[#F97316] group-open:rotate-180 transition">⌄</span>
              </summary>
              <p className="mt-3 text-sm text-[#475569] leading-relaxed">
                Often next-day delivery is available, and sometimes same-day depending on schedule.
                Enter your ZIP code or call/text and we’ll confirm the soonest option.
              </p>
            </details>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-16 -mx-6 bg-slate-50 py-10 px-6">
          <div className="w-full rounded-[28px] bg-white p-8 md:p-10 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
                  Ready to book your dumpster?
                </h2>
                <p className="mt-2 max-w-2xl text-slate-600">
                  Check availability in your area — fast delivery, honest pricing, and friendly local support.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center"
              >
                <input
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={zipDigits}
                  onChange={(e) => {
                    setZip(e.target.value);
                    setZipUnsupported(false);
                  }}
                  placeholder="Enter ZIP code"
                  className="h-12 w-full rounded-2xl border border-transparent bg-white px-4 text-[#0F172A] shadow-sm ring-1 ring-slate-200 outline-none transition focus:ring-4 focus:ring-[#F97316]/20 sm:w-56"
                />

                <button
                  type="submit"
                  disabled={!zipValid || loading}
                  className="h-12 w-full min-w-[200px] rounded-2xl bg-[#F97316] px-7 text-sm font-semibold text-white shadow-sm transition hover:bg-[#EA580C] hover:shadow-md active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-[#F97316]/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {loading ? "Checking..." : "Check Availability"}
                </button>

              </form>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}