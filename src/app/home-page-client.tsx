"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { LoadingButton } from "@/components/ui/loading-button";

type HomePageClientProps = {
  previewMode?: boolean;
  heroContent: {
    eyebrow: string | null;
    headlineLine1: string;
    headlineLine2: string | null;
    subheadline: string;
    imageAlt: string;
    availabilityHelper: string;
    trustItems: string[];
  };
  serviceAreaContent: {
    modalTitle: string;
    modalIntro: string;
    coverageHeading: string;
    regionList: string[];
    coverageFootnote: string;
    unsupportedZipMessage: string;
    viewServiceAreaLabel: string;
    closeLabel: string;
  };
  homeSectionsContent: Array<
    | {
        id: string;
        type: "card_grid";
        caption: string;
        sectionTitle: string;
        intro: string;
        items: Array<{
          label: string;
          headline: string;
          body: string;
        }>;
      }
    | {
        id: string;
        type: "steps";
        caption: string;
        sectionTitle: string;
        intro: string;
        items: Array<{
          label: string;
          title: string;
          body: string;
        }>;
        footnote: string;
      }
  >;
  faqContent: {
    headline: string;
    intro: string;
    items: Array<{
      question: string;
      answer: string;
    }>;
  };
  supportMarketingContent: {
    headline: string;
    body: string;
  };
  visibilitySettings: {
    showServiceAreaPopup: boolean;
    showFaq: boolean;
  };
};

export default function HomePageClient({
  previewMode = false,
  heroContent,
  serviceAreaContent,
  homeSectionsContent,
  faqContent,
  supportMarketingContent,
  visibilitySettings,
}: HomePageClientProps) {
  const [zipUnsupported, setZipUnsupported] = useState(false);
  const [serviceAreaOpen, setServiceAreaOpen] = useState(false);
  const [highlightError, setHighlightError] = useState(false);
  const router = useRouter();
  const [zip, setZip] = useState("");
  const zipErrorRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [scrollToZipErrorTick, setScrollToZipErrorTick] = useState(0);
  const [openFaqItems, setOpenFaqItems] = useState<Set<number>>(() => new Set());

  function toggleFaq(index: number) {
    setOpenFaqItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  useEffect(() => {
    if (!highlightError) return;

    const timeout = setTimeout(() => setHighlightError(false), 1200);
    return () => clearTimeout(timeout);
  }, [highlightError]);

  useEffect(() => {
    if (!zipUnsupported) return;

    requestAnimationFrame(() => {
      zipErrorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [scrollToZipErrorTick, zipUnsupported]);

  const zipDigits = useMemo(() => zip.replace(/\D/g, "").slice(0, 5), [zip]);
  const zipValid = zipDigits.length === 5;

  async function parseJsonResponse(res: Response) {
    const raw = await res.text().catch(() => "");
    if (!raw) return null;

    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  function buildPricingHref(zipValue: string) {
    if (!/^\d{5}$/.test(zipValue)) return null;

    const params = new URLSearchParams({ zip: zipValue });
    const query = params.toString();
    return query ? `/pricing?${query}` : null;
  }

  const checkAvailability = async () => {
    if (!zipValid) {
      return;
    }

    try {
      const res = await fetch("/api/check-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip: zipDigits }),
      });

      const data = await parseJsonResponse(res);
      const isServiceable = data?.serviceable === true;

      if (!res.ok || !isServiceable) {
        nudgeZipUnsupported();
        return;
      }

      const nextHref = buildPricingHref(zipDigits);
      if (!nextHref) {
        nudgeZipUnsupported();
        return;
      }

      setZipUnsupported(false);
      setLoading(false);

      try {
        router.push(nextHref);
      } catch {
        window.location.assign(nextHref);
      }
    } catch {
      nudgeZipUnsupported();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

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
    setScrollToZipErrorTick((n) => n + 1);
  }

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#0F172A]">
      {previewMode ? (
        <section className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 text-sm text-amber-900">
            <span>Preview mode is on. You are viewing draft retail-site content.</span>
            <a
              href="/admin/cms/preview?mode=exit&redirect=/"
              className="font-semibold underline decoration-amber-400 underline-offset-4"
            >
              Exit Preview
            </a>
          </div>
        </section>
      ) : null}
      <section className="bg-[#f5f4f0]">
        <div className="mx-auto flex min-h-[360px] max-w-6xl items-center gap-12 px-6 py-10 lg:py-0">
          <div className="flex-1">
            <div className="w-full">
              {heroContent.eyebrow ? (
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[#F97316]">
                  {heroContent.eyebrow}
                </div>
              ) : null}
              <h1 className="text-3xl font-semibold leading-[1.1] tracking-tight text-[#0F172A] sm:text-4xl lg:text-5xl">
                {heroContent.headlineLine2 ? (
                  <>
                    <span className="block">{heroContent.headlineLine1}</span>
                    <span className="block">{heroContent.headlineLine2}</span>
                  </>
                ) : (
                  heroContent.headlineLine1
                )}
              </h1>
              <p className="mt-4 max-w-2xl text-xl font-medium leading-relaxed text-[#0F172A]/80">
                {heroContent.subheadline}
              </p>

              <div className="mt-8 flex flex-col gap-3">
                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center"
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
                    className="h-12 flex-1 rounded-lg border-[1.5px] border-[#c0b9ae] bg-white px-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-[#F97316]/40"
                  />

                  <LoadingButton
                    type="submit"
                    loading={loading}
                    loadingLabel="Checking..."
                    disabled={!zipValid}
                    className="h-12 rounded-2xl bg-[#F97316] px-6 font-semibold text-white shadow-sm transition hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]"
                  >
                    Check Availability
                  </LoadingButton>
                </form>
                {zipUnsupported ? (
                  <div
                    ref={zipErrorRef}
                    className={`mt-4 rounded-2xl px-4 py-3 text-sm shadow-sm transition-all duration-500 ${
                      highlightError
                        ? "border-2 border-[#F97316] bg-[#FFF7ED]"
                        : "border border-slate-200 bg-white"
                    }`}
                  >
                    <div>
                      {serviceAreaContent.unsupportedZipMessage}{" "}
                      <span className="font-semibold">{zipDigits}</span>.
                    </div>

                    {visibilitySettings.showServiceAreaPopup ? (
                      <button
                        type="button"
                        onClick={() => setServiceAreaOpen(true)}
                        className="mt-1.5 inline-flex items-center font-medium text-[#F97316] hover:text-[#EA580C]"
                      >
                        {serviceAreaContent.viewServiceAreaLabel} <span className="ml-1">→</span>
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {serviceAreaOpen && visibilitySettings.showServiceAreaPopup ? (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label={serviceAreaContent.modalTitle}
                    onClick={() => setServiceAreaOpen(false)}
                  >
                    <div className="absolute inset-0 bg-black/40" />

                    <div
                      className="relative z-10 w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            {serviceAreaContent.modalTitle}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {serviceAreaContent.modalIntro}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">
                          {serviceAreaContent.coverageHeading}
                        </div>

                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          {serviceAreaContent.regionList.map((region) => (
                            <li key={region}>• {region}</li>
                          ))}
                        </ul>

                        <p className="mt-3 text-xs text-slate-500">
                          {serviceAreaContent.coverageFootnote}
                        </p>
                      </div>

                      <div className="mt-6 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setServiceAreaOpen(false)}
                          className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#F97316] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#EA580C]"
                        >
                          {serviceAreaContent.closeLabel}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <p className="text-sm text-[#475569]">
                  {heroContent.availabilityHelper}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#475569]">
                {heroContent.trustItems.map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#F97316]" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden w-[42%] shrink-0 overflow-hidden rounded-[10px] lg:block" style={{ height: "280px" }}>
            <img
              src="/hero-dumpster.png"
              alt={heroContent.imageAlt}
              className="h-full w-full object-cover object-center"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-16 px-6 pb-24 pt-10 md:pt-12">
        {homeSectionsContent.map((section) => {
          const sectionCaption = section.caption.trim();

          if (section.type === "card_grid") {
            return (
              <section key={section.id}>
                <div className="flex items-end justify-between gap-6">
                  <div>
                    {sectionCaption ? (
                      <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#F97316]">
                        {sectionCaption}
                      </div>
                    ) : null}
                    <h2 className="text-2xl font-semibold text-[#0F172A]">
                      {section.sectionTitle}
                    </h2>
                    <p className="mt-2 text-[#475569]">{section.intro}</p>
                  </div>
                </div>

                <div className="mt-8 grid gap-6 md:grid-cols-3">
                  {section.items.map((item) => (
                    <div key={`${item.label}-${item.headline}`} className="rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                      <div className="text-sm font-semibold text-[#F97316]">{item.label}</div>
                      <div className="mt-2 text-lg font-semibold text-[#0F172A]">{item.headline}</div>
                      <p className="mt-2 text-sm leading-relaxed text-[#475569]">{item.body}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          return (
            <section key={section.id}>
              {sectionCaption ? (
                <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#F97316]">
                  {sectionCaption}
                </div>
              ) : null}
              <h2 className="text-2xl font-semibold text-[#0F172A]">
                {section.sectionTitle}
              </h2>
              <p className="mt-2 text-[#475569]">{section.intro}</p>

              <div className="mt-8 grid gap-6 md:grid-cols-3">
                {section.items.map((item) => (
                  <div key={`${item.label}-${item.title}`} className="rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="text-sm font-semibold text-[#F97316]">{item.label}</div>
                    <div className="mt-2 text-lg font-semibold text-[#0F172A]">{item.title}</div>
                    <p className="mt-2 text-sm leading-relaxed text-[#475569]">{item.body}</p>
                  </div>
                ))}
              </div>

              {section.footnote ? (
                <p className="mt-6 text-sm text-[#475569]">{section.footnote}</p>
              ) : null}
            </section>
          );
        })}

        {visibilitySettings.showFaq ? (
          <section>
            <h2 className="text-2xl font-semibold text-[#0F172A]">{faqContent.headline}</h2>
            <p className="mt-2 text-[#475569]">{faqContent.intro}</p>

            {(() => {
              const half = Math.ceil(faqContent.items.length / 2);
              const columns = [
                faqContent.items.slice(0, half),
                faqContent.items.slice(half),
              ];
              return (
                <div className="mt-8 grid gap-4 lg:grid-cols-2">
                  {columns.map((col, colIdx) => (
                    <div key={colIdx} className="flex flex-col gap-4">
                      {col.map((item, rowIdx) => {
                        const index = colIdx === 0 ? rowIdx : half + rowIdx;
                        const isOpen = openFaqItems.has(index);
                        return (
                          <div key={item.question} className="rounded-[20px] bg-white shadow-sm ring-1 ring-slate-200">
                            <button
                              type="button"
                              onClick={() => toggleFaq(index)}
                              className="flex w-full items-center gap-3 p-6 text-left"
                            >
                              <QuestionMarkCircleIcon className="h-5 w-5 shrink-0 text-[#F97316]" />
                              <span className="flex-1 font-semibold text-[#0F172A]">{item.question}</span>
                              <ChevronDownIcon
                                className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
                                  isOpen ? "rotate-180 text-[#f07d3a]" : "text-slate-400"
                                }`}
                              />
                            </button>
                            {isOpen ? (
                              <div className="px-6 pb-6 pt-0">
                                <p className="text-sm leading-relaxed text-[#475569]">{item.answer}</p>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })()}
          </section>
        ) : null}

        <section className="mt-16">
          <div className="rounded-xl border border-[#d6d0c8] bg-[#ede8e0] p-8 md:p-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-[#111] md:text-3xl">
                  {supportMarketingContent.headline}
                </h2>
                <p className="mt-2 max-w-2xl text-[#666]">
                  {supportMarketingContent.body}
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
                  className="h-12 w-full rounded-2xl border border-[#c0b9ae] bg-white px-4 text-[#0F172A] outline-none transition focus:ring-2 focus:ring-[#f07d3a]/40 sm:w-56"
                />

                <LoadingButton
                  type="submit"
                  loading={loading}
                  loadingLabel="Checking..."
                  disabled={!zipValid}
                  className="h-12 w-full min-w-[200px] rounded-2xl bg-[#f07d3a] px-7 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e06a28] focus:outline-none focus:ring-4 focus:ring-[#f07d3a]/30 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99] sm:w-auto"
                >
                  Check Availability
                </LoadingButton>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
