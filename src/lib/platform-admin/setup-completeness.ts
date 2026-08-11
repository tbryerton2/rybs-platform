export type TenantLifecycleStatus = "active" | "inactive";

export const TENANT_IMPLEMENTATION_TYPES = [
  "full_site_platform_subdomain",
  "full_site_custom_domain",
  "existing_site_hosted_booking",
] as const;

export type TenantImplementationType = (typeof TENANT_IMPLEMENTATION_TYPES)[number];

export type PlatformTenantRecord = {
  id: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string | null;
};

export type PlatformPricingSignal = {
  id: string;
  standardRentalPrice: number | string | null;
  includedRentalDays: number | string | null;
  dailyOveragePrice: number | string | null;
  includedTons: number | string | null;
  tonOveragePrice: number | string | null;
  maxRentalDays: number | string | null;
};

export type TenantSetupSignals = {
  activeAdminMembershipCount: number;
  activeServiceAreaZipCount: number;
  activeDumpsterCount: number;
  bookableDumpsterCount: number;
  publicProductCount: number;
  activePublicDomainCount: number;
  activePlatformSubdomainCount: number;
  activeCustomDomainCount: number;
  activeBookingDomainCount: number;
  publishedContentCount: number;
  draftContentCount: number;
  pricing: PlatformPricingSignal | null;
  settings: Record<string, unknown>;
};

export type SetupAreaStatus =
  | "complete"
  | "needs_attention"
  | "using_defaults"
  | "not_applicable";

export type SetupAreaKey =
  | "businessRecord"
  | "businessAdminAccess"
  | "brandContactSettings"
  | "pricing"
  | "publicDomains"
  | "serviceArea"
  | "productsInventory"
  | "websiteContent";

export type TenantSetupArea = {
  key: SetupAreaKey;
  label: string;
  status: SetupAreaStatus;
  required: boolean;
  summary: string;
  detail: string;
  needed: string;
};

export type TenantSetupSummary = {
  status: "complete" | "needs_attention";
  readinessStatus:
    | "not_started"
    | "in_progress"
    | "ready_to_launch"
    | "active"
    | "active_setup_incomplete";
  implementationType: TenantImplementationType | null;
  implementationTypeConfigured: boolean;
  requiredCompleteCount: number;
  requiredAreaCount: number;
  needsAttentionCount: number;
  missingRequiredAreas: TenantSetupArea[];
  areas: TenantSetupArea[];
};

export type PlatformTenantSummary = PlatformTenantRecord & {
  name: string | null;
  displayName: string;
  setup: TenantSetupSummary;
  signals: {
    activeAdminMembershipCount: number;
    activeServiceAreaZipCount: number;
    activeDumpsterCount: number;
    bookableDumpsterCount: number;
    publicProductCount: number;
    activePublicDomainCount: number;
    activePlatformSubdomainCount: number;
    activeCustomDomainCount: number;
    activeBookingDomainCount: number;
    publishedContentCount: number;
    draftContentCount: number;
    pricingConfigured: boolean;
    implementationType: TenantImplementationType | null;
  };
};

export type PlatformTenantIndexStats = {
  totalBusinesses: number;
  activeBusinesses: number;
  inactiveBusinesses: number;
  businessesNeedingSetup: number;
};

export const EMPTY_TENANT_SETUP_SIGNALS: TenantSetupSignals = {
  activeAdminMembershipCount: 0,
  activeServiceAreaZipCount: 0,
  activeDumpsterCount: 0,
  bookableDumpsterCount: 0,
  publicProductCount: 0,
  activePublicDomainCount: 0,
  activePlatformSubdomainCount: 0,
  activeCustomDomainCount: 0,
  activeBookingDomainCount: 0,
  publishedContentCount: 0,
  draftContentCount: 0,
  pricing: null,
  settings: {},
};

export function isRecognizedTenantStatus(status: string): status is TenantLifecycleStatus {
  return status === "active" || status === "inactive";
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getSettingString(settings: Record<string, unknown>, key: string) {
  return asString(settings[key]);
}

export function isTenantImplementationType(value: unknown): value is TenantImplementationType {
  return TENANT_IMPLEMENTATION_TYPES.includes(value as TenantImplementationType);
}

export function getTenantImplementationType(
  settings: Record<string, unknown>,
): TenantImplementationType | null {
  const value = getSettingString(settings, "implementation.type");
  return isTenantImplementationType(value) ? value : null;
}

function isValidPricingSignal(pricing: PlatformPricingSignal | null) {
  if (!pricing?.id) return false;

  const standardRentalPrice = asNumber(pricing.standardRentalPrice);
  const includedRentalDays = asNumber(pricing.includedRentalDays);
  const dailyOveragePrice = asNumber(pricing.dailyOveragePrice);
  const includedTons = asNumber(pricing.includedTons);
  const tonOveragePrice = asNumber(pricing.tonOveragePrice);
  const maxRentalDays = pricing.maxRentalDays === null ? null : asNumber(pricing.maxRentalDays);

  return (
    standardRentalPrice !== null &&
    standardRentalPrice >= 0 &&
    includedRentalDays !== null &&
    Number.isInteger(includedRentalDays) &&
    includedRentalDays >= 1 &&
    dailyOveragePrice !== null &&
    dailyOveragePrice >= 0 &&
    includedTons !== null &&
    includedTons >= 0 &&
    tonOveragePrice !== null &&
    tonOveragePrice >= 0 &&
    (maxRentalDays === null || maxRentalDays >= includedRentalDays)
  );
}

export function getTenantBusinessName(settings: Record<string, unknown>) {
  return getSettingString(settings, "brand.name") || null;
}

function getBusinessRecordArea(tenant: PlatformTenantRecord): TenantSetupArea {
  const complete = Boolean(tenant.id) && Boolean(tenant.slug.trim()) && isRecognizedTenantStatus(tenant.status);

  return {
    key: "businessRecord",
    label: "Business record",
    status: complete ? "complete" : "needs_attention",
    required: true,
    summary: complete ? "Complete" : "Missing required configuration",
    detail: complete
      ? "Tenant has a valid UUID, slug, and active/inactive lifecycle status."
      : "Tenant must have a valid UUID, non-empty slug, and active or inactive lifecycle status.",
    needed: "Save a valid business name, slug, and lifecycle status.",
  };
}

function getBusinessAdminAccessArea(signals: TenantSetupSignals): TenantSetupArea {
  return {
    key: "businessAdminAccess",
    label: "Business admin access",
    status: signals.activeAdminMembershipCount > 0 ? "complete" : "needs_attention",
    required: true,
    summary: signals.activeAdminMembershipCount > 0 ? "Complete" : "Missing required configuration",
    detail:
      signals.activeAdminMembershipCount > 0
        ? `${signals.activeAdminMembershipCount} active business admin membership(s) found.`
        : "No active business_admin_memberships rows exist for this business.",
    needed: "Assign at least one existing Supabase Auth user as an active owner for this business.",
  };
}

function getBrandContactSettingsArea(signals: TenantSetupSignals): TenantSetupArea {
  const missing: string[] = [];

  if (!getSettingString(signals.settings, "brand.name")) {
    missing.push("brand.name");
  }

  if (!getSettingString(signals.settings, "support.timezone")) {
    missing.push("support.timezone");
  }

  if (!getSettingString(signals.settings, "runtime.storageNamespace")) {
    missing.push("runtime.storageNamespace");
  }

  return {
    key: "brandContactSettings",
    label: "Brand and contact settings",
    status: missing.length === 0 ? "complete" : "needs_attention",
    required: true,
    summary: missing.length === 0 ? "Complete" : "Missing required configuration",
    detail:
      missing.length === 0
        ? "brand.name, support.timezone, and runtime.storageNamespace are configured. Phone and email are optional customer-facing contact details."
        : `Missing ${missing.join(", ")}.`,
    needed: "Confirm the business name, timezone, and tenant storage settings. Phone and email are optional customer-facing contact details.",
  };
}

function getPricingArea(signals: TenantSetupSignals): TenantSetupArea {
  const valid = isValidPricingSignal(signals.pricing);

  return {
    key: "pricing",
    label: "Pricing",
    status: valid ? "complete" : "needs_attention",
    required: true,
    summary: valid ? "Complete" : "Missing required configuration",
    detail: valid
      ? "A pricing_settings row exists for this business and satisfies the existing numeric constraints."
      : "No valid pricing_settings row exists for this business.",
    needed: "Save pricing at least once for this business.",
  };
}

function getPublicDomainsArea(
  signals: TenantSetupSignals,
  implementationType: TenantImplementationType | null,
): TenantSetupArea {
  const required = implementationType !== null;
  let complete = false;
  let completeDetail = `${signals.activePublicDomainCount} active tenant_domains row(s) found.`;
  let missingDetail = "Select an implementation type before choosing the launch domain requirement.";

  if (implementationType === "full_site_platform_subdomain") {
    complete = signals.activePlatformSubdomainCount > 0;
    completeDetail = `${signals.activePlatformSubdomainCount} active platform_subdomain tenant_domains row(s) found.`;
    missingDetail = "No active platform_subdomain tenant_domains row exists for this business.";
  } else if (implementationType === "full_site_custom_domain") {
    complete = signals.activeCustomDomainCount > 0;
    completeDetail = `${signals.activeCustomDomainCount} active custom_domain tenant_domains row(s) found.`;
    missingDetail = "No active custom_domain tenant_domains row exists for this business.";
  } else if (implementationType === "existing_site_hosted_booking") {
    complete = signals.activeBookingDomainCount > 0 || signals.activePlatformSubdomainCount > 0;
    completeDetail = `${signals.activeBookingDomainCount} active booking_domain row(s) and ${signals.activePlatformSubdomainCount} active platform_subdomain row(s) found.`;
    missingDetail = "No active booking_domain or platform_subdomain tenant_domains row exists for this business.";
  }

  return {
    key: "publicDomains",
    label: "Public domains",
    status: complete ? "complete" : "needs_attention",
    required,
    summary: complete ? "Configured" : required ? "Missing active hostname" : "Implementation type unselected",
    detail: complete
      ? completeDetail
      : `${missingDetail} Localhost development compatibility does not count as production domain configuration.`,
    needed: "Add and activate the domain used by this implementation type.",
  };
}

function getServiceAreaArea(signals: TenantSetupSignals): TenantSetupArea {
  return {
    key: "serviceArea",
    label: "Service area",
    status: signals.activeServiceAreaZipCount > 0 ? "complete" : "needs_attention",
    required: true,
    summary: signals.activeServiceAreaZipCount > 0 ? "Complete" : "Missing required configuration",
    detail:
      signals.activeServiceAreaZipCount > 0
        ? `${signals.activeServiceAreaZipCount} active service_area_zips row(s) found.`
        : "No active service_area_zips rows exist for this business.",
    needed: "Add at least one active service ZIP.",
  };
}

function getProductsInventoryArea(signals: TenantSetupSignals): TenantSetupArea {
  const complete = signals.activeDumpsterCount > 0 || signals.publicProductCount > 0;

  return {
    key: "productsInventory",
    label: "Products or inventory",
    status: complete ? "complete" : "needs_attention",
    required: true,
    summary: complete ? "Complete" : "Missing required configuration",
    detail: complete
      ? `${signals.activeDumpsterCount} active dumpster(s), ${signals.bookableDumpsterCount} bookable dumpster(s), and ${signals.publicProductCount} public product setting(s) found.`
      : "No active dumpsters or public dumpster_product_settings rows exist for this business.",
    needed: "Add at least one active/bookable dumpster or public product.",
  };
}

function getWebsiteContentArea(
  signals: TenantSetupSignals,
  implementationType: TenantImplementationType | null,
): TenantSetupArea {
  const required =
    implementationType === "full_site_platform_subdomain" ||
    implementationType === "full_site_custom_domain";

  if (signals.publishedContentCount > 0) {
    return {
      key: "websiteContent",
      label: "Website content",
      status: "complete",
      required,
      summary: "Configured",
      detail: `${signals.publishedContentCount} published tenant_content_entries row(s) found.`,
      needed: "Publish the content needed for the hosted public website.",
    };
  }

  if (implementationType === "existing_site_hosted_booking") {
    return {
      key: "websiteContent",
      label: "Website content",
      status: "not_applicable",
      required: false,
      summary: "Not required",
      detail: "This business keeps its existing website and uses the hosted booking experience.",
      needed: "No hosted marketing-site content is required for this implementation type.",
    };
  }

  return {
    key: "websiteContent",
    label: "Website content",
    status: required ? "needs_attention" : "using_defaults",
    required,
    summary: required ? "Missing required configuration" : "Using defaults",
    detail:
      signals.draftContentCount > 0
        ? "Draft tenant content exists, but no published content is configured; safe code defaults remain in use."
        : "No published tenant content is configured; safe code defaults remain in use.",
    needed: required
      ? "Publish the website content before launching a full hosted site."
      : "Website content is required only when we host the full public website.",
  };
}

function countMeaningfulConfiguredAreas(areas: TenantSetupArea[]) {
  return areas.filter((area) => area.key !== "businessRecord" && area.status === "complete").length;
}

function getReadinessStatus(input: {
  tenant: PlatformTenantRecord;
  implementationTypeConfigured: boolean;
  setupComplete: boolean;
  meaningfulConfiguredAreaCount: number;
}): TenantSetupSummary["readinessStatus"] {
  if (input.tenant.status === "active") {
    return input.setupComplete ? "active" : "active_setup_incomplete";
  }

  if (input.setupComplete) {
    return "ready_to_launch";
  }

  if (!input.implementationTypeConfigured && input.meaningfulConfiguredAreaCount === 0) {
    return "not_started";
  }

  return "in_progress";
}

export function buildTenantSetupSummary(
  tenant: PlatformTenantRecord,
  signals: TenantSetupSignals = EMPTY_TENANT_SETUP_SIGNALS,
): TenantSetupSummary {
  const implementationType = getTenantImplementationType(signals.settings);
  const implementationTypeConfigured = implementationType !== null;
  const areas = [
    getBusinessRecordArea(tenant),
    getBusinessAdminAccessArea(signals),
    getBrandContactSettingsArea(signals),
    getPricingArea(signals),
    getPublicDomainsArea(signals, implementationType),
    getServiceAreaArea(signals),
    getProductsInventoryArea(signals),
    getWebsiteContentArea(signals, implementationType),
  ];
  const requiredAreas = areas.filter((area) => area.required);
  const missingRequiredAreas = requiredAreas.filter((area) => area.status !== "complete");
  const requiredAreaCount = requiredAreas.length;
  const requiredCompleteCount = requiredAreaCount - missingRequiredAreas.length;
  const needsAttentionCount = areas.filter((area) => area.status === "needs_attention").length;
  const setupComplete = implementationTypeConfigured && missingRequiredAreas.length === 0;

  return {
    status: setupComplete ? "complete" : "needs_attention",
    readinessStatus: getReadinessStatus({
      tenant,
      implementationTypeConfigured,
      setupComplete,
      meaningfulConfiguredAreaCount: countMeaningfulConfiguredAreas(areas),
    }),
    implementationType,
    implementationTypeConfigured,
    requiredCompleteCount,
    requiredAreaCount,
    needsAttentionCount,
    missingRequiredAreas,
    areas,
  };
}

export function buildPlatformTenantSummaries(
  tenants: PlatformTenantRecord[],
  signalsByTenantId: ReadonlyMap<string, TenantSetupSignals>,
): PlatformTenantSummary[] {
  return tenants.map((tenant) => {
    const signals = signalsByTenantId.get(tenant.id) ?? EMPTY_TENANT_SETUP_SIGNALS;
    const setup = buildTenantSetupSummary(tenant, signals);
    const name = getTenantBusinessName(signals.settings);

    return {
      ...tenant,
      name,
      displayName: name ?? tenant.slug,
      setup,
      signals: {
        activeAdminMembershipCount: signals.activeAdminMembershipCount,
        activeServiceAreaZipCount: signals.activeServiceAreaZipCount,
        activeDumpsterCount: signals.activeDumpsterCount,
        bookableDumpsterCount: signals.bookableDumpsterCount,
        publicProductCount: signals.publicProductCount,
        activePublicDomainCount: signals.activePublicDomainCount,
        activePlatformSubdomainCount: signals.activePlatformSubdomainCount,
        activeCustomDomainCount: signals.activeCustomDomainCount,
        activeBookingDomainCount: signals.activeBookingDomainCount,
        publishedContentCount: signals.publishedContentCount,
        draftContentCount: signals.draftContentCount,
        pricingConfigured: isValidPricingSignal(signals.pricing),
        implementationType: setup.implementationType,
      },
    };
  });
}

export function getPlatformTenantIndexStats(
  tenants: PlatformTenantSummary[],
): PlatformTenantIndexStats {
  return {
    totalBusinesses: tenants.length,
    activeBusinesses: tenants.filter((tenant) => tenant.status === "active").length,
    inactiveBusinesses: tenants.filter((tenant) => tenant.status === "inactive").length,
    businessesNeedingSetup: tenants.filter((tenant) => tenant.setup.status === "needs_attention").length,
  };
}
