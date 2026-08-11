import "server-only";

import {
  getTenantContentByStatusForTenant,
  getTenantContentDraftFirstForTenant,
  getTenantContentRowByStatusForTenant,
} from "@/lib/tenant/server";
import { normalizeHomeStatsIconKey, type HomeStatsIconKey } from "@/lib/home-stats-icons";
import { RENTAL_TERMS_CONSENT_TEXT } from "@/lib/booking-terms";

export type CmsPageId = "home" | "pricing" | "terms";
export type HomeSectionType = "card_grid" | "steps";

export type CmsEntryStatus = {
  source: "default" | "draft" | "published";
  hasDraft: boolean;
  draftUpdatedAt: string | null;
  publishedUpdatedAt: string | null;
};

export type CmsEntry<TValue> = CmsEntryStatus & {
  contentKey: string;
  value: TValue;
};

export type HomeHeroValue = {
  eyebrow: string;
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
    icon: HomeStatsIconKey;
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
    icon: HomeStatsIconKey;
  }>;
  footnote: string;
};

export type HomeFlexibleSection = HomeCardGridSection | HomeStepsSection;

export type HomeStatsBarValue = {
  enabled: boolean;
  items: Array<{
    id: string;
    text: string;
    icon: HomeStatsIconKey;
    sort_order: number;
    active: boolean;
  }>;
};

export type HomeDumpsterSizeItem = {
  id: string;
  sizeYards: number | null;
  title: string;
  shortDescription: string;
  longDescription: string;
  checklistItems: string[];
  dimensions: string;
  weightIncluded: string;
  rentalWindowDays: number | null;
  badgeLabel: string;
  isFeatured: boolean;
};

export type HomeDumpsterSizesValue = {
  showDumpsterSizesSection: boolean;
  dumpsterSizesEyebrow: string;
  dumpsterSizesTitle: string;
  dumpsterSizesIntro: string;
  dumpsterSizes: HomeDumpsterSizeItem[];
};

export type HomeServiceAreaLookupValue = {
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
  sizeGuide: PricingSizeGuideValue;
};

export type PricingSizeGuideRow = {
  id: string;
  sizeLabel: string;
  truckLoadEstimate: string;
  description: string;
  sortOrder: number;
  active: boolean;
};

export type PricingSizeGuideValue = {
  enabled: boolean;
  buttonText: string;
  title: string;
  rows: PricingSizeGuideRow[];
};

export type TermsAndConditionsContentValue = {
  body: string;
};

export type RetailSiteCmsState = {
  home: {
    hero: CmsEntry<HomeHeroValue>;
    statsBar: CmsEntry<HomeStatsBarValue>;
    sections: CmsEntry<HomeFlexibleSection[]>;
    dumpsterSizes: CmsEntry<HomeDumpsterSizesValue>;
    serviceAreaLookup: CmsEntry<HomeServiceAreaLookupValue>;
    serviceAreaPopup: CmsEntry<HomeServiceAreaPopupValue>;
    faq: CmsEntry<HomeFaqValue>;
  };
  pricing: {
    productContent: CmsEntry<PricingProductContentValue>;
  };
  terms: {
    rentalTerms: CmsEntry<TermsAndConditionsContentValue>;
  };
};

export const CMS_PAGE_TABS: Array<{ id: CmsPageId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "pricing", label: "Pricing" },
  { id: "terms", label: "Terms & Conditions" },
];

export const RETAIL_SITE_CMS_CONTENT_KEYS = [
  "content.home.hero",
  "content.home.stats_bar",
  "content.home.sections",
  "content.home.dumpster_sizes",
  "content.home.service_area_lookup",
  "content.home.service_area_popup",
  "content.faq.home",
  "content.pricing.product_content",
  "content.terms.rental_terms",
] as const;

const TERMS_AND_CONDITIONS_DEFAULT: TermsAndConditionsContentValue = {
  body: RENTAL_TERMS_CONSENT_TEXT,
};

const HOME_STATS_BAR_DEFAULT: HomeStatsBarValue = {
  enabled: false,
  items: [
    {
      id: "delivery-details",
      icon: "truck",
      text: "",
      sort_order: 1,
      active: true,
    },
    {
      id: "rental-details",
      icon: "tag",
      text: "",
      sort_order: 2,
      active: true,
    },
    {
      id: "customer-support",
      icon: "home",
      text: "",
      sort_order: 3,
      active: true,
    },
  ],
};

const HOME_DUMPSTER_SIZES_DEFAULT: HomeDumpsterSizesValue = {
  showDumpsterSizesSection: true,
  dumpsterSizesEyebrow: "Choose your size",
  dumpsterSizesTitle: "Pick the right dumpster",
  dumpsterSizesIntro: "Use this starter item as a template, then adjust it to match your actual offerings.",
  dumpsterSizes: [
    {
      id: "14-yard",
      sizeYards: 14,
      title: "Common starter size",
      shortDescription: "A reusable starter item for common residential projects.",
      longDescription: "Edit this description so it matches the dumpster sizes and policies this business offers.",
      checklistItems: [
        "Home cleanouts",
        "Yard waste",
        "Estate cleanouts",
        "Renovation debris",
        "Roofing shingles",
        "Garage & basement",
      ],
      dimensions: "14′ × 7.5′ × 4.5′",
      weightIncluded: "Set included weight",
      rentalWindowDays: null,
      badgeLabel: "",
      isFeatured: true,
    },
  ],
};

const HOME_SERVICE_AREA_LOOKUP_DEFAULT: HomeServiceAreaLookupValue = {
  enabled: false,
  eyebrow: "SERVICE AREA",
  headline: "Check service availability",
  description: "Enter your ZIP code to check service availability.",
  zipPlaceholder: "Enter ZIP code",
  buttonText: "Check ZIP",
  areasEyebrow: "SERVICE AREAS",
  areaPills: [],
  helperText: "",
};

const PRICING_SIZE_GUIDE_DEFAULT: PricingSizeGuideValue = {
  enabled: true,
  buttonText: "Not sure which size? →",
  title: "Which size is right for me?",
  rows: [
    {
      id: "14-yard",
      sizeLabel: "14-yard",
      truckLoadEstimate: "~3-4 truck loads",
      description: "Bathroom remodel, small cleanout, garage declutter, or a single room renovation.",
      sortOrder: 10,
      active: true,
    },
    {
      id: "20-yard",
      sizeLabel: "20-yard",
      truckLoadEstimate: "~6-8 truck loads",
      description: "Roofing job, kitchen remodel, basement or attic cleanout, multi-room renovation.",
      sortOrder: 20,
      active: true,
    },
    {
      id: "30-yard",
      sizeLabel: "30-yard",
      truckLoadEstimate: "~9-12 truck loads",
      description: "Large home renovation, new construction debris, full property cleanout.",
      sortOrder: 30,
      active: true,
    },
    {
      id: "50-yard",
      sizeLabel: "50-yard",
      truckLoadEstimate: "~16-18 truck loads",
      description: "Commercial jobs, major demolition, large construction sites, industrial cleanouts.",
      sortOrder: 40,
      active: true,
    },
  ],
};

const DEFAULT_CARD_GRID_ICON_KEYS = ["tag", "truck", "home"] satisfies HomeStatsIconKey[];
const DEFAULT_STEPS_ICON_KEYS = ["calendar", "mapPin", "checkCircle"] satisfies HomeStatsIconKey[];

function getDefaultMarketingIconKey(
  type: HomeSectionType,
  index: number,
): HomeStatsIconKey {
  const defaults = type === "card_grid" ? DEFAULT_CARD_GRID_ICON_KEYS : DEFAULT_STEPS_ICON_KEYS;
  return defaults[index] ?? "star";
}

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

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function asNullableNumber(value: unknown, fallback: number | null = null) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function latestTimestamp(...values: Array<string | null | undefined>) {
  const timestamps = values.filter((value): value is string => Boolean(value));
  if (!timestamps.length) return null;

  return timestamps.reduce((latest, current) => {
    return new Date(current).getTime() > new Date(latest).getTime() ? current : latest;
  });
}

function getEntrySource(
  draftRow: { value_json?: unknown; updated_at?: string | null } | null | undefined,
  publishedRow: { value_json?: unknown; updated_at?: string | null } | null | undefined,
): CmsEntryStatus["source"] {
  if (draftRow && publishedRow) {
    try {
      if (JSON.stringify(draftRow.value_json) === JSON.stringify(publishedRow.value_json)) {
        return "published";
      }
    } catch {
      // If a stored value cannot be stringified, keep the conservative draft-first source.
    }
  }
  if (draftRow) return "draft";
  if (publishedRow) return "published";
  return "default";
}

function normalizeHero(rawValue: unknown): HomeHeroValue {
  const raw = asObject(rawValue);
  const trustBullets = asStringArray(raw.trustBullets ?? raw.trustItems, 3).slice(0, 3);

  while (trustBullets.length < 3) {
    trustBullets.push("");
  }

  return {
    eyebrow: asString(raw.eyebrow, "Reliable dumpster rental made simple"),
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
    items: asRecordArray(raw.items).map((item, index) => ({
      label: asString(item.label ?? item.title),
      headline: asString(item.headline),
      body: asString(item.body),
      icon: normalizeHomeStatsIconKey(item.icon ?? getDefaultMarketingIconKey("card_grid", index)),
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
    items: asRecordArray(raw.items).map((item, index) => ({
      label: asString(item.label ?? item.stepLabel),
      title: asString(item.title),
      body: asString(item.body),
      icon: normalizeHomeStatsIconKey(item.icon ?? getDefaultMarketingIconKey("steps", index)),
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

function normalizeStatsBar(rawValue: unknown): HomeStatsBarValue {
  if (rawValue === undefined) {
    return HOME_STATS_BAR_DEFAULT;
  }

  const raw = asObject(rawValue);
  const items = asRecordArray(raw.items).map((item, index) => ({
    id: asString(item.id, `stat-${index + 1}`),
    text: asString(item.text),
    icon: normalizeHomeStatsIconKey(item.icon),
    sort_order: asNumber(item.sort_order ?? item.sortOrder, index + 1),
    active: asBoolean(item.active, true),
  }));

  return {
    enabled: asBoolean(raw.enabled, true),
    items,
  };
}

function normalizeDumpsterSizes(rawValue: unknown): HomeDumpsterSizesValue {
  if (rawValue === undefined) {
    return {
      ...HOME_DUMPSTER_SIZES_DEFAULT,
      dumpsterSizes: HOME_DUMPSTER_SIZES_DEFAULT.dumpsterSizes.map((item) => ({
        ...item,
        checklistItems: [...item.checklistItems],
      })),
    };
  }

  const raw = asObject(rawValue);
  const source = Array.isArray(raw.dumpsterSizes)
    ? raw.dumpsterSizes
    : Array.isArray(raw.items)
      ? raw.items
      : [];
  const fallbackItem = HOME_DUMPSTER_SIZES_DEFAULT.dumpsterSizes[0];

  return {
    showDumpsterSizesSection: asBoolean(
      raw.showDumpsterSizesSection ?? raw.enabled,
      HOME_DUMPSTER_SIZES_DEFAULT.showDumpsterSizesSection,
    ),
    dumpsterSizesEyebrow: asString(
      raw.dumpsterSizesEyebrow ?? raw.eyebrow,
      HOME_DUMPSTER_SIZES_DEFAULT.dumpsterSizesEyebrow,
    ),
    dumpsterSizesTitle: asString(
      raw.dumpsterSizesTitle ?? raw.title,
      HOME_DUMPSTER_SIZES_DEFAULT.dumpsterSizesTitle,
    ),
    dumpsterSizesIntro: asString(
      raw.dumpsterSizesIntro ?? raw.intro,
      HOME_DUMPSTER_SIZES_DEFAULT.dumpsterSizesIntro,
    ),
    dumpsterSizes: (source.length ? source : HOME_DUMPSTER_SIZES_DEFAULT.dumpsterSizes).map((item, index) => {
      const record = asObject(item);
      const fallback = HOME_DUMPSTER_SIZES_DEFAULT.dumpsterSizes[index] ?? fallbackItem;
      const checklistItems = asStringArray(record.checklistItems ?? record.commonUses, fallback.checklistItems.length);

      return {
        id: asString(record.id, `dumpster-size-${index + 1}`),
        sizeYards: asNullableNumber(record.sizeYards ?? record.yards, fallback.sizeYards),
        title: asString(record.title, fallback.title),
        shortDescription: asString(record.shortDescription, fallback.shortDescription),
        longDescription: asString(record.longDescription, fallback.longDescription),
        checklistItems: checklistItems.length ? checklistItems : [...fallback.checklistItems],
        dimensions: asString(record.dimensions, fallback.dimensions),
        weightIncluded: asString(record.weightIncluded, fallback.weightIncluded),
        rentalWindowDays: asNullableNumber(record.rentalWindowDays, fallback.rentalWindowDays),
        badgeLabel: asString(record.badgeLabel, fallback.badgeLabel),
        isFeatured: asBoolean(record.isFeatured, fallback.isFeatured),
      };
    }),
  };
}

function normalizeServiceAreaLookup(rawValue: unknown): HomeServiceAreaLookupValue {
  if (rawValue === undefined) {
    return HOME_SERVICE_AREA_LOOKUP_DEFAULT;
  }

  const raw = asObject(rawValue);
  const areaPills = asStringArray(raw.areaPills ?? raw.areas, 1);

  return {
    enabled: asBoolean(raw.enabled, true),
    eyebrow: asString(raw.eyebrow, HOME_SERVICE_AREA_LOOKUP_DEFAULT.eyebrow),
    headline: asString(raw.headline, HOME_SERVICE_AREA_LOOKUP_DEFAULT.headline),
    description: asString(raw.description, HOME_SERVICE_AREA_LOOKUP_DEFAULT.description),
    zipPlaceholder: asString(raw.zipPlaceholder, HOME_SERVICE_AREA_LOOKUP_DEFAULT.zipPlaceholder),
    buttonText: asString(raw.buttonText, HOME_SERVICE_AREA_LOOKUP_DEFAULT.buttonText),
    areasEyebrow: asString(raw.areasEyebrow, HOME_SERVICE_AREA_LOOKUP_DEFAULT.areasEyebrow),
    areaPills: areaPills.length ? areaPills : [""],
    helperText: asString(raw.helperText, HOME_SERVICE_AREA_LOOKUP_DEFAULT.helperText),
  };
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
    sizeGuide: normalizePricingSizeGuide(raw.sizeGuide),
  };
}

function clonePricingSizeGuideDefault(): PricingSizeGuideValue {
  return {
    ...PRICING_SIZE_GUIDE_DEFAULT,
    rows: PRICING_SIZE_GUIDE_DEFAULT.rows.map((row) => ({ ...row })),
  };
}

function normalizePricingSizeGuide(rawValue: unknown): PricingSizeGuideValue {
  if (rawValue === undefined) {
    return clonePricingSizeGuideDefault();
  }

  const raw = asObject(rawValue);
  const sourceRows = asRecordArray(raw.rows);
  const fallback = clonePricingSizeGuideDefault();
  const rows = (sourceRows.length ? sourceRows : fallback.rows)
    .map((item, index) => {
      const row = asObject(item);

      return {
        id: asString(row.id, `size-guide-row-${index + 1}`),
        sizeLabel: asString(row.sizeLabel, fallback.rows[index]?.sizeLabel ?? ""),
        truckLoadEstimate: asString(row.truckLoadEstimate, fallback.rows[index]?.truckLoadEstimate ?? ""),
        description: asString(row.description, fallback.rows[index]?.description ?? ""),
        sortOrder: asNumber(row.sortOrder ?? row.sort_order, fallback.rows[index]?.sortOrder ?? index + 1),
        active: asBoolean(row.active, fallback.rows[index]?.active ?? true),
      };
    })
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
      return left.sizeLabel.localeCompare(right.sizeLabel);
    });

  return {
    enabled: asBoolean(raw.enabled, fallback.enabled),
    buttonText: asString(raw.buttonText, fallback.buttonText),
    title: asString(raw.title, fallback.title),
    rows,
  };
}

function normalizeTermsAndConditions(rawValue: unknown): TermsAndConditionsContentValue {
  const raw = asObject(rawValue);

  return {
    body: asString(raw.body ?? raw.termsAndConditionsBody ?? raw.terms_and_conditions_body, TERMS_AND_CONDITIONS_DEFAULT.body),
  };
}

async function getHomeSectionsEntry(tenantId: string): Promise<CmsEntry<HomeFlexibleSection[]>> {
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
    getTenantContentRowByStatusForTenant(tenantId, "content.home.sections", "draft"),
    getTenantContentRowByStatusForTenant(tenantId, "content.home.sections", "published"),
    getTenantContentDraftFirstForTenant(tenantId, "content.home.sections"),
    getTenantContentRowByStatusForTenant(tenantId, "content.home.value_props", "draft"),
    getTenantContentRowByStatusForTenant(tenantId, "content.home.value_props", "published"),
    getTenantContentByStatusForTenant(tenantId, "content.home.value_props", "draft"),
    getTenantContentByStatusForTenant(tenantId, "content.home.value_props", "published"),
    getTenantContentRowByStatusForTenant(tenantId, "content.home.how_it_works", "draft"),
    getTenantContentRowByStatusForTenant(tenantId, "content.home.how_it_works", "published"),
    getTenantContentByStatusForTenant(tenantId, "content.home.how_it_works", "draft"),
    getTenantContentByStatusForTenant(tenantId, "content.home.how_it_works", "published"),
  ]);

  if (sectionsValue !== undefined) {
    return {
      contentKey: "content.home.sections",
      source: getEntrySource(sectionsDraftRow, sectionsPublishedRow),
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
    source: getEntrySource(valuePropsDraftRow || howDraftRow, valuePropsPublishedRow || howPublishedRow),
    hasDraft: Boolean(valuePropsDraftRow || howDraftRow),
    draftUpdatedAt: latestTimestamp(valuePropsDraftRow?.updated_at, howDraftRow?.updated_at),
    publishedUpdatedAt: latestTimestamp(valuePropsPublishedRow?.updated_at, howPublishedRow?.updated_at),
    value: legacySections,
  };
}

async function getHomeHeroEntry(tenantId: string): Promise<CmsEntry<HomeHeroValue>> {
  const [draftRow, publishedRow, value] = await Promise.all([
    getTenantContentRowByStatusForTenant(tenantId, "content.home.hero", "draft"),
    getTenantContentRowByStatusForTenant(tenantId, "content.home.hero", "published"),
    getTenantContentDraftFirstForTenant(tenantId, "content.home.hero"),
  ]);

  return {
    contentKey: "content.home.hero",
    source: getEntrySource(draftRow, publishedRow),
    hasDraft: Boolean(draftRow),
    draftUpdatedAt: draftRow?.updated_at ?? null,
    publishedUpdatedAt: publishedRow?.updated_at ?? null,
    value: normalizeHero(value),
  };
}

async function getHomeStatsBarEntry(tenantId: string): Promise<CmsEntry<HomeStatsBarValue>> {
  const [draftRow, publishedRow, value] = await Promise.all([
    getTenantContentRowByStatusForTenant(tenantId, "content.home.stats_bar", "draft"),
    getTenantContentRowByStatusForTenant(tenantId, "content.home.stats_bar", "published"),
    getTenantContentDraftFirstForTenant(tenantId, "content.home.stats_bar"),
  ]);

  return {
    contentKey: "content.home.stats_bar",
    source: getEntrySource(draftRow, publishedRow),
    hasDraft: Boolean(draftRow),
    draftUpdatedAt: draftRow?.updated_at ?? null,
    publishedUpdatedAt: publishedRow?.updated_at ?? null,
    value: normalizeStatsBar(value),
  };
}

async function getHomeDumpsterSizesEntry(tenantId: string): Promise<CmsEntry<HomeDumpsterSizesValue>> {
  const [draftRow, publishedRow, value] = await Promise.all([
    getTenantContentRowByStatusForTenant(tenantId, "content.home.dumpster_sizes", "draft"),
    getTenantContentRowByStatusForTenant(tenantId, "content.home.dumpster_sizes", "published"),
    getTenantContentDraftFirstForTenant(tenantId, "content.home.dumpster_sizes"),
  ]);

  return {
    contentKey: "content.home.dumpster_sizes",
    source: getEntrySource(draftRow, publishedRow),
    hasDraft: Boolean(draftRow),
    draftUpdatedAt: draftRow?.updated_at ?? null,
    publishedUpdatedAt: publishedRow?.updated_at ?? null,
    value: normalizeDumpsterSizes(value),
  };
}

async function getServiceAreaPopupEntry(tenantId: string): Promise<CmsEntry<HomeServiceAreaPopupValue>> {
  const [draftRow, publishedRow, value, legacyDraftRow, legacyPublishedRow, legacyValue] = await Promise.all([
    getTenantContentRowByStatusForTenant(tenantId, "content.home.service_area_popup", "draft"),
    getTenantContentRowByStatusForTenant(tenantId, "content.home.service_area_popup", "published"),
    getTenantContentDraftFirstForTenant(tenantId, "content.home.service_area_popup"),
    getTenantContentRowByStatusForTenant(tenantId, "content.home.service_area", "draft"),
    getTenantContentRowByStatusForTenant(tenantId, "content.home.service_area", "published"),
    getTenantContentDraftFirstForTenant(tenantId, "content.home.service_area"),
  ]);

  return {
    contentKey: "content.home.service_area_popup",
    source: getEntrySource(draftRow || legacyDraftRow, publishedRow || legacyPublishedRow),
    hasDraft: Boolean(draftRow || legacyDraftRow),
    draftUpdatedAt: draftRow?.updated_at ?? legacyDraftRow?.updated_at ?? null,
    publishedUpdatedAt: publishedRow?.updated_at ?? legacyPublishedRow?.updated_at ?? null,
    value: normalizeServiceAreaPopup(
      value ?? legacyValue,
    ),
  };
}

async function getServiceAreaLookupEntry(tenantId: string): Promise<CmsEntry<HomeServiceAreaLookupValue>> {
  const [draftRow, publishedRow, value] = await Promise.all([
    getTenantContentRowByStatusForTenant(tenantId, "content.home.service_area_lookup", "draft"),
    getTenantContentRowByStatusForTenant(tenantId, "content.home.service_area_lookup", "published"),
    getTenantContentDraftFirstForTenant(tenantId, "content.home.service_area_lookup"),
  ]);

  return {
    contentKey: "content.home.service_area_lookup",
    source: getEntrySource(draftRow, publishedRow),
    hasDraft: Boolean(draftRow),
    draftUpdatedAt: draftRow?.updated_at ?? null,
    publishedUpdatedAt: publishedRow?.updated_at ?? null,
    value: normalizeServiceAreaLookup(value),
  };
}

async function getHomeFaqEntry(tenantId: string): Promise<CmsEntry<HomeFaqValue>> {
  const [draftRow, publishedRow, value] = await Promise.all([
    getTenantContentRowByStatusForTenant(tenantId, "content.faq.home", "draft"),
    getTenantContentRowByStatusForTenant(tenantId, "content.faq.home", "published"),
    getTenantContentDraftFirstForTenant(tenantId, "content.faq.home"),
  ]);

  return {
    contentKey: "content.faq.home",
    source: getEntrySource(draftRow, publishedRow),
    hasDraft: Boolean(draftRow),
    draftUpdatedAt: draftRow?.updated_at ?? null,
    publishedUpdatedAt: publishedRow?.updated_at ?? null,
    value: normalizeFaq(value),
  };
}

async function getPricingProductContentEntry(tenantId: string): Promise<CmsEntry<PricingProductContentValue>> {
  const [draftRow, publishedRow, value, legacyDraftRow, legacyPublishedRow, legacyValue] = await Promise.all([
    getTenantContentRowByStatusForTenant(tenantId, "content.pricing.product_content", "draft"),
    getTenantContentRowByStatusForTenant(tenantId, "content.pricing.product_content", "published"),
    getTenantContentDraftFirstForTenant(tenantId, "content.pricing.product_content"),
    getTenantContentRowByStatusForTenant(tenantId, "content.pricing.promises", "draft"),
    getTenantContentRowByStatusForTenant(tenantId, "content.pricing.promises", "published"),
    getTenantContentDraftFirstForTenant(tenantId, "content.pricing.promises"),
  ]);

  return {
    contentKey: "content.pricing.product_content",
    source: getEntrySource(draftRow || legacyDraftRow, publishedRow || legacyPublishedRow),
    hasDraft: Boolean(draftRow || legacyDraftRow),
    draftUpdatedAt: draftRow?.updated_at ?? legacyDraftRow?.updated_at ?? null,
    publishedUpdatedAt: publishedRow?.updated_at ?? legacyPublishedRow?.updated_at ?? null,
    value: normalizePricingProductContent(
      value ?? legacyValue,
    ),
  };
}

async function getTermsAndConditionsEntry(tenantId: string): Promise<CmsEntry<TermsAndConditionsContentValue>> {
  const [draftRow, publishedRow, value] = await Promise.all([
    getTenantContentRowByStatusForTenant(tenantId, "content.terms.rental_terms", "draft"),
    getTenantContentRowByStatusForTenant(tenantId, "content.terms.rental_terms", "published"),
    getTenantContentDraftFirstForTenant(tenantId, "content.terms.rental_terms"),
  ]);

  return {
    contentKey: "content.terms.rental_terms",
    source: getEntrySource(draftRow, publishedRow),
    hasDraft: Boolean(draftRow),
    draftUpdatedAt: draftRow?.updated_at ?? null,
    publishedUpdatedAt: publishedRow?.updated_at ?? null,
    value: normalizeTermsAndConditions(value),
  };
}

export async function getRetailSiteCmsInitialStateForTenant(
  tenantId: string,
): Promise<RetailSiteCmsState> {
  const [
    hero,
    statsBar,
    sections,
    dumpsterSizes,
    serviceAreaLookup,
    serviceAreaPopup,
    faq,
    productContent,
    rentalTerms,
  ] = await Promise.all([
    getHomeHeroEntry(tenantId),
    getHomeStatsBarEntry(tenantId),
    getHomeSectionsEntry(tenantId),
    getHomeDumpsterSizesEntry(tenantId),
    getServiceAreaLookupEntry(tenantId),
    getServiceAreaPopupEntry(tenantId),
    getHomeFaqEntry(tenantId),
    getPricingProductContentEntry(tenantId),
    getTermsAndConditionsEntry(tenantId),
  ]);

  return {
    home: {
      hero,
      statsBar,
      sections,
      dumpsterSizes,
      serviceAreaLookup,
      serviceAreaPopup,
      faq,
    },
    pricing: {
      productContent,
    },
    terms: {
      rentalTerms,
    },
  };
}
