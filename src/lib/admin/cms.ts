import "server-only";

import {
  getTenantContentByStatus,
  getTenantContentDraftFirst,
  getTenantContentRowByStatus,
} from "@/lib/tenant/server";

export type CmsPageId = "home" | "pricing";
export type HomeSectionType = "card_grid" | "steps";

export type CmsEntryStatus = {
  hasDraft: boolean;
  draftUpdatedAt: string | null;
  publishedUpdatedAt: string | null;
};

export type CmsEntry<TValue> = CmsEntryStatus & {
  contentKey: string;
  value: TValue;
};

export type HomeHeroValue = {
  headlineLine1: string;
  headlineLine2: string;
  subheadline: string;
  imageUrl: string;
  imageAlt: string;
  trustBullets: string[];
};

export type HomeCardGridSection = {
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
};

export type HomeStepsSection = {
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
};

export type HomeFlexibleSection = HomeCardGridSection | HomeStepsSection;

export type HomeServiceAreaPopupValue = {
  title: string;
  intro: string;
  coverageTitle: string;
  coverageBullets: string[];
  bottomNote: string;
  buttonLabel: string;
};

export type HomeFaqValue = {
  headline: string;
  intro: string;
  items: Array<{
    question: string;
    answer: string;
  }>;
};

export type PricingProductContentValue = {
  description: string;
  featureBullets: string[];
  includedHeading: string;
  includedItems: string[];
  bottomNote: string;
};

export type RetailSiteCmsState = {
  home: {
    hero: CmsEntry<HomeHeroValue>;
    sections: CmsEntry<HomeFlexibleSection[]>;
    serviceAreaPopup: CmsEntry<HomeServiceAreaPopupValue>;
    faq: CmsEntry<HomeFaqValue>;
  };
  pricing: {
    productContent: CmsEntry<PricingProductContentValue>;
  };
};

export const CMS_PAGE_TABS: Array<{ id: CmsPageId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "pricing", label: "Pricing" },
];

export const RETAIL_SITE_CMS_CONTENT_KEYS = [
  "content.home.hero",
  "content.home.sections",
  "content.home.service_area_popup",
  "content.faq.home",
  "content.pricing.product_content",
] as const;

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown, fallbackLength = 0) {
  if (!Array.isArray(value)) {
    return Array.from({ length: fallbackLength }, () => "");
  }

  return value.map((item) => (typeof item === "string" ? item : ""));
}

function asRecordArray(value: unknown) {
  return Array.isArray(value) ? value.map(asObject) : [];
}

function latestTimestamp(...values: Array<string | null | undefined>) {
  const timestamps = values.filter((value): value is string => Boolean(value));
  if (!timestamps.length) return null;

  return timestamps.reduce((latest, current) => {
    return new Date(current).getTime() > new Date(latest).getTime() ? current : latest;
  });
}

function normalizeHero(rawValue: unknown): HomeHeroValue {
  const raw = asObject(rawValue);
  const trustBullets = asStringArray(raw.trustBullets ?? raw.trustItems, 3).slice(0, 3);

  while (trustBullets.length < 3) {
    trustBullets.push("");
  }

  return {
    headlineLine1: asString(raw.headlineLine1 ?? raw.headline),
    headlineLine2: asString(raw.headlineLine2),
    subheadline: asString(raw.subheadline),
    imageUrl: asString(raw.imageUrl, "/hero-dumpster.png"),
    imageAlt: asString(raw.imageAlt),
    trustBullets,
  };
}

function normalizeCardGridSection(rawValue: unknown, fallbackId: string): HomeCardGridSection {
  const raw = asObject(rawValue);

  return {
    id: asString(raw.id, fallbackId),
    type: "card_grid",
    caption: asString(raw.caption),
    sectionTitle: asString(raw.sectionTitle),
    intro: asString(raw.intro),
    items: asRecordArray(raw.items).map((item) => ({
      label: asString(item.label ?? item.title),
      headline: asString(item.headline),
      body: asString(item.body),
    })),
  };
}

function normalizeStepsSection(rawValue: unknown, fallbackId: string): HomeStepsSection {
  const raw = asObject(rawValue);

  return {
    id: asString(raw.id, fallbackId),
    type: "steps",
    caption: asString(raw.caption),
    sectionTitle: asString(raw.sectionTitle),
    intro: asString(raw.intro),
    items: asRecordArray(raw.items).map((item) => ({
      label: asString(item.label ?? item.stepLabel),
      title: asString(item.title),
      body: asString(item.body),
    })),
    footnote: asString(raw.footnote),
  };
}

function normalizeFlexibleSections(rawValue: unknown): HomeFlexibleSection[] {
  const source = Array.isArray(rawValue)
    ? rawValue
    : Array.isArray(asObject(rawValue).sections)
      ? (asObject(rawValue).sections as unknown[])
      : [];

  return source
    .map(asObject)
    .flatMap<HomeFlexibleSection>((item, index) => {
      const type = asString(item.type);

      if (type === "card_grid") {
        return [normalizeCardGridSection(item, `card-grid-${index + 1}`)];
      }

      if (type === "steps") {
        return [normalizeStepsSection(item, `steps-${index + 1}`)];
      }

      return [];
    });
}

function normalizeServiceAreaPopup(rawValue: unknown): HomeServiceAreaPopupValue {
  const raw = asObject(rawValue);
  const coverageBullets = asStringArray(raw.coverageBullets ?? raw.regionList, 1);

  return {
    title: asString(raw.title ?? raw.modalTitle),
    intro: asString(raw.intro ?? raw.modalIntro),
    coverageTitle: asString(raw.coverageTitle ?? raw.coverageHeading),
    coverageBullets: coverageBullets.length ? coverageBullets : [""],
    bottomNote: asString(raw.bottomNote ?? raw.coverageFootnote),
    buttonLabel: asString(raw.buttonLabel ?? raw.viewServiceAreaLabel),
  };
}

function normalizeFaq(rawValue: unknown): HomeFaqValue {
  const raw = asObject(rawValue);
  const items = asRecordArray(raw.items).map((item) => ({
    question: asString(item.question),
    answer: asString(item.answer),
  }));

  return {
    headline: asString(raw.headline),
    intro: asString(raw.intro),
    items: items.length ? items : [{ question: "", answer: "" }],
  };
}

function normalizePricingProductContent(rawValue: unknown): PricingProductContentValue {
  const raw = asObject(rawValue);
  const featureBullets = asStringArray(raw.featureBullets ?? raw.featureList, 1);
  const includedItems = asStringArray(raw.includedItems, 1);

  return {
    description: asString(raw.description ?? raw.productBody),
    featureBullets: featureBullets.length ? featureBullets : [""],
    includedHeading: asString(raw.includedHeading),
    includedItems: includedItems.length ? includedItems : [""],
    bottomNote: asString(raw.bottomNote ?? raw.footnote),
  };
}

async function getHomeSectionsEntry(): Promise<CmsEntry<HomeFlexibleSection[]>> {
  const [
    sectionsDraftRow,
    sectionsPublishedRow,
    sectionsValue,
    valuePropsDraftRow,
    valuePropsPublishedRow,
    valuePropsDraftValue,
    valuePropsPublishedValue,
    howDraftRow,
    howPublishedRow,
    howDraftValue,
    howPublishedValue,
  ] = await Promise.all([
    getTenantContentRowByStatus("content.home.sections", "draft"),
    getTenantContentRowByStatus("content.home.sections", "published"),
    getTenantContentDraftFirst("content.home.sections"),
    getTenantContentRowByStatus("content.home.value_props", "draft"),
    getTenantContentRowByStatus("content.home.value_props", "published"),
    getTenantContentByStatus("content.home.value_props", "draft"),
    getTenantContentByStatus("content.home.value_props", "published"),
    getTenantContentRowByStatus("content.home.how_it_works", "draft"),
    getTenantContentRowByStatus("content.home.how_it_works", "published"),
    getTenantContentByStatus("content.home.how_it_works", "draft"),
    getTenantContentByStatus("content.home.how_it_works", "published"),
  ]);

  if (sectionsValue !== undefined) {
    return {
      contentKey: "content.home.sections",
      hasDraft: Boolean(sectionsDraftRow),
      draftUpdatedAt: sectionsDraftRow?.updated_at ?? null,
      publishedUpdatedAt: sectionsPublishedRow?.updated_at ?? null,
      value: normalizeFlexibleSections(sectionsValue),
    };
  }

  const legacySections: HomeFlexibleSection[] = [];
  const valuePropsSource = valuePropsDraftValue ?? valuePropsPublishedValue;
  const howItWorksSource = howDraftValue ?? howPublishedValue;

  if (valuePropsSource !== undefined) {
    legacySections.push(normalizeCardGridSection(valuePropsSource, "why-choose-us"));
  }

  if (howItWorksSource !== undefined) {
    legacySections.push(normalizeStepsSection(howItWorksSource, "how-it-works"));
  }

  return {
    contentKey: "content.home.sections",
    hasDraft: Boolean(valuePropsDraftRow || howDraftRow),
    draftUpdatedAt: latestTimestamp(valuePropsDraftRow?.updated_at, howDraftRow?.updated_at),
    publishedUpdatedAt: latestTimestamp(valuePropsPublishedRow?.updated_at, howPublishedRow?.updated_at),
    value: legacySections,
  };
}

async function getHomeHeroEntry(): Promise<CmsEntry<HomeHeroValue>> {
  const [draftRow, publishedRow, value] = await Promise.all([
    getTenantContentRowByStatus("content.home.hero", "draft"),
    getTenantContentRowByStatus("content.home.hero", "published"),
    getTenantContentDraftFirst("content.home.hero"),
  ]);

  return {
    contentKey: "content.home.hero",
    hasDraft: Boolean(draftRow),
    draftUpdatedAt: draftRow?.updated_at ?? null,
    publishedUpdatedAt: publishedRow?.updated_at ?? null,
    value: normalizeHero(value),
  };
}

async function getServiceAreaPopupEntry(): Promise<CmsEntry<HomeServiceAreaPopupValue>> {
  const [draftRow, publishedRow, value, legacyDraftRow, legacyPublishedRow, legacyValue] = await Promise.all([
    getTenantContentRowByStatus("content.home.service_area_popup", "draft"),
    getTenantContentRowByStatus("content.home.service_area_popup", "published"),
    getTenantContentDraftFirst("content.home.service_area_popup"),
    getTenantContentRowByStatus("content.home.service_area", "draft"),
    getTenantContentRowByStatus("content.home.service_area", "published"),
    getTenantContentDraftFirst("content.home.service_area"),
  ]);

  return {
    contentKey: "content.home.service_area_popup",
    hasDraft: Boolean(draftRow || legacyDraftRow),
    draftUpdatedAt: draftRow?.updated_at ?? legacyDraftRow?.updated_at ?? null,
    publishedUpdatedAt: publishedRow?.updated_at ?? legacyPublishedRow?.updated_at ?? null,
    value: normalizeServiceAreaPopup(
      value ?? legacyValue,
    ),
  };
}

async function getHomeFaqEntry(): Promise<CmsEntry<HomeFaqValue>> {
  const [draftRow, publishedRow, value] = await Promise.all([
    getTenantContentRowByStatus("content.faq.home", "draft"),
    getTenantContentRowByStatus("content.faq.home", "published"),
    getTenantContentDraftFirst("content.faq.home"),
  ]);

  return {
    contentKey: "content.faq.home",
    hasDraft: Boolean(draftRow),
    draftUpdatedAt: draftRow?.updated_at ?? null,
    publishedUpdatedAt: publishedRow?.updated_at ?? null,
    value: normalizeFaq(value),
  };
}

async function getPricingProductContentEntry(): Promise<CmsEntry<PricingProductContentValue>> {
  const [draftRow, publishedRow, value, legacyDraftRow, legacyPublishedRow, legacyValue] = await Promise.all([
    getTenantContentRowByStatus("content.pricing.product_content", "draft"),
    getTenantContentRowByStatus("content.pricing.product_content", "published"),
    getTenantContentDraftFirst("content.pricing.product_content"),
    getTenantContentRowByStatus("content.pricing.promises", "draft"),
    getTenantContentRowByStatus("content.pricing.promises", "published"),
    getTenantContentDraftFirst("content.pricing.promises"),
  ]);

  return {
    contentKey: "content.pricing.product_content",
    hasDraft: Boolean(draftRow || legacyDraftRow),
    draftUpdatedAt: draftRow?.updated_at ?? legacyDraftRow?.updated_at ?? null,
    publishedUpdatedAt: publishedRow?.updated_at ?? legacyPublishedRow?.updated_at ?? null,
    value: normalizePricingProductContent(
      value ?? legacyValue,
    ),
  };
}

export async function getRetailSiteCmsInitialState(): Promise<RetailSiteCmsState> {
  const [hero, sections, serviceAreaPopup, faq, productContent] = await Promise.all([
    getHomeHeroEntry(),
    getHomeSectionsEntry(),
    getServiceAreaPopupEntry(),
    getHomeFaqEntry(),
    getPricingProductContentEntry(),
  ]);

  return {
    home: {
      hero,
      sections,
      serviceAreaPopup,
      faq,
    },
    pricing: {
      productContent,
    },
  };
}
