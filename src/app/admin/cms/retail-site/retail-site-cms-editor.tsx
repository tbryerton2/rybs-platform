"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CmsEntryStatus,
  HomeFlexibleSection,
  HomeFaqValue,
  HomeHeroValue,
  HomeServiceAreaPopupValue,
  PricingProductContentValue,
  RetailSiteCmsState,
} from "@/lib/admin/cms";
import { LoadingButton } from "@/components/ui/loading-button";

const HOME_HERO_KEY = "content.home.hero";
const HOME_SECTIONS_KEY = "content.home.sections";
const HOME_SERVICE_AREA_KEY = "content.home.service_area_popup";
const HOME_FAQ_KEY = "content.faq.home";
const PRICING_PRODUCT_KEY = "content.pricing.product_content";

const HOME_PAGE_KEYS = [HOME_HERO_KEY, HOME_SECTIONS_KEY, HOME_SERVICE_AREA_KEY, HOME_FAQ_KEY];
const PRICING_PAGE_KEYS = [PRICING_PRODUCT_KEY];

type CmsPageId = "home" | "pricing";

type RetailSiteCmsEditorProps = {
  cms: RetailSiteCmsState;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function createSectionId(type: HomeFlexibleSection["type"]) {
  return `${type}_${Math.random().toString(36).slice(2, 10)}`;
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
  return "h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10";
}

function textareaClass() {
  return "min-h-[110px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10";
}

function pageTabClass(active: boolean) {
  return [
    "rounded-2xl px-4 py-2 text-sm font-semibold transition",
    active
      ? "bg-slate-900 text-white shadow-sm"
      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900",
  ].join(" ");
}

function sectionTabClass(active: boolean) {
  return [
    "w-full rounded-xl px-3 py-2.5 text-left text-sm transition",
    active
      ? "bg-slate-100 text-slate-900"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
  ].join(" ");
}

export default function RetailSiteCmsEditor({ cms }: RetailSiteCmsEditorProps) {
  const initialValuesByKey = useMemo(
    () => ({
      [HOME_HERO_KEY]: clone(cms.home.hero.value),
      [HOME_SECTIONS_KEY]: clone(cms.home.sections.value),
      [HOME_SERVICE_AREA_KEY]: clone(cms.home.serviceAreaPopup.value),
      [HOME_FAQ_KEY]: clone(cms.home.faq.value),
      [PRICING_PRODUCT_KEY]: clone(cms.pricing.productContent.value),
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
      [HOME_SECTIONS_KEY]: {
        hasDraft: cms.home.sections.hasDraft,
        draftUpdatedAt: cms.home.sections.draftUpdatedAt,
        publishedUpdatedAt: cms.home.sections.publishedUpdatedAt,
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
  const marketingSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const homeHeroValue = (valuesByKey[HOME_HERO_KEY] as HomeHeroValue | undefined) ?? cms.home.hero.value;
  const homeSectionsValue =
    (valuesByKey[HOME_SECTIONS_KEY] as HomeFlexibleSection[] | undefined) ?? cms.home.sections.value;
  const serviceAreaValue =
    (valuesByKey[HOME_SERVICE_AREA_KEY] as HomeServiceAreaPopupValue | undefined) ??
    cms.home.serviceAreaPopup.value;
  const faqValue = (valuesByKey[HOME_FAQ_KEY] as HomeFaqValue | undefined) ?? cms.home.faq.value;
  const pricingValue =
    (valuesByKey[PRICING_PRODUCT_KEY] as PricingProductContentValue | undefined) ??
    cms.pricing.productContent.value;

  const homeSectionOptions = [
    { id: "hero", label: "Hero" },
    { id: "marketing", label: "Marketing" },
    { id: "faq", label: "FAQ" },
  ];

  const resolvedHomeSectionId =
    activePage === "home" && homeSectionOptions.some((section) => section.id === activeHomeSectionId)
      ? activeHomeSectionId
      : homeSectionOptions[0]?.id ?? "hero";

  const currentPageKeys = activePage === "home" ? HOME_PAGE_KEYS : PRICING_PAGE_KEYS;
  const pageDirty = currentPageKeys.some(
    (key) => JSON.stringify(valuesByKey[key]) !== JSON.stringify(savedByKey[key]),
  );
  const anyDirty = [...HOME_PAGE_KEYS, ...PRICING_PAGE_KEYS].some(
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

  function updateServiceArea(patch: Partial<HomeServiceAreaPopupValue>) {
    updateValue(HOME_SERVICE_AREA_KEY, { ...serviceAreaValue, ...patch });
  }

  function updateFaq(patch: Partial<HomeFaqValue>) {
    updateValue(HOME_FAQ_KEY, { ...faqValue, ...patch });
  }

  function updatePricing(patch: Partial<PricingProductContentValue>) {
    updateValue(PRICING_PRODUCT_KEY, { ...pricingValue, ...patch });
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
            sectionTitle: "",
            intro: "",
            items: [{ label: "", headline: "", body: "" }],
          }
        : {
            id: createSectionId(type),
            type,
            sectionTitle: "",
            intro: "",
            items: [{ label: "", title: "", body: "" }],
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

  function getMarketingItemTitle(
    section: HomeFlexibleSection,
    item: HomeFlexibleSection["items"][number],
  ) {
    return section.type === "card_grid" ? String(item.headline ?? "") : String(item.title ?? "");
  }

  function setMarketingItemTitle(
    section: HomeFlexibleSection,
    item: HomeFlexibleSection["items"][number],
    value: string,
  ) {
    return section.type === "card_grid" ? { ...item, headline: value } : { ...item, title: value };
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

    const redirect = activePage === "pricing" ? "/pricing" : "/";
    window.open(`/admin/cms/preview?redirect=${encodeURIComponent(redirect)}`, "_blank", "noopener,noreferrer");
  }

  function renderHomeActiveSection() {
    if (resolvedHomeSectionId === "hero") {
      return (
        <div className="space-y-5">
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
            label="Hero image URL"
            value={homeHeroValue.imageUrl}
            onChange={(value) => updateHero({ imageUrl: value })}
          />
          <Field
            label="Hero image alt text"
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
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
                    "overflow-hidden rounded-[22px] border border-slate-300 bg-slate-100 shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition",
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
                        <RepeatableItems
                          label="Items"
                          items={section.items}
                          createItem={() =>
                            section.type === "card_grid"
                              ? { label: "", headline: "", body: "" }
                              : { label: "", title: "", body: "" }
                          }
                          onChange={(items) => updateActiveHomeSection({ ...section, items })}
                          renderItem={(item, onItemChange) => (
                            <div className="grid gap-3">
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
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {!homeSectionsValue.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No marketing sections yet. Add one to get started.
            </div>
          ) : null}
        </div>
      );
    }

    if (resolvedHomeSectionId === "faq") {
      return (
        <div className="space-y-5">
          <Field label="Section heading" value={faqValue.headline} onChange={(value) => updateFaq({ headline: value })} />
          <TextAreaField label="Section intro" value={faqValue.intro} onChange={(value) => updateFaq({ intro: value })} />
          <div className="overflow-hidden rounded-[22px] border border-slate-300 bg-slate-100 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
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
                itemClassName="space-y-3 rounded-2xl border border-slate-300/80 bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.05)]"
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
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {activePage === "home" ? (
        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
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

          <section className="rounded-[28px] border border-slate-300 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
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
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Save Draft
                </LoadingButton>
                <LoadingButton
                  type="button"
                  onClick={() => void handlePreview()}
                  loading={saveState === "saving"}
                  loadingLabel="Preparing..."
                  disabled={saveState === "publishing"}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
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
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[#F97316] px-4 text-sm font-semibold text-white transition hover:bg-[#EA580C] disabled:opacity-60"
                >
                  Publish Page
                </LoadingButton>
              </div>
            </div>

            <div className="pt-6">{renderHomeActiveSection()}</div>
          </section>
        </div>
      ) : (
        <section className="rounded-[28px] border border-slate-300 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
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
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Save Draft
              </LoadingButton>
              <LoadingButton
                type="button"
                onClick={() => void handlePreview()}
                loading={saveState === "saving"}
                loadingLabel="Preparing..."
                disabled={saveState === "publishing"}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
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
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#F97316] px-4 text-sm font-semibold text-white transition hover:bg-[#EA580C] disabled:opacity-60"
              >
                Publish Page
              </LoadingButton>
            </div>
          </div>

          <div className="pt-6">{renderPricingPage()}</div>
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

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <textarea className={textareaClass()} value={value} onChange={(event) => onChange(event.target.value)} />
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
            "flex items-center gap-3 rounded-2xl transition",
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

function RepeatableItems({
  label,
  items,
  createItem,
  onChange,
  itemsClassName = "space-y-4",
  itemClassName = "space-y-3 rounded-2xl border border-slate-300/80 bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.05)]",
  renderItem,
}: {
  label: string;
  items: Array<Record<string, unknown>>;
  createItem: () => Record<string, unknown>;
  onChange: (items: Array<Record<string, unknown>>) => void;
  itemsClassName?: string;
  itemClassName?: string;
  renderItem: (
    item: Record<string, unknown>,
    onItemChange: (nextItem: Record<string, unknown>) => void,
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
