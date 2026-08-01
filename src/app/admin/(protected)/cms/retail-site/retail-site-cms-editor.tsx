"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CmsEntryStatus,
  HomeDumpsterSizeItem,
  HomeDumpsterSizesValue,
  HomeFlexibleSection,
  HomeFaqValue,
  HomeHeroValue,
  HomeServiceAreaLookupValue,
  HomeServiceAreaPopupValue,
  HomeStatsBarValue,
  PricingProductContentValue,
  PricingSizeGuideRow,
  RetailSiteCmsState,
  TermsAndConditionsContentValue,
} from "@/lib/admin/cms";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  HOME_STATS_ICON_OPTIONS,
  HomeStatsIcon,
  normalizeHomeStatsIconKey,
  type HomeStatsIconKey,
} from "@/lib/home-stats-icons";

const HOME_HERO_KEY = "content.home.hero";
const HOME_STATS_BAR_KEY = "content.home.stats_bar";
const HOME_SECTIONS_KEY = "content.home.sections";
const HOME_DUMPSTER_SIZES_KEY = "content.home.dumpster_sizes";
const HOME_SERVICE_AREA_LOOKUP_KEY = "content.home.service_area_lookup";
const HOME_SERVICE_AREA_KEY = "content.home.service_area_popup";
const HOME_FAQ_KEY = "content.faq.home";
const PRICING_PRODUCT_KEY = "content.pricing.product_content";
const TERMS_AND_CONDITIONS_KEY = "content.terms.rental_terms";
const HERO_IMAGE_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const HERO_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

const HOME_PAGE_KEYS = [
  HOME_HERO_KEY,
  HOME_STATS_BAR_KEY,
  HOME_SECTIONS_KEY,
  HOME_DUMPSTER_SIZES_KEY,
  HOME_SERVICE_AREA_LOOKUP_KEY,
  HOME_SERVICE_AREA_KEY,
  HOME_FAQ_KEY,
];
const PRICING_PAGE_KEYS = [PRICING_PRODUCT_KEY];
const TERMS_PAGE_KEYS = [TERMS_AND_CONDITIONS_KEY];

type CmsPageId = "home" | "pricing" | "terms";

type RetailSiteCmsEditorProps = {
  cms: RetailSiteCmsState;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function createSectionId(type: HomeFlexibleSection["type"]) {
  return `${type}_${Math.random().toString(36).slice(2, 10)}`;
}

function createStatsItemId() {
  return `stat_${Math.random().toString(36).slice(2, 10)}`;
}

function createDumpsterSizeId() {
  return `dumpster_${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultDumpsterSizeItem(): HomeDumpsterSizeItem {
  return {
    id: createDumpsterSizeId(),
    sizeYards: null,
    title: "",
    shortDescription: "",
    longDescription: "",
    checklistItems: [""],
    dimensions: "",
    weightIncluded: "",
    rentalWindowDays: null,
    badgeLabel: "",
    isFeatured: false,
  };
}

function createSizeGuideRowId() {
  return `size_guide_${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultSizeGuideRow(sortOrder: number): PricingSizeGuideRow {
  return {
    id: createSizeGuideRowId(),
    sizeLabel: "",
    truckLoadEstimate: "",
    description: "",
    sortOrder,
    active: true,
  };
}

const DEFAULT_CARD_GRID_ICON_KEYS = ["tag", "truck", "home"] satisfies HomeStatsIconKey[];
const DEFAULT_STEPS_ICON_KEYS = ["calendar", "mapPin", "checkCircle"] satisfies HomeStatsIconKey[];

function getDefaultMarketingIconKey(
  type: HomeFlexibleSection["type"],
  index: number,
): HomeStatsIconKey {
  const defaults = type === "card_grid" ? DEFAULT_CARD_GRID_ICON_KEYS : DEFAULT_STEPS_ICON_KEYS;
  return defaults[index] ?? "star";
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const month = date.toISOString().slice(5, 7);
  const day = date.toISOString().slice(8, 10);
  const year = date.toISOString().slice(0, 4);
  const time = date.toISOString().slice(11, 16);
  return `${year}-${month}-${day} ${time} UTC`;
}

function latestTimestamp(values: Array<string | null | undefined>) {
  const timestamps = values.filter((value): value is string => Boolean(value));
  if (!timestamps.length) return null;

  return timestamps.reduce((latest, current) =>
    new Date(current).getTime() > new Date(latest).getTime() ? current : latest,
  );
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function scrollElementIntoComfortableView(element: HTMLElement) {
  const top = window.scrollY + element.getBoundingClientRect().top - 120;
  window.scrollTo({
    top: Math.max(top, 0),
    behavior: "smooth",
  });
}

function focusFirstEditableField(container: HTMLElement | null) {
  if (!container) return;

  const target = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    "input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])",
  );
  target?.focus({ preventScroll: true });
}

function inputClass() {
  return "h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10";
}

function textareaClass() {
  return "min-h-[110px] w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10";
}

function pageTabClass(active: boolean) {
  return [
    "rounded-[14px] px-4 py-2 text-sm font-semibold transition",
    active
      ? "bg-slate-900 text-white shadow-sm"
      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900",
  ].join(" ");
}

function sectionTabClass(active: boolean) {
  return [
    "w-full rounded-lg px-3 py-2.5 text-left text-sm transition",
    active
      ? "bg-slate-100 text-slate-900"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
  ].join(" ");
}

export default function RetailSiteCmsEditor({ cms }: RetailSiteCmsEditorProps) {
  const initialValuesByKey = useMemo(
    () => ({
      [HOME_HERO_KEY]: clone(cms.home.hero.value),
      [HOME_STATS_BAR_KEY]: clone(cms.home.statsBar.value),
      [HOME_SECTIONS_KEY]: clone(cms.home.sections.value),
      [HOME_DUMPSTER_SIZES_KEY]: clone(cms.home.dumpsterSizes.value),
      [HOME_SERVICE_AREA_LOOKUP_KEY]: clone(cms.home.serviceAreaLookup.value),
      [HOME_SERVICE_AREA_KEY]: clone(cms.home.serviceAreaPopup.value),
      [HOME_FAQ_KEY]: clone(cms.home.faq.value),
      [PRICING_PRODUCT_KEY]: clone(cms.pricing.productContent.value),
      [TERMS_AND_CONDITIONS_KEY]: clone(cms.terms.rentalTerms.value),
    }),
    [cms],
  );

  const initialStatusByKey = useMemo<Record<string, CmsEntryStatus>>(
    () => ({
      [HOME_HERO_KEY]: {
        hasDraft: cms.home.hero.hasDraft,
        draftUpdatedAt: cms.home.hero.draftUpdatedAt,
        publishedUpdatedAt: cms.home.hero.publishedUpdatedAt,
      },
      [HOME_STATS_BAR_KEY]: {
        hasDraft: cms.home.statsBar.hasDraft,
        draftUpdatedAt: cms.home.statsBar.draftUpdatedAt,
        publishedUpdatedAt: cms.home.statsBar.publishedUpdatedAt,
      },
      [HOME_SECTIONS_KEY]: {
        hasDraft: cms.home.sections.hasDraft,
        draftUpdatedAt: cms.home.sections.draftUpdatedAt,
        publishedUpdatedAt: cms.home.sections.publishedUpdatedAt,
      },
      [HOME_DUMPSTER_SIZES_KEY]: {
        hasDraft: cms.home.dumpsterSizes.hasDraft,
        draftUpdatedAt: cms.home.dumpsterSizes.draftUpdatedAt,
        publishedUpdatedAt: cms.home.dumpsterSizes.publishedUpdatedAt,
      },
      [HOME_SERVICE_AREA_LOOKUP_KEY]: {
        hasDraft: cms.home.serviceAreaLookup.hasDraft,
        draftUpdatedAt: cms.home.serviceAreaLookup.draftUpdatedAt,
        publishedUpdatedAt: cms.home.serviceAreaLookup.publishedUpdatedAt,
      },
      [HOME_SERVICE_AREA_KEY]: {
        hasDraft: cms.home.serviceAreaPopup.hasDraft,
        draftUpdatedAt: cms.home.serviceAreaPopup.draftUpdatedAt,
        publishedUpdatedAt: cms.home.serviceAreaPopup.publishedUpdatedAt,
      },
      [HOME_FAQ_KEY]: {
        hasDraft: cms.home.faq.hasDraft,
        draftUpdatedAt: cms.home.faq.draftUpdatedAt,
        publishedUpdatedAt: cms.home.faq.publishedUpdatedAt,
      },
      [PRICING_PRODUCT_KEY]: {
        hasDraft: cms.pricing.productContent.hasDraft,
        draftUpdatedAt: cms.pricing.productContent.draftUpdatedAt,
        publishedUpdatedAt: cms.pricing.productContent.publishedUpdatedAt,
      },
      [TERMS_AND_CONDITIONS_KEY]: {
        hasDraft: cms.terms.rentalTerms.hasDraft,
        draftUpdatedAt: cms.terms.rentalTerms.draftUpdatedAt,
        publishedUpdatedAt: cms.terms.rentalTerms.publishedUpdatedAt,
      },
    }),
    [cms],
  );

  const [activePage, setActivePage] = useState<CmsPageId>("home");
  const [activeHomeSectionId, setActiveHomeSectionId] = useState("hero");
  const [expandedMarketingSections, setExpandedMarketingSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(cms.home.sections.value.map((section) => [section.id, true])),
  );
  const [addingMarketingSection, setAddingMarketingSection] = useState(false);
  const [pendingNewSectionId, setPendingNewSectionId] = useState<string | null>(null);
  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);
  const [valuesByKey, setValuesByKey] = useState<Record<string, unknown>>(initialValuesByKey);
  const [savedByKey, setSavedByKey] = useState<Record<string, unknown>>(initialValuesByKey);
  const [statusByKey, setStatusByKey] = useState<Record<string, CmsEntryStatus>>(initialStatusByKey);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "publishing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [heroImageUploading, setHeroImageUploading] = useState(false);
  const [heroImageUploadError, setHeroImageUploadError] = useState<string | null>(null);
  const [heroImageUploadSuccess, setHeroImageUploadSuccess] = useState<string | null>(null);
  const marketingSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const heroImageInputRef = useRef<HTMLInputElement | null>(null);

  const homeHeroValue = (valuesByKey[HOME_HERO_KEY] as HomeHeroValue | undefined) ?? cms.home.hero.value;
  const homeStatsBarValue =
    (valuesByKey[HOME_STATS_BAR_KEY] as HomeStatsBarValue | undefined) ?? cms.home.statsBar.value;
  const homeSectionsValue =
    (valuesByKey[HOME_SECTIONS_KEY] as HomeFlexibleSection[] | undefined) ?? cms.home.sections.value;
  const dumpsterSizesValue =
    (valuesByKey[HOME_DUMPSTER_SIZES_KEY] as HomeDumpsterSizesValue | undefined) ??
    cms.home.dumpsterSizes.value;
  const serviceAreaLookupValue =
    (valuesByKey[HOME_SERVICE_AREA_LOOKUP_KEY] as HomeServiceAreaLookupValue | undefined) ??
    cms.home.serviceAreaLookup.value;
  const serviceAreaValue =
    (valuesByKey[HOME_SERVICE_AREA_KEY] as HomeServiceAreaPopupValue | undefined) ??
    cms.home.serviceAreaPopup.value;
  const faqValue = (valuesByKey[HOME_FAQ_KEY] as HomeFaqValue | undefined) ?? cms.home.faq.value;
  const pricingValue =
    (valuesByKey[PRICING_PRODUCT_KEY] as PricingProductContentValue | undefined) ??
    cms.pricing.productContent.value;
  const termsValue =
    (valuesByKey[TERMS_AND_CONDITIONS_KEY] as TermsAndConditionsContentValue | undefined) ??
    cms.terms.rentalTerms.value;

  const homeSectionOptions = [
    { id: "hero", label: "Top section" },
    { id: "stats", label: "Stats Bar" },
    { id: "marketing", label: "Marketing" },
    { id: "dumpster-sizes", label: "Dumpster Sizes" },
    { id: "service-area-lookup", label: "Service Lookup" },
    { id: "faq", label: "FAQ" },
  ];

  const resolvedHomeSectionId =
    activePage === "home" && homeSectionOptions.some((section) => section.id === activeHomeSectionId)
      ? activeHomeSectionId
      : homeSectionOptions[0]?.id ?? "hero";

  const currentPageKeys =
    activePage === "home" ? HOME_PAGE_KEYS : activePage === "pricing" ? PRICING_PAGE_KEYS : TERMS_PAGE_KEYS;
  const pageDirty = currentPageKeys.some(
    (key) => JSON.stringify(valuesByKey[key]) !== JSON.stringify(savedByKey[key]),
  );
  const anyDirty = [...HOME_PAGE_KEYS, ...PRICING_PAGE_KEYS, ...TERMS_PAGE_KEYS].some(
    (key) => JSON.stringify(valuesByKey[key]) !== JSON.stringify(savedByKey[key]),
  );

  const currentPageStatus = {
    hasDraft: currentPageKeys.some((key) => statusByKey[key]?.hasDraft),
    publishedUpdatedAt: latestTimestamp(
      currentPageKeys.map((key) => statusByKey[key]?.publishedUpdatedAt),
    ),
  };

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!anyDirty) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [anyDirty]);

  useEffect(() => {
    if (!pendingNewSectionId || resolvedHomeSectionId !== "marketing") return;

    const sectionElement = marketingSectionRefs.current[pendingNewSectionId];
    if (!sectionElement) return;

    const frame = requestAnimationFrame(() => {
      scrollElementIntoComfortableView(sectionElement);
      focusFirstEditableField(sectionElement);
      setHighlightedSectionId(pendingNewSectionId);
      setPendingNewSectionId(null);
      setAddingMarketingSection(false);
    });

    return () => cancelAnimationFrame(frame);
  }, [pendingNewSectionId, resolvedHomeSectionId, homeSectionsValue]);

  useEffect(() => {
    if (!highlightedSectionId) return;

    const timeout = window.setTimeout(() => {
      setHighlightedSectionId(null);
    }, 1600);

    return () => window.clearTimeout(timeout);
  }, [highlightedSectionId]);

  function updateValue(key: string, value: unknown) {
    setValuesByKey((current) => ({
      ...current,
      [key]: value,
    }));
    setSaveState("idle");
    setError(null);
  }

  function switchPage(nextPage: CmsPageId) {
    if (nextPage === activePage) return;
    if (pageDirty && !window.confirm("You have unsaved changes on this page. Switch pages anyway?")) {
      return;
    }
    setActivePage(nextPage);
    setError(null);
  }

  function updateHero(patch: Partial<HomeHeroValue>) {
    updateValue(HOME_HERO_KEY, { ...homeHeroValue, ...patch });
  }

  function updateHeroImageUrl(value: string) {
    updateHero({ imageUrl: value });
    setHeroImageUploadSuccess(null);
    setHeroImageUploadError(null);
  }

  async function handleHeroImageUpload(file: File) {
    setHeroImageUploadError(null);
    setHeroImageUploadSuccess(null);

    if (!HERO_IMAGE_ALLOWED_TYPES.has(file.type)) {
      setHeroImageUploadError("Only JPG, PNG, and WEBP hero images are supported.");
      if (heroImageInputRef.current) {
        heroImageInputRef.current.value = "";
      }
      return;
    }

    if (file.size > HERO_IMAGE_MAX_SIZE_BYTES) {
      setHeroImageUploadError("Hero image must be 5MB or smaller.");
      if (heroImageInputRef.current) {
        heroImageInputRef.current.value = "";
      }
      return;
    }

    setHeroImageUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/cms/hero-image/upload", {
        method: "POST",
        body: formData,
      });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        url?: string;
      };

      if (!response.ok || !json.ok || !json.url) {
        throw new Error(json.error || "Hero image upload failed.");
      }

      updateHero({ imageUrl: json.url });
      setHeroImageUploadSuccess("Hero image uploaded. Save the page to persist this URL.");
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Hero image upload failed.";
      setHeroImageUploadError(message);
    } finally {
      setHeroImageUploading(false);
      if (heroImageInputRef.current) {
        heroImageInputRef.current.value = "";
      }
    }
  }

  function updateStatsBar(patch: Partial<HomeStatsBarValue>) {
    updateValue(HOME_STATS_BAR_KEY, { ...homeStatsBarValue, ...patch });
  }

  function updateStatsBarItems(items: HomeStatsBarValue["items"]) {
    updateStatsBar({ items });
  }

  function updateDumpsterSizes(patch: Partial<HomeDumpsterSizesValue>) {
    updateValue(HOME_DUMPSTER_SIZES_KEY, { ...dumpsterSizesValue, ...patch });
  }

  function updateServiceArea(patch: Partial<HomeServiceAreaPopupValue>) {
    updateValue(HOME_SERVICE_AREA_KEY, { ...serviceAreaValue, ...patch });
  }

  function updateServiceAreaLookup(patch: Partial<HomeServiceAreaLookupValue>) {
    updateValue(HOME_SERVICE_AREA_LOOKUP_KEY, { ...serviceAreaLookupValue, ...patch });
  }

  function updateFaq(patch: Partial<HomeFaqValue>) {
    updateValue(HOME_FAQ_KEY, { ...faqValue, ...patch });
  }

  function updatePricing(patch: Partial<PricingProductContentValue>) {
    updateValue(PRICING_PRODUCT_KEY, { ...pricingValue, ...patch });
  }

  function updatePricingSizeGuide(patch: Partial<PricingProductContentValue["sizeGuide"]>) {
    updatePricing({
      sizeGuide: {
        ...pricingValue.sizeGuide,
        ...patch,
      },
    });
  }

  function updateTerms(patch: Partial<TermsAndConditionsContentValue>) {
    updateValue(TERMS_AND_CONDITIONS_KEY, { ...termsValue, ...patch });
  }

  function updateHomeSections(nextSections: HomeFlexibleSection[]) {
    updateValue(HOME_SECTIONS_KEY, nextSections);
  }

  function updateActiveHomeSection(nextSection: HomeFlexibleSection) {
    updateHomeSections(homeSectionsValue.map((section) => (section.id === nextSection.id ? nextSection : section)));
  }

  function addHomeSection(type: HomeFlexibleSection["type"]) {
    if (addingMarketingSection) return;

    const nextSection: HomeFlexibleSection =
      type === "card_grid"
        ? {
            id: createSectionId(type),
            type,
            caption: "",
            sectionTitle: "",
            intro: "",
            items: [{ label: "", headline: "", body: "", icon: getDefaultMarketingIconKey(type, 0) }],
          }
        : {
            id: createSectionId(type),
            type,
            caption: "",
            sectionTitle: "",
            intro: "",
            items: [{ label: "", title: "", body: "", icon: getDefaultMarketingIconKey(type, 0) }],
            footnote: "",
          };

    setAddingMarketingSection(true);
    updateHomeSections([...homeSectionsValue, nextSection]);
    setActiveHomeSectionId("marketing");
    setExpandedMarketingSections((current) => ({
      ...current,
      [nextSection.id]: true,
    }));
    setPendingNewSectionId(nextSection.id);
  }

  function removeHomeSection(sectionId: string) {
    const nextSections = homeSectionsValue.filter((section) => section.id !== sectionId);
    updateHomeSections(nextSections);
    setExpandedMarketingSections((current) => {
      const next = { ...current };
      delete next[sectionId];
      return next;
    });
    setActiveHomeSectionId("marketing");
  }

  function toggleMarketingSection(sectionId: string) {
    setExpandedMarketingSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }

  type HomeCardGridSection = Extract<HomeFlexibleSection, { type: "card_grid" }>;
  type HomeStepsSection = Extract<HomeFlexibleSection, { type: "steps" }>;
  type HomeCardGridItem = HomeCardGridSection["items"][number];
  type HomeStepsItem = HomeStepsSection["items"][number];

  function isHomeCardGridItem(
    section: HomeFlexibleSection,
    _item: HomeFlexibleSection["items"][number],
  ): _item is HomeCardGridItem {
    return section.type === "card_grid";
  }

  function getMarketingItemTitle(
    section: HomeFlexibleSection,
    item: HomeFlexibleSection["items"][number],
  ) {
    return isHomeCardGridItem(section, item) ? String(item.headline ?? "") : String(item.title ?? "");
  }

  function setMarketingItemTitle(
    section: HomeCardGridSection,
    item: HomeCardGridItem,
    value: string,
  ): HomeCardGridItem;
  function setMarketingItemTitle(
    section: HomeStepsSection,
    item: HomeStepsItem,
    value: string,
  ): HomeStepsItem;
  function setMarketingItemTitle(
    section: HomeFlexibleSection,
    item: HomeFlexibleSection["items"][number],
    value: string,
  ) {
    return isHomeCardGridItem(section, item) ? { ...item, headline: value } : { ...item, title: value };
  }

  async function persistPage(action: "save_draft" | "publish") {
    setError(null);
    setSaveState(action === "publish" ? "publishing" : "saving");

    const entries = currentPageKeys.map((key) => ({
      key,
      value: valuesByKey[key],
    }));

    const response = await fetch("/api/admin/cms/retail-site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, entries }),
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok || !json?.ok) {
      setError(json?.error || "CMS save failed.");
      setSaveState("idle");
      return false;
    }

    setSavedByKey((current) => {
      const next = { ...current };
      for (const key of currentPageKeys) {
        next[key] = clone(valuesByKey[key]);
      }
      return next;
    });

    const updates = Array.isArray(json?.updates) ? json.updates : [];
    setStatusByKey((current) => {
      const next = { ...current };

      for (const key of currentPageKeys) {
        const update = updates.find((item: { key?: string }) => item?.key === key);
        next[key] = {
          hasDraft: true,
          draftUpdatedAt: update?.draftUpdatedAt ?? current[key]?.draftUpdatedAt ?? null,
          publishedUpdatedAt: update?.publishedUpdatedAt ?? current[key]?.publishedUpdatedAt ?? null,
        };
      }

      return next;
    });

    setSaveState("saved");
    return true;
  }

  async function handlePreview() {
    const ok = await persistPage("save_draft");
    if (!ok) return;

    const redirect = activePage === "pricing" ? "/pricing" : activePage === "terms" ? "/confirm" : "/";
    window.open(`/admin/cms/preview?redirect=${encodeURIComponent(redirect)}`, "_blank", "noopener,noreferrer");
  }

  function renderHomeActiveSection() {
    if (resolvedHomeSectionId === "hero") {
      return (
        <div className="space-y-5">
          <Field
            label="Intro header"
            value={homeHeroValue.eyebrow}
            onChange={(value) => updateHero({ eyebrow: value })}
          />
          <Field
            label="Headline line 1"
            value={homeHeroValue.headlineLine1}
            onChange={(value) => updateHero({ headlineLine1: value })}
          />
          <Field
            label="Headline line 2"
            value={homeHeroValue.headlineLine2}
            onChange={(value) => updateHero({ headlineLine2: value })}
          />
          <TextAreaField
            label="Subheadline"
            value={homeHeroValue.subheadline}
            onChange={(value) => updateHero({ subheadline: value })}
          />
          <Field
            label="Image URL"
            value={homeHeroValue.imageUrl}
            onChange={updateHeroImageUrl}
          />
          <HeroImageUploadField
            imageUrl={homeHeroValue.imageUrl}
            imageAlt={homeHeroValue.imageAlt}
            inputRef={heroImageInputRef}
            uploading={heroImageUploading}
            success={heroImageUploadSuccess}
            error={heroImageUploadError}
            onFileSelected={(file) => void handleHeroImageUpload(file)}
          />
          <Field
            label="Image alt text"
            value={homeHeroValue.imageAlt}
            onChange={(value) => updateHero({ imageAlt: value })}
          />
          <ArrayField
            label="Trust bullets"
            items={homeHeroValue.trustBullets}
            onChange={(items) => updateHero({ trustBullets: items })}
          />
          <div className="border-t border-slate-100 pt-6">
            <div className="text-base font-semibold text-slate-900">Service Area Popup</div>
            <div className="mt-1 text-sm text-slate-500">
              Edit the service area popup shown from the Home page.
            </div>
          </div>
          <Field label="Popup title" value={serviceAreaValue.title} onChange={(value) => updateServiceArea({ title: value })} />
          <TextAreaField label="Popup intro" value={serviceAreaValue.intro} onChange={(value) => updateServiceArea({ intro: value })} />
          <Field
            label="Coverage title"
            value={serviceAreaValue.coverageTitle}
            onChange={(value) => updateServiceArea({ coverageTitle: value })}
          />
          <ArrayField
            label="Coverage bullet list"
            items={serviceAreaValue.coverageBullets}
            onChange={(items) => updateServiceArea({ coverageBullets: items })}
          />
          <TextAreaField
            label="Bottom note"
            value={serviceAreaValue.bottomNote}
            onChange={(value) => updateServiceArea({ bottomNote: value })}
          />
          <Field
            label="Button label"
            value={serviceAreaValue.buttonLabel}
            onChange={(value) => updateServiceArea({ buttonLabel: value })}
          />
        </div>
      );
    }

    if (resolvedHomeSectionId === "stats") {
      return (
        <div className="space-y-6">
          <div className="rounded-[14px] border border-slate-300 bg-slate-100 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-300/70 bg-slate-100 px-5 py-4">
              <div className="text-sm font-semibold text-slate-900">Homepage stats bar</div>
              <div className="mt-1 text-sm text-slate-500">
                Control the dark stat strip shown below the Home hero.
              </div>
            </div>
            <div className="space-y-6 bg-slate-50/50 px-5 py-5">
              <CheckboxField
                label="Show stats bar"
                checked={homeStatsBarValue.enabled}
                onChange={(enabled) => updateStatsBar({ enabled })}
              />

              <RepeatableItems<HomeStatsBarValue["items"][number]>
                label="Stat items"
                items={homeStatsBarValue.items}
                createItem={() => ({
                  id: createStatsItemId(),
                  text: "",
                  icon: "truck",
                  sort_order: homeStatsBarValue.items.length + 1,
                  active: true,
                })}
                onChange={updateStatsBarItems}
                itemsClassName="space-y-5"
                itemClassName="space-y-4 rounded-[14px] border border-slate-300/80 bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.05)]"
                renderItem={(item, onItemChange) => (
                  <div className="grid gap-4">
                    <div className="flex items-center gap-3 rounded-lg bg-[#1A1A1A] px-4 py-4 text-white">
                      <HomeStatsIcon
                        iconKey={normalizeHomeStatsIconKey(item.icon)}
                        className="h-7 w-7 shrink-0 text-[#F97316]"
                      />
                      <div className="min-w-0 text-base font-extrabold leading-tight">
                        {item.text || "Stat text preview"}
                      </div>
                    </div>
                    <Field
                      label="Text"
                      value={item.text}
                      onChange={(text) => onItemChange({ ...item, text })}
                    />
                    <IconSelectField
                      label="Icon"
                      value={normalizeHomeStatsIconKey(item.icon)}
                      onChange={(icon) => onItemChange({ ...item, icon })}
                    />
                    <Field
                      label="Sort order"
                      value={String(item.sort_order)}
                      onChange={(value) => {
                        const parsed = Number(value);
                        onItemChange({
                          ...item,
                          sort_order: Number.isFinite(parsed) ? parsed : item.sort_order,
                        });
                      }}
                    />
                    <CheckboxField
                      label="Active"
                      checked={item.active}
                      onChange={(active) => onItemChange({ ...item, active })}
                    />
                  </div>
                )}
              />
            </div>
          </div>
        </div>
      );
    }

    if (resolvedHomeSectionId === "marketing") {
      return (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-base font-semibold text-slate-900">Marketing sections</div>
              <div className="mt-1 text-sm text-slate-500">
                Add, remove, and edit the marketing sections shown on the Home page.
              </div>
            </div>
            <LoadingButton
              type="button"
              onClick={() => addHomeSection("card_grid")}
              loading={addingMarketingSection}
              loadingLabel="Adding..."
              spinner={false}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Add Marketing Section
            </LoadingButton>
          </div>

          <div className="space-y-8">
            {homeSectionsValue.map((section, index) => {
              const expanded = expandedMarketingSections[section.id] ?? true;
              const sectionLabel = section.sectionTitle || `Marketing Section ${index + 1}`;

              return (
                <div
                  key={section.id}
                  ref={(node) => {
                    marketingSectionRefs.current[section.id] = node;
                  }}
                  className={[
                    "overflow-hidden rounded-[14px] border border-slate-300 bg-slate-100 shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition",
                    highlightedSectionId === section.id
                      ? "ring-2 ring-amber-200 ring-offset-2 ring-offset-white"
                      : "",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-slate-300/70 bg-slate-100 px-5 py-4">
                    <button
                      type="button"
                      onClick={() => toggleMarketingSection(section.id)}
                      className="min-w-0 text-left"
                    >
                      <div className="text-sm font-semibold text-slate-900">{sectionLabel}</div>
                      <div className="text-sm text-slate-500">
                        {expanded ? "Hide section details" : "Show section details"}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeHomeSection(section.id)}
                      className="shrink-0 text-xs font-semibold text-rose-600"
                    >
                      Remove
                    </button>
                  </div>

                  {expanded ? (
                    <div className="bg-slate-50/50 px-5 py-5">
                      <div className="space-y-6">
                        <Field
                          label="Section Caption"
                          value={section.caption}
                          onChange={(value) => updateActiveHomeSection({ ...section, caption: value })}
                        />
                        <Field
                          label="Heading"
                          value={section.sectionTitle}
                          onChange={(value) => updateActiveHomeSection({ ...section, sectionTitle: value })}
                          highlight={highlightedSectionId === section.id}
                        />
                        <TextAreaField
                          label="Section intro"
                          value={section.intro}
                          onChange={(value) => updateActiveHomeSection({ ...section, intro: value })}
                        />
                        {section.type === "card_grid" ? (
                          <RepeatableItems<HomeCardGridItem>
                            label="Items"
                            items={section.items}
                            createItem={() => ({
                              label: "",
                              headline: "",
                              body: "",
                              icon: getDefaultMarketingIconKey(section.type, section.items.length),
                            })}
                            onChange={(items) => updateActiveHomeSection({ ...section, items })}
                            renderItem={(item, onItemChange) => (
                              <div className="grid gap-3">
                                <IconSelectField
                                  label="Icon"
                                  value={normalizeHomeStatsIconKey(item.icon)}
                                  onChange={(value) => onItemChange({ ...item, icon: value })}
                                />
                                <Field
                                  label="Label"
                                  value={String(item.label ?? "")}
                                  onChange={(value) => onItemChange({ ...item, label: value })}
                                />
                                <Field
                                  label="Title"
                                  value={getMarketingItemTitle(section, item)}
                                  onChange={(value) => onItemChange(setMarketingItemTitle(section, item, value))}
                                />
                                <TextAreaField
                                  label="Body"
                                  value={String(item.body ?? "")}
                                  onChange={(value) => onItemChange({ ...item, body: value })}
                                />
                              </div>
                            )}
                          />
                        ) : (
                          <RepeatableItems<HomeStepsItem>
                            label="Items"
                            items={section.items}
                            createItem={() => ({
                              label: "",
                              title: "",
                              body: "",
                              icon: getDefaultMarketingIconKey(section.type, section.items.length),
                            })}
                            onChange={(items) => updateActiveHomeSection({ ...section, items })}
                            renderItem={(item, onItemChange) => (
                              <div className="grid gap-3">
                                <IconSelectField
                                  label="Icon"
                                  value={normalizeHomeStatsIconKey(item.icon)}
                                  onChange={(value) => onItemChange({ ...item, icon: value })}
                                />
                                <Field
                                  label="Label"
                                  value={String(item.label ?? "")}
                                  onChange={(value) => onItemChange({ ...item, label: value })}
                                />
                                <Field
                                  label="Title"
                                  value={getMarketingItemTitle(section, item)}
                                  onChange={(value) => onItemChange(setMarketingItemTitle(section, item, value))}
                                />
                                <TextAreaField
                                  label="Body"
                                  value={String(item.body ?? "")}
                                  onChange={(value) => onItemChange({ ...item, body: value })}
                                />
                              </div>
                            )}
                          />
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {!homeSectionsValue.length ? (
            <div className="rounded-[14px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No marketing sections yet. Add one to get started.
            </div>
          ) : null}
        </div>
      );
    }

    if (resolvedHomeSectionId === "dumpster-sizes") {
      return (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-[14px] border border-slate-300 bg-slate-100 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-300/70 bg-slate-100 px-5 py-4">
              <div className="text-sm font-semibold text-slate-900">Dumpster Sizes</div>
              <div className="mt-1 text-sm text-slate-500">
                Add the dumpster sizes shown between the marketing sections and service area.
              </div>
            </div>
            <div className="space-y-5 bg-slate-50/50 px-5 py-5">
              <CheckboxField
                label="Show dumpster sizes section"
                checked={dumpsterSizesValue.showDumpsterSizesSection}
                onChange={(showDumpsterSizesSection) => updateDumpsterSizes({ showDumpsterSizesSection })}
              />
              <Field
                label="Section label"
                value={dumpsterSizesValue.dumpsterSizesEyebrow}
                onChange={(dumpsterSizesEyebrow) => updateDumpsterSizes({ dumpsterSizesEyebrow })}
              />
              <Field
                label="Section title"
                value={dumpsterSizesValue.dumpsterSizesTitle}
                onChange={(dumpsterSizesTitle) => updateDumpsterSizes({ dumpsterSizesTitle })}
              />
              <TextAreaField
                label="Section intro"
                value={dumpsterSizesValue.dumpsterSizesIntro}
                onChange={(dumpsterSizesIntro) => updateDumpsterSizes({ dumpsterSizesIntro })}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-slate-300 bg-slate-100 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-300/70 bg-slate-100 px-5 py-4">
              <div className="text-sm font-semibold text-slate-900">Dumpster size items</div>
              <div className="mt-1 text-sm text-slate-500">
                One size renders as a large feature layout. Multiple sizes render as selectable cards.
              </div>
            </div>
            <div className="bg-slate-50/50 px-5 py-5">
              <RepeatableItems<HomeDumpsterSizeItem>
                label="Dumpster sizes"
                items={dumpsterSizesValue.dumpsterSizes}
                createItem={createDefaultDumpsterSizeItem}
                onChange={(dumpsterSizes) => updateDumpsterSizes({ dumpsterSizes })}
                itemsClassName="space-y-6"
                itemClassName="space-y-4 rounded-[14px] border border-slate-300/80 bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.05)]"
                renderItem={(item, onItemChange) => (
                  <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field
                        label="Dumpster size in yards"
                        value={item.sizeYards === null ? "" : String(item.sizeYards)}
                        onChange={(value) => onItemChange({ ...item, sizeYards: parseOptionalNumber(value) })}
                      />
                      <Field
                        label="Optional badge"
                        value={item.badgeLabel}
                        onChange={(badgeLabel) => onItemChange({ ...item, badgeLabel })}
                      />
                    </div>
                    <Field
                      label="Display title"
                      value={item.title}
                      onChange={(title) => onItemChange({ ...item, title })}
                    />
                    <TextAreaField
                      label="Short description"
                      value={item.shortDescription}
                      onChange={(shortDescription) => onItemChange({ ...item, shortDescription })}
                    />
                    <TextAreaField
                      label="Long description"
                      value={item.longDescription}
                      onChange={(longDescription) => onItemChange({ ...item, longDescription })}
                    />
                    <ArrayField
                      label="Common uses / checklist"
                      items={item.checklistItems}
                      onChange={(checklistItems) => onItemChange({ ...item, checklistItems })}
                    />
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field
                        label="Dumpster dimensions"
                        value={item.dimensions}
                        onChange={(dimensions) => onItemChange({ ...item, dimensions })}
                      />
                      <Field
                        label="Weight included"
                        value={item.weightIncluded}
                        onChange={(weightIncluded) => onItemChange({ ...item, weightIncluded })}
                      />
                      <Field
                        label="Typical rental window in days"
                        value={item.rentalWindowDays === null ? "" : String(item.rentalWindowDays)}
                        onChange={(value) => onItemChange({ ...item, rentalWindowDays: parseOptionalNumber(value) })}
                      />
                    </div>
                    <CheckboxField
                      label="Featured/default size"
                      checked={item.isFeatured}
                      onChange={(isFeatured) => onItemChange({ ...item, isFeatured })}
                    />
                    <p className="text-xs text-slate-500">
                      If multiple sizes are featured, the first featured size is used as the default.
                    </p>
                  </div>
                )}
              />
            </div>
          </div>
        </div>
      );
    }

    if (resolvedHomeSectionId === "service-area-lookup") {
      return (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-[14px] border border-slate-300 bg-slate-100 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-300/70 bg-slate-100 px-5 py-4">
              <div className="text-sm font-semibold text-slate-900">Service area lookup</div>
              <div className="mt-1 text-sm text-slate-500">
                Edit the ZIP lookup section shown above the Home page FAQ.
              </div>
            </div>
            <div className="space-y-5 bg-slate-50/50 px-5 py-5">
              <CheckboxField
                label="Show service area lookup"
                checked={serviceAreaLookupValue.enabled}
                onChange={(enabled) => updateServiceAreaLookup({ enabled })}
              />
              <Field
                label="Eyebrow"
                value={serviceAreaLookupValue.eyebrow}
                onChange={(eyebrow) => updateServiceAreaLookup({ eyebrow })}
              />
              <Field
                label="Headline"
                value={serviceAreaLookupValue.headline}
                onChange={(headline) => updateServiceAreaLookup({ headline })}
              />
              <TextAreaField
                label="Description"
                value={serviceAreaLookupValue.description}
                onChange={(description) => updateServiceAreaLookup({ description })}
              />
              <Field
                label="ZIP input placeholder"
                value={serviceAreaLookupValue.zipPlaceholder}
                onChange={(zipPlaceholder) => updateServiceAreaLookup({ zipPlaceholder })}
              />
              <Field
                label="Button text"
                value={serviceAreaLookupValue.buttonText}
                onChange={(buttonText) => updateServiceAreaLookup({ buttonText })}
              />
              <Field
                label="Right-side eyebrow"
                value={serviceAreaLookupValue.areasEyebrow}
                onChange={(areasEyebrow) => updateServiceAreaLookup({ areasEyebrow })}
              />
              <ArrayField
                label="Area pill labels"
                items={serviceAreaLookupValue.areaPills}
                onChange={(areaPills) => updateServiceAreaLookup({ areaPills })}
              />
              <Field
                label="Helper text under pills"
                value={serviceAreaLookupValue.helperText}
                onChange={(helperText) => updateServiceAreaLookup({ helperText })}
              />
            </div>
          </div>
        </div>
      );
    }

    if (resolvedHomeSectionId === "faq") {
      return (
        <div className="space-y-5">
          <Field label="Section heading" value={faqValue.headline} onChange={(value) => updateFaq({ headline: value })} />
          <TextAreaField label="Section intro" value={faqValue.intro} onChange={(value) => updateFaq({ intro: value })} />
          <div className="overflow-hidden rounded-[14px] border border-slate-300 bg-slate-100 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-300/70 bg-slate-100 px-5 py-4">
              <div className="text-sm font-semibold text-slate-900">FAQ items</div>
              <div className="mt-1 text-sm text-slate-500">
                Add, remove, and edit the questions shown on the Home page.
              </div>
            </div>
            <div className="bg-slate-50/50 px-5 py-5">
              <RepeatableItems
                label="FAQ items"
                items={faqValue.items}
                createItem={() => ({ question: "", answer: "" })}
                onChange={(items) => updateFaq({ items })}
                itemsClassName="space-y-6"
                itemClassName="space-y-3 rounded-[14px] border border-slate-300/80 bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.05)]"
                renderItem={(item, onItemChange) => (
                  <div className="grid gap-3">
                    <Field
                      label="Question"
                      value={String(item.question ?? "")}
                      onChange={(value) => onItemChange({ ...item, question: value })}
                    />
                    <TextAreaField
                      label="Answer"
                      value={String(item.answer ?? "")}
                      onChange={(value) => onItemChange({ ...item, answer: value })}
                    />
                  </div>
                )}
              />
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  function renderPricingPage() {
    return (
      <div className="space-y-8">
        <div className="space-y-5">
          <Field
            label="Section"
            value="Product Content"
            onChange={() => undefined}
            readOnly
          />
          <TextAreaField
            label="Product description"
            value={pricingValue.description}
            onChange={(value) => updatePricing({ description: value })}
          />
          <ArrayField
            label="Feature bullets"
            items={pricingValue.featureBullets}
            onChange={(items) => updatePricing({ featureBullets: items })}
          />
          <Field
            label="Included heading"
            value={pricingValue.includedHeading}
            onChange={(value) => updatePricing({ includedHeading: value })}
          />
          <ArrayField
            label="Included items"
            items={pricingValue.includedItems}
            onChange={(items) => updatePricing({ includedItems: items })}
          />
          <TextAreaField
            label="Bottom note"
            value={pricingValue.bottomNote}
            onChange={(value) => updatePricing({ bottomNote: value })}
          />
        </div>

        <div className="overflow-hidden rounded-[14px] border border-slate-300 bg-slate-100 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-300/70 bg-slate-100 px-5 py-4">
            <div className="text-sm font-semibold text-slate-900">Pricing size guide</div>
            <div className="mt-1 text-sm text-slate-500">
              Edit the helper shown above the dumpster pricing cards.
            </div>
          </div>
          <div className="space-y-5 bg-slate-50/50 px-5 py-5">
            <CheckboxField
              label="Show size guide on pricing page"
              checked={pricingValue.sizeGuide.enabled}
              onChange={(enabled) => updatePricingSizeGuide({ enabled })}
            />
            <Field
              label="Size guide button text"
              value={pricingValue.sizeGuide.buttonText}
              onChange={(buttonText) => updatePricingSizeGuide({ buttonText })}
            />
            <Field
              label="Size guide title"
              value={pricingValue.sizeGuide.title}
              onChange={(title) => updatePricingSizeGuide({ title })}
            />

            <RepeatableItems<PricingSizeGuideRow>
              label="Size guide rows"
              items={pricingValue.sizeGuide.rows}
              createItem={() => createDefaultSizeGuideRow(pricingValue.sizeGuide.rows.length + 1)}
              onChange={(rows) => updatePricingSizeGuide({ rows })}
              itemsClassName="space-y-6"
              itemClassName="space-y-4 rounded-[14px] border border-slate-300/80 bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.05)]"
              renderItem={(item, onItemChange) => (
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px_120px]">
                    <Field
                      label="Size label"
                      value={item.sizeLabel}
                      onChange={(sizeLabel) => onItemChange({ ...item, sizeLabel })}
                    />
                    <Field
                      label="Truck-load estimate"
                      value={item.truckLoadEstimate}
                      onChange={(truckLoadEstimate) => onItemChange({ ...item, truckLoadEstimate })}
                    />
                    <Field
                      label="Sort order"
                      value={String(item.sortOrder)}
                      onChange={(value) => {
                        const parsed = Number(value);
                        onItemChange({
                          ...item,
                          sortOrder: Number.isFinite(parsed) ? parsed : item.sortOrder,
                        });
                      }}
                    />
                  </div>
                  <TextAreaField
                    label="Description / examples"
                    value={item.description}
                    onChange={(description) => onItemChange({ ...item, description })}
                  />
                  <CheckboxField
                    label="Active"
                    checked={item.active}
                    onChange={(active) => onItemChange({ ...item, active })}
                  />
                </div>
              )}
            />
          </div>
        </div>
      </div>
    );
  }

  function renderTermsPage() {
    return (
      <div className="space-y-5">
        <Field
          label="Section"
          value="Terms & Conditions"
          onChange={() => undefined}
          readOnly
        />
        <TextAreaField
          label="Terms & Conditions text"
          value={termsValue.body}
          onChange={(value) => updateTerms({ body: value })}
          helperText="This text appears on the customer confirmation page before payment/booking completion."
          rows={16}
        />
      </div>
    );
  }

  const stateLabel = pageDirty
    ? "Draft"
    : saveState === "saved"
      ? "Draft"
      : currentPageStatus.hasDraft
        ? "Draft"
        : "Published";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => switchPage("home")} className={pageTabClass(activePage === "home")}>
          Home
        </button>
        <button type="button" onClick={() => switchPage("pricing")} className={pageTabClass(activePage === "pricing")}>
          Pricing
        </button>
        <button type="button" onClick={() => switchPage("terms")} className={pageTabClass(activePage === "terms")}>
          Terms & Conditions
        </button>
      </div>

      {error ? (
        <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {activePage === "home" ? (
        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
            <div className="border-b border-slate-100 pb-3">
              <div className="text-sm font-semibold text-slate-900">Home sections</div>
              <div className="mt-1 text-sm text-slate-500">Select a section to edit.</div>
            </div>
            <div className="mt-3 space-y-1">
              {homeSectionOptions.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveHomeSectionId(section.id)}
                  className={sectionTabClass(section.id === resolvedHomeSectionId)}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-[20px] border border-slate-300 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      stateLabel === "Published"
                        ? "bg-slate-100 text-slate-700"
                        : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                    }`}
                  >
                    {stateLabel}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  Last published {formatDateTime(currentPageStatus.publishedUpdatedAt)}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <LoadingButton
                  type="button"
                  onClick={() => void persistPage("save_draft")}
                  loading={saveState === "saving"}
                  loadingLabel="Saving..."
                  disabled={saveState === "publishing"}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Save Draft
                </LoadingButton>
                <LoadingButton
                  type="button"
                  onClick={() => void handlePreview()}
                  loading={saveState === "saving"}
                  loadingLabel="Preparing..."
                  disabled={saveState === "publishing"}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Preview
                </LoadingButton>
                <LoadingButton
                  type="button"
                  onClick={() => {
                    if (!window.confirm("Publish the current page to the live retail site?")) return;
                    void persistPage("publish");
                  }}
                  loading={saveState === "publishing"}
                  loadingLabel="Publishing..."
                  disabled={saveState === "saving"}
                  className="admin-btn admin-btn-primary h-10 px-4"
                >
                  Publish Page
                </LoadingButton>
              </div>
            </div>

            <div className="pt-6">{renderHomeActiveSection()}</div>
          </section>
        </div>
      ) : (
        <section className="rounded-[20px] border border-slate-300 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    stateLabel === "Published"
                      ? "bg-slate-100 text-slate-700"
                      : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                  }`}
                >
                  {stateLabel}
                </span>
              </div>
              <div className="mt-2 text-sm text-slate-500">
                Last published {formatDateTime(currentPageStatus.publishedUpdatedAt)}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <LoadingButton
                type="button"
                onClick={() => void persistPage("save_draft")}
                loading={saveState === "saving"}
                loadingLabel="Saving..."
                disabled={saveState === "publishing"}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Save Draft
              </LoadingButton>
              <LoadingButton
                type="button"
                onClick={() => void handlePreview()}
                loading={saveState === "saving"}
                loadingLabel="Preparing..."
                disabled={saveState === "publishing"}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Preview
              </LoadingButton>
              <LoadingButton
                type="button"
                onClick={() => {
                  if (!window.confirm("Publish the current page to the live retail site?")) return;
                  void persistPage("publish");
                }}
                loading={saveState === "publishing"}
                loadingLabel="Publishing..."
                disabled={saveState === "saving"}
                className="admin-btn admin-btn-primary h-10 px-4"
              >
                Publish Page
              </LoadingButton>
            </div>
          </div>

          <div className="pt-6">{activePage === "pricing" ? renderPricingPage() : renderTermsPage()}</div>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly = false,
  inputRef,
  highlight = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  highlight?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <input
        ref={inputRef}
        className={[inputClass(), highlight ? "border-amber-300 bg-amber-50/40 ring-4 ring-amber-100" : ""].join(
          " ",
        )}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function HeroImageUploadField({
  imageUrl,
  imageAlt,
  inputRef,
  uploading,
  success,
  error,
  onFileSelected,
}: {
  imageUrl: string;
  imageAlt: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  uploading: boolean;
  success: string | null;
  error: string | null;
  onFileSelected: (file: File) => void;
}) {
  const trimmedImageUrl = imageUrl.trim();

  return (
    <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-medium text-slate-700">Image upload</div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelected(file);
        }}
        className="mt-3 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <p className="mt-2 text-sm text-slate-500">
        Upload a JPG, PNG, or WEBP hero image. Recommended: wide landscape image.
      </p>

      {uploading ? <p className="mt-3 text-sm text-slate-500">Uploading image...</p> : null}
      {success ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {trimmedImageUrl ? (
        <div className="mt-4 overflow-hidden rounded-[14px] border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Current image
          </div>
          <div className="bg-slate-100 p-3">
            <div className="relative aspect-[16/7] w-full overflow-hidden rounded-lg">
              <Image
                src={trimmedImageUrl}
                alt={imageAlt || "Hero image preview"}
                fill
                sizes="(min-width: 1280px) 780px, 100vw"
                className="object-cover"
                unoptimized
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  helperText,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  rows?: number;
}) {
  return (
    <label className="block space-y-2">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <textarea
        className={textareaClass()}
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
      />
      {helperText ? <p className="text-sm text-slate-500">{helperText}</p> : null}
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-[14px] border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 rounded border-slate-300 accent-[#F97316]"
      />
    </label>
  );
}

function IconSelectField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: HomeStatsIconKey;
  onChange: (value: HomeStatsIconKey) => void;
}) {
  return (
    <label className="block space-y-2">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[#F97316]">
          <HomeStatsIcon iconKey={value} className="h-6 w-6" />
        </span>
        <select
          className={inputClass()}
          value={value}
          onChange={(event) => onChange(normalizeHomeStatsIconKey(event.target.value))}
        >
          {HOME_STATS_ICON_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function ArrayField({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (pendingIndex === null) return;

    const itemElement = itemRefs.current[pendingIndex];
    if (!itemElement) return;

    const frame = requestAnimationFrame(() => {
      scrollElementIntoComfortableView(itemElement);
      focusFirstEditableField(itemElement);
      setHighlightedIndex(pendingIndex);
      setPendingIndex(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [items, pendingIndex]);

  useEffect(() => {
    if (highlightedIndex === null) return;

    const timeout = window.setTimeout(() => setHighlightedIndex(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [highlightedIndex]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-700">{label}</div>
        <LoadingButton
          type="button"
          onClick={() => {
            if (pendingIndex !== null) return;
            setPendingIndex(items.length);
            onChange([...items, ""]);
          }}
          loading={pendingIndex !== null}
          loadingLabel="Adding..."
          spinner={false}
          className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Add item
        </LoadingButton>
      </div>

      {items.map((item, index) => (
        <div
          key={`${label}-${index}`}
          ref={(node) => {
            itemRefs.current[index] = node;
          }}
          className={[
            "flex items-center gap-3 rounded-[14px] transition",
            highlightedIndex === index ? "bg-amber-50/60 ring-2 ring-amber-200 ring-offset-2 ring-offset-white" : "",
          ].join(" ")}
        >
          <input
            className={inputClass()}
            value={item}
            onChange={(event) => {
              const nextItems = [...items];
              nextItems[index] = event.target.value;
              onChange(nextItems);
            }}
          />
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => {
                const nextItems = [...items];
                [nextItems[index - 1], nextItems[index]] = [nextItems[index], nextItems[index - 1]];
                onChange(nextItems);
              }}
              className="rounded-[4px] px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Up
            </button>
            <button
              type="button"
              disabled={index === items.length - 1}
              onClick={() => {
                const nextItems = [...items];
                [nextItems[index + 1], nextItems[index]] = [nextItems[index], nextItems[index + 1]];
                onChange(nextItems);
              }}
              className="rounded-[4px] px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Down
            </button>
          </div>
          {items.length > 1 ? (
            <button
              type="button"
              onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
              className="text-xs font-semibold text-rose-600"
            >
              Remove
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function RepeatableItems<TItem extends object>({
  label,
  items,
  createItem,
  onChange,
  itemsClassName = "space-y-4",
  itemClassName = "space-y-3 rounded-[14px] border border-slate-300/80 bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.05)]",
  renderItem,
}: {
  label: string;
  items: TItem[];
  createItem: () => TItem;
  onChange: (items: TItem[]) => void;
  itemsClassName?: string;
  itemClassName?: string;
  renderItem: (
    item: TItem,
    onItemChange: (nextItem: TItem) => void,
  ) => React.ReactNode;
}) {
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (pendingIndex === null) return;

    const itemElement = itemRefs.current[pendingIndex];
    if (!itemElement) return;

    const frame = requestAnimationFrame(() => {
      scrollElementIntoComfortableView(itemElement);
      focusFirstEditableField(itemElement);
      setHighlightedIndex(pendingIndex);
      setPendingIndex(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [items, pendingIndex]);

  useEffect(() => {
    if (highlightedIndex === null) return;

    const timeout = window.setTimeout(() => setHighlightedIndex(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [highlightedIndex]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-700">{label}</div>
        <LoadingButton
          type="button"
          onClick={() => {
            if (pendingIndex !== null) return;
            setPendingIndex(items.length);
            onChange([...items, createItem()]);
          }}
          loading={pendingIndex !== null}
          loadingLabel="Adding..."
          spinner={false}
          className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Add item
        </LoadingButton>
      </div>

      <div className={itemsClassName}>
        {items.map((item, index) => (
          <div
            key={index}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            className={[
              itemClassName,
              highlightedIndex === index ? "ring-2 ring-amber-200 ring-offset-2 ring-offset-slate-50" : "",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Item {index + 1}</div>
              {items.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                  className="text-xs font-semibold text-rose-600"
                >
                  Remove
                </button>
              ) : null}
            </div>
            {renderItem(item, (nextItem) => {
              const nextItems = [...items];
              nextItems[index] = nextItem;
              onChange(nextItems);
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
