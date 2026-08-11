"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { LoadingButton } from "@/components/ui/loading-button";
import { HomeStatsIcon, type HomeStatsIconKey } from "@/lib/home-stats-icons";

type HomePageClientProps = {
  previewMode?: boolean;
  heroContent: {
    eyebrow: string | null;
    headlineLine1: string;
    headlineLine2: string | null;
    subheadline: string;
    imageUrl: string;
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
  statsBarContent: {
    enabled: boolean;
    items: Array<{
      id: string;
      text: string;
      icon: HomeStatsIconKey;
      sort_order: number;
      active: boolean;
    }>;
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
        icon: HomeStatsIconKey;
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
        icon: HomeStatsIconKey;
      }>;
      footnote: string;
      }
  >;
  dumpsterSizesContent: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    intro: string;
    items: Array<{
      id: string;
      sizeYards: number;
      title: string;
      shortDescription: string;
      longDescription: string;
      checklistItems: string[];
      dimensions: string;
      weightIncluded: string;
      rentalWindowDays: number | null;
      badgeLabel: string;
      isFeatured: boolean;
    }>;
  };
  serviceAreaLookupContent: {
    enabled: boolean;
    eyebrow: string;
    headline: string;
    description: string;
    zipPlaceholder: string;
    buttonText: string;
    areasEyebrow: string;
    areaPills: string[];
    helperText: string;
  };
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
  servedZipCodes: string[];
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type LandingSectionBackground = "page" | "white";

function getLandingBackgroundClass(background: LandingSectionBackground) {
  return background === "white" ? "bg-white" : "bg-[#f5f4f0]";
}

function getOppositeBackground(background: LandingSectionBackground): LandingSectionBackground {
  return background === "white" ? "page" : "white";
}

type SectionHeadingProps = {
  eyebrow?: string | null;
  title: string;
  description?: string | null;
  className?: string;
  compact?: boolean;
  size?: "default" | "large";
};

function SectionHeading({
  eyebrow,
  title,
  description,
  className,
  compact = false,
  size = "default",
}: SectionHeadingProps) {
  const cleanEyebrow = eyebrow?.trim();
  const cleanTitle = title.trim();
  const cleanDescription = description?.trim();

  return (
    <div className={joinClasses("max-w-3xl", className)}>
      {cleanEyebrow ? (
        <div className="mb-4 flex items-center gap-3">
          <span className="h-0.5 w-10 shrink-0 rounded-full bg-[#F97316] sm:w-12" aria-hidden="true" />
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-[#F97316] sm:text-sm">
            {cleanEyebrow}
          </div>
        </div>
      ) : null}
      {cleanTitle ? (
        <h2
          className={joinClasses(
            "font-bold tracking-tight text-[#0F172A]",
            compact
              ? "text-4xl leading-[0.98] sm:text-5xl md:text-[3.25rem]"
              : size === "large"
                ? "text-4xl leading-tight sm:text-5xl lg:text-6xl"
                : "text-3xl leading-tight sm:text-4xl lg:text-5xl",
          )}
        >
          {cleanTitle}
        </h2>
      ) : null}
      {cleanDescription ? (
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#475569] md:text-lg">
          {cleanDescription}
        </p>
      ) : null}
    </div>
  );
}

function MarketingSectionWrapper({
  background,
  children,
}: {
  background: LandingSectionBackground;
  children: React.ReactNode;
}) {
  return (
    <section
      className={joinClasses(
        "border-b border-[#E5D8C8]",
        getLandingBackgroundClass(background),
      )}
    >
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        {children}
      </div>
    </section>
  );
}

function MarketingCard({
  label,
  title,
  body,
  icon,
}: {
  label: string;
  title: string;
  body: string;
  icon: HomeStatsIconKey;
}) {
  return (
    <article className="flex h-full min-h-[300px] flex-col rounded-[24px] border border-[#E5D8C8] bg-white/95 p-7 shadow-[0_16px_40px_rgba(15,23,42,0.045)] sm:p-8 lg:p-9">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#E5D8C8] bg-[#fffaf3] text-[#F97316] shadow-sm">
        <HomeStatsIcon iconKey={icon} className="h-8 w-8" />
      </div>
      <div className="mt-7 text-xs font-extrabold uppercase tracking-[0.18em] text-[#F97316]">
        {label}
      </div>
      <h3 className="mt-3 text-2xl font-bold leading-[1.05] tracking-tight text-[#0F172A] sm:text-3xl">
        {title}
      </h3>
      <p className="mt-5 text-base leading-7 text-[#475569]">
        {body}
      </p>
    </article>
  );
}

function HeroTrustList({ items }: { items: string[] }) {
  const trustItems = items.map((item) => item.trim()).filter(Boolean);

  if (!trustItems.length) return null;

  return (
    <ul className="mt-4 grid gap-2 text-sm font-medium text-slate-700 sm:grid-cols-3">
      {trustItems.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className="flex min-w-0 items-center gap-2"
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F97316] text-white shadow-sm shadow-orange-900/10">
            <CheckIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

type DumpsterSizesContent = HomePageClientProps["dumpsterSizesContent"];
type DumpsterSizeContent = DumpsterSizesContent["items"][number];

function getDumpsterStats(item: DumpsterSizeContent) {
  const stats: Array<{ label: string; value: string }> = [];
  const dimensions = item.dimensions.trim();
  const weightIncluded = item.weightIncluded.trim();

  if (dimensions) {
    stats.push({ label: "DIMENSIONS", value: dimensions });
  }

  if (weightIncluded) {
    stats.push({ label: "WEIGHT INCLUDED", value: weightIncluded });
  }

  if (item.rentalWindowDays && item.rentalWindowDays > 0) {
    stats.push({
      label: "TYPICAL RENTAL",
      value: `${item.rentalWindowDays} ${item.rentalWindowDays === 1 ? "day" : "days"}`,
    });
  }

  return stats;
}

function DumpsterStatsGrid({
  item,
  background = "white",
}: {
  item: DumpsterSizeContent;
  background?: LandingSectionBackground;
}) {
  const stats = getDumpsterStats(item);

  if (!stats.length) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={joinClasses(
            "rounded-[14px] border border-[#E5D8C8] px-5 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.055)]",
            getLandingBackgroundClass(background),
          )}
        >
          <div className="text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-[#F97316]">
            {stat.label}
          </div>
          <div className="mt-2 text-lg font-bold leading-snug text-[#0F172A]">
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function DumpsterChecklist({ items }: { items: string[] }) {
  const checklistItems = items.map((item) => item.trim()).filter(Boolean);

  if (!checklistItems.length) return null;

  return (
    <ul className="grid gap-3 text-sm font-semibold text-[#334155] sm:grid-cols-2">
      {checklistItems.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-center gap-3">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F97316] text-white">
            <CheckIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function formatFocusedDumpsterTitle(item: DumpsterSizeContent) {
  const title = item.title.trim();
  return title ? `${item.sizeYards} Yard — ${title}` : `${item.sizeYards} Yard`;
}

function DumpsterSizesSection({
  content,
  sectionBackground,
}: {
  content: DumpsterSizesContent;
  sectionBackground: LandingSectionBackground;
}) {
  const items = useMemo(
    () => content.items.filter((item) => item.sizeYards > 0),
    [content.items],
  );
  const cardBackground = getOppositeBackground(sectionBackground);
  const innerStatBackground = getOppositeBackground(cardBackground);
  const defaultItem = items.find((item) => item.isFeatured) ?? items[0];
  const defaultItemId = defaultItem?.id ?? "";
  const [selectedId, setSelectedId] = useState(defaultItemId);

  if (!defaultItem) return null;

  const selectedItem = items.find((item) => item.id === selectedId) ?? defaultItem;
  const intro = content.intro.trim();

  if (items.length === 1) {
    const description = selectedItem.longDescription.trim() || selectedItem.shortDescription.trim();

    return (
      <div>
        <SectionHeading
          eyebrow={content.eyebrow}
          title={content.title}
          description={intro}
          size="large"
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)] lg:items-start">
          <div>
            <div className="flex items-end gap-3">
              <div className="text-7xl font-extrabold leading-none tracking-tight text-[#F97316] sm:text-8xl">
                {selectedItem.sizeYards}
              </div>
              <div className="pb-2 text-3xl font-bold tracking-tight text-[#94A3B8] sm:text-4xl">
                yd
              </div>
            </div>
            <h3 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-[#0F172A] sm:text-4xl">
              {selectedItem.title}
            </h3>
            {description ? (
              <p className="mt-4 max-w-2xl text-lg leading-8 text-[#475569]">
                {description}
              </p>
            ) : null}
            <div className="mt-7">
              <DumpsterChecklist items={selectedItem.checklistItems} />
            </div>
          </div>

          <DumpsterStatsGrid item={selectedItem} background={cardBackground} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeading
        eyebrow={content.eyebrow}
        title={content.title}
        description={intro}
        size="large"
      />

      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const selected = item.id === selectedItem.id;
          const shortDescription = item.shortDescription.trim();
          const dimensions = item.dimensions.trim();
          const weightIncluded = item.weightIncluded.trim();
          const badgeLabel = item.badgeLabel.trim();
          const hasMetadata = Boolean(dimensions || weightIncluded);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              aria-pressed={selected}
              className={joinClasses(
                "flex h-full min-h-[250px] flex-col rounded-[16px] border p-6 text-left shadow-[0_14px_34px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]",
                getLandingBackgroundClass(cardBackground),
                selected ? "border-[#F97316] ring-2 ring-[#F97316]/15" : "border-[#E5D8C8]",
              )}
            >
              {badgeLabel ? (
                <span
                  className={joinClasses(
                    "mb-5 w-fit rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em]",
                    selected ? "bg-[#F97316] text-white" : "bg-[#FFF7ED] text-[#EA580C]",
                  )}
                >
                  {badgeLabel}
                </span>
              ) : null}
              <div
                className={joinClasses(
                  "text-5xl font-extrabold leading-none tracking-tight",
                  selected ? "text-[#F97316]" : "text-[#0F172A]",
                )}
              >
                {item.sizeYards}
                <span className="ml-2 text-2xl font-bold text-[#94A3B8]">yd</span>
              </div>
              <h3 className="mt-5 text-xl font-bold leading-tight text-[#0F172A]">
                {item.title}
              </h3>
              {shortDescription ? (
                <p className="mt-3 mb-5 text-sm leading-6 text-[#475569]">
                  {shortDescription}
                </p>
              ) : null}
              {hasMetadata ? (
                <div className="mt-auto space-y-2 border-t border-slate-200/70 pt-5 text-sm font-semibold text-slate-400">
                  {dimensions ? <div>{dimensions}</div> : null}
                  {weightIncluded ? <div>{weightIncluded}</div> : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        className={joinClasses(
          "mt-8 rounded-[18px] border border-[#E5D8C8] p-6 shadow-[0_18px_44px_rgba(15,23,42,0.06)] sm:p-8",
          getLandingBackgroundClass(cardBackground),
        )}
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.38fr)] lg:items-start">
          <div>
            <h3 className="text-3xl font-bold leading-tight tracking-tight text-[#0F172A] sm:text-4xl">
              {formatFocusedDumpsterTitle(selectedItem)}
            </h3>
            {selectedItem.longDescription.trim() || selectedItem.shortDescription.trim() ? (
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#475569] md:text-lg">
                {selectedItem.longDescription.trim() || selectedItem.shortDescription.trim()}
              </p>
            ) : null}
            <div className="mt-7">
              <DumpsterChecklist items={selectedItem.checklistItems} />
            </div>
          </div>

          <DumpsterStatsGrid item={selectedItem} background={innerStatBackground} />
        </div>
      </div>
    </div>
  );
}

export default function HomePageClient({
  previewMode = false,
  heroContent,
  serviceAreaContent,
  statsBarContent,
  homeSectionsContent,
  dumpsterSizesContent,
  serviceAreaLookupContent,
  faqContent,
  supportMarketingContent,
  visibilitySettings,
  servedZipCodes,
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
  const activeStats = useMemo(
    () =>
      statsBarContent.items
        .filter((item) => item.active && item.text.trim())
        .sort((a, b) => a.sort_order - b.sort_order),
    [statsBarContent.items],
  );
  const dumpsterSizesSectionBackground = homeSectionsContent.length % 2 === 0 ? "white" : "page";
  const serviceAreaSectionBackground = (homeSectionsContent.length + 1) % 2 === 0 ? "white" : "page";
  const faqSectionBackground = (homeSectionsContent.length + 2) % 2 === 0 ? "white" : "page";
  const showDumpsterSizesSection = dumpsterSizesContent.enabled && dumpsterSizesContent.items.length > 0;

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

  useEffect(() => {
    if (!serviceAreaOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setServiceAreaOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [serviceAreaOpen]);

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
        <div className="mx-auto flex max-w-6xl flex-col items-stretch gap-10 px-6 pb-10 pt-8 sm:pt-10 lg:min-h-[400px] lg:flex-row lg:items-start lg:gap-14 lg:pb-12 lg:pt-12">
          <div className="flex-1 lg:max-w-[52%]">
            <div className="w-full">
              {heroContent.eyebrow ? (
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F97316] pb-4">
                  {heroContent.eyebrow}
                </div>
              ) : null}
              <h1 className="mt-3 text-3xl font-semibold leading-[1.1] tracking-tight text-[#0F172A] sm:text-4xl lg:text-5xl">
                {heroContent.headlineLine2 ? (
                  <>
                    <span className="block">{heroContent.headlineLine1}</span>
                    <span className="block">{heroContent.headlineLine2}</span>
                  </>
                ) : (
                  heroContent.headlineLine1
                )}
              </h1>
              <p className="mt-6 max-w-2xl text-xl font-medium leading-relaxed text-[#0F172A]/80">
                {heroContent.subheadline}
              </p>

              <div className="mt-12 flex flex-col gap-3">
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
                    aria-labelledby="service-area-modal-title"
                    aria-describedby="service-area-modal-description"
                    onClick={() => setServiceAreaOpen(false)}
                  >
                    <div className="absolute inset-0 bg-black/40" />

                    <div
                      className="relative z-10 w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 id="service-area-modal-title" className="text-lg font-semibold text-slate-900">
                            {serviceAreaContent.modalTitle}
                          </h3>
                          <p id="service-area-modal-description" className="mt-1 text-sm text-slate-600">
                            {serviceAreaContent.modalIntro}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">
                          {serviceAreaContent.coverageHeading}
                        </div>

                        {servedZipCodes.length > 0 ? (
                          <ul className="mt-3 grid max-h-[min(50vh,360px)] grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-2 overflow-y-auto pr-1 text-sm text-slate-700">
                            {servedZipCodes.map((servedZip) => (
                              <li
                                key={servedZip}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center font-semibold text-slate-800 shadow-sm"
                              >
                                {servedZip}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-3 text-sm text-slate-600">
                            Service area details are being updated. Please contact us for availability.
                          </p>
                        )}
                        {serviceAreaContent.coverageFootnote ? (
                          <p className="mt-3 text-sm text-slate-500">{serviceAreaContent.coverageFootnote}</p>
                        ) : null}
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

                <p className="text-sm text-[#475569] pb-7">
                  {heroContent.availabilityHelper}
                </p>
                <HeroTrustList items={heroContent.trustItems} />
              </div>
            </div>
          </div>

          <div className="w-full shrink-0 lg:w-[48%]">
            <div className="relative">
              <div className="relative h-[420px] overflow-hidden rounded-[12px] shadow-[0_24px_60px_rgba(15,23,42,0.16)] sm:h-[500px] lg:h-[620px]">
                <img
                  src={heroContent.imageUrl}
                  alt={heroContent.imageAlt}
                  className="h-full w-full object-cover object-[center_62%]"
                />
                <div className="absolute inset-0 bg-slate-950/30" aria-hidden="true" />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-1/2 bg-gradient-to-t from-black/35 to-transparent lg:block"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {statsBarContent.enabled && activeStats.length > 0 ? (
        <section className="mt-10 bg-[#1A1A1A] md:mt-12">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid divide-y divide-white/15 py-6 xl:grid-cols-3 xl:divide-x xl:divide-y-0 xl:py-8">
              {activeStats.map((item) => (
                <div
                  key={item.id}
                  className="flex min-w-0 items-center justify-start gap-4 py-4 first:pt-0 last:pb-0 xl:justify-center xl:gap-3 xl:px-6 xl:py-0 xl:first:pt-0 xl:last:pb-0"
                >
                  <HomeStatsIcon iconKey={item.icon} className="h-8 w-8 shrink-0 text-[#F97316]" />
                  <div className="min-w-0 text-xl font-extrabold leading-snug text-white 1xl:text-1xl">
                    {item.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className="pt-14 md:pt-0">
        {homeSectionsContent.map((section, index) => {
          const sectionCaption = section.caption.trim();
          const sectionBackground = index % 2 === 0 ? "white" : "page";

          if (section.type === "card_grid") {
            return (
              <MarketingSectionWrapper key={section.id} background={sectionBackground}>
                <SectionHeading
                  eyebrow={sectionCaption}
                  title={section.sectionTitle}
                  description={section.intro}
                  size="default"
                />

                <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {section.items.map((item) => (
                    <MarketingCard
                      key={`${item.label}-${item.headline}`}
                      label={item.label}
                      title={item.headline}
                      body={item.body}
                      icon={item.icon}
                    />
                  ))}
                </div>
              </MarketingSectionWrapper>
            );
          }

          return (
            <MarketingSectionWrapper key={section.id} background={sectionBackground}>
              <SectionHeading
                eyebrow={sectionCaption}
                title={section.sectionTitle}
                description={section.intro}
                size="large"
              />

              <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {section.items.map((item) => (
                  <MarketingCard
                    key={`${item.label}-${item.title}`}
                    label={item.label}
                    title={item.title}
                    body={item.body}
                    icon={item.icon}
                  />
                ))}
              </div>

              {section.footnote ? (
                <p className="mt-6 text-sm text-[#475569]">{section.footnote}</p>
              ) : null}
            </MarketingSectionWrapper>
          );
        })}

        {showDumpsterSizesSection ? (
          <MarketingSectionWrapper background={dumpsterSizesSectionBackground}>
            <DumpsterSizesSection
              content={dumpsterSizesContent}
              sectionBackground={dumpsterSizesSectionBackground}
            />
          </MarketingSectionWrapper>
        ) : null}

        {serviceAreaLookupContent.enabled ? (
          <MarketingSectionWrapper background={serviceAreaSectionBackground}>
            <HomepageServiceAreaLookup content={serviceAreaLookupContent} />
          </MarketingSectionWrapper>
        ) : null}

        {visibilitySettings.showFaq ? (
          <MarketingSectionWrapper background={faqSectionBackground}>
              <SectionHeading
                eyebrow="FAQS"
                title={faqContent.headline}
                description={faqContent.intro}
              />

            {(() => {
              const half = Math.ceil(faqContent.items.length / 2);
              const columns = [
                faqContent.items.slice(0, half),
                faqContent.items.slice(half),
              ];
              return (
                <div className="mt-10 grid gap-4 lg:grid-cols-2">
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
          </MarketingSectionWrapper>
        ) : null}
      </div>

      <section className="bg-[#ede8e0]">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex items-center gap-3">
                <span className="h-0.5 w-10 shrink-0 rounded-full bg-[#F97316] sm:w-12" aria-hidden="true" />
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-[#F97316] sm:text-sm">
                  Book now
                </div>
              </div>
              <h2 className="text-4xl font-bold leading-[0.96] tracking-tight text-[#111] sm:text-5xl lg:text-6xl">
                {supportMarketingContent.headline}
              </h2>
              <p className="mt-4 text-base leading-7 text-[#666] md:text-lg">
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
    </main>
  );
}

type ServiceAreaLookupContent = HomePageClientProps["serviceAreaLookupContent"];
type ZipLookupState =
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | { status: "success"; zip: string }
  | { status: "not_serviced"; zip: string }
  | { status: "error"; message: string };

function HomepageServiceAreaLookup({ content }: { content: ServiceAreaLookupContent }) {
  const [zip, setZip] = useState("");
  const [lookupState, setLookupState] = useState<ZipLookupState>({ status: "idle" });
  const [loading, setLoading] = useState(false);
  const zipDigits = useMemo(() => zip.replace(/\D/g, "").slice(0, 5), [zip]);
  const zipValid = zipDigits.length === 5;
  const visiblePills = content.areaPills.map((pill) => pill.trim()).filter(Boolean);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (!zipValid) {
      setLookupState({ status: "invalid", message: "Enter a valid 5-digit ZIP code." });
      return;
    }

    setLoading(true);
    setLookupState({ status: "idle" });

    try {
      const params = new URLSearchParams({ zip: zipDigits });
      const response = await fetch(`/api/zip-check?${params.toString()}`, { cache: "no-store" });
      const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (json?.serviced === true) {
        setLookupState({ status: "success", zip: zipDigits });
        return;
      }

      if (response.ok || json?.serviced === false) {
        setLookupState({ status: "not_serviced", zip: zipDigits });
        return;
      }

      setLookupState({
        status: "error",
        message: "We could not check that ZIP right now. Please try again.",
      });
    } catch {
      setLookupState({
        status: "error",
        message: "We could not check that ZIP right now. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-center">
      <div>
        <SectionHeading
          eyebrow={content.eyebrow}
          title={content.headline}
          description={content.description}
          size="large"
        />

        <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            inputMode="numeric"
            autoComplete="postal-code"
            value={zipDigits}
            onChange={(event) => {
              setZip(event.target.value);
              setLookupState({ status: "idle" });
            }}
            placeholder={content.zipPlaceholder}
            className="h-12 w-full rounded-2xl border border-[#c0b9ae] bg-white px-4 text-[#0F172A] shadow-sm outline-none transition focus:ring-2 focus:ring-[#F97316]/40 sm:max-w-[260px]"
          />
          <LoadingButton
            type="submit"
            loading={loading}
            loadingLabel="Checking..."
            disabled={!zipValid}
            className="h-12 w-full rounded-2xl bg-[#F97316] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#EA580C] focus:outline-none focus:ring-4 focus:ring-[#F97316]/30 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99] sm:w-auto"
          >
            {content.buttonText}
          </LoadingButton>
        </form>

        <ZipLookupMessage state={lookupState} />
      </div>

      <div className="rounded-[20px] border border-[#d6d0c8] bg-white/60 p-5 md:p-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">
          {content.areasEyebrow}
        </div>
        {visiblePills.length ? (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {visiblePills.map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-[#d8d0c2] bg-white px-4 py-2 text-sm font-semibold text-[#334155] shadow-sm"
              >
                {pill}
              </span>
            ))}
          </div>
        ) : null}
        {content.helperText ? (
          <p className="mt-4 text-sm font-medium text-[#475569]">{content.helperText}</p>
        ) : null}
      </div>
    </div>
  );
}

function ZipLookupMessage({ state }: { state: ZipLookupState }) {
  if (state.status === "idle") return null;

  if (state.status === "success") {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        <div className="font-semibold">Good news — we serve {state.zip}.</div>
        <a
          href={`/book/address?zip=${encodeURIComponent(state.zip)}`}
          className="mt-2 inline-flex h-10 items-center justify-center rounded-xl bg-[#F97316] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#EA580C]"
        >
          Continue booking
        </a>
      </div>
    );
  }

  if (state.status === "not_serviced") {
    return (
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
        Sorry, we do not currently serve {state.zip}.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-950">
      {state.message}
    </div>
  );
}
