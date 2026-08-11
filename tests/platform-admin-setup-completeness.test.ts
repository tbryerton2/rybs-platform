import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPlatformTenantSummaries,
  buildTenantSetupSummary,
  getPlatformTenantIndexStats,
  type PlatformTenantRecord,
  type TenantSetupSignals,
} from "../src/lib/platform-admin/setup-completeness.ts";

const ACTIVE_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const INACTIVE_TENANT_ID = "22222222-2222-4222-8222-222222222222";

function tenant(input: Partial<PlatformTenantRecord> & { id: string; slug: string }): PlatformTenantRecord {
  return {
    id: input.id,
    slug: input.slug,
    status: input.status ?? "active",
    createdAt: input.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-01-02T00:00:00.000Z",
  };
}

function completeSignals(input: Partial<TenantSetupSignals> = {}): TenantSetupSignals {
  return {
    activeAdminMembershipCount: 1,
    activeServiceAreaZipCount: 2,
    activeDumpsterCount: 1,
    bookableDumpsterCount: 1,
    publicProductCount: 0,
    activePublicDomainCount: 1,
    activePlatformSubdomainCount: 1,
    activeCustomDomainCount: 0,
    activeBookingDomainCount: 0,
    publishedContentCount: 0,
    draftContentCount: 0,
    pricing: {
      id: "pricing-1",
      standardRentalPrice: 475,
      includedRentalDays: 7,
      dailyOveragePrice: 30,
      includedTons: 1,
      tonOveragePrice: 100,
      maxRentalDays: null,
    },
    settings: {
      "brand.name": "Example Business",
      "support.timezone": "America/New_York",
      "runtime.storageNamespace": "example_business",
      "implementation.type": "full_site_platform_subdomain",
    },
    ...input,
  };
}

test("platform tenant summaries include both active and inactive tenants", () => {
  const summaries = buildPlatformTenantSummaries(
    [
      tenant({ id: ACTIVE_TENANT_ID, slug: "active-shop" }),
      tenant({ id: INACTIVE_TENANT_ID, slug: "inactive-shop", status: "inactive" }),
    ],
    new Map([
      [ACTIVE_TENANT_ID, completeSignals()],
      [INACTIVE_TENANT_ID, completeSignals()],
    ]),
  );
  const stats = getPlatformTenantIndexStats(summaries);

  assert.equal(summaries.length, 2);
  assert.equal(stats.totalBusinesses, 2);
  assert.equal(stats.activeBusinesses, 1);
  assert.equal(stats.inactiveBusinesses, 1);
});

test("setup counts are scoped by exact tenant id", () => {
  const summaries = buildPlatformTenantSummaries(
    [
      tenant({ id: ACTIVE_TENANT_ID, slug: "tenant-a" }),
      tenant({ id: INACTIVE_TENANT_ID, slug: "tenant-b" }),
    ],
    new Map([[INACTIVE_TENANT_ID, completeSignals({ activeAdminMembershipCount: 3 })]]),
  );
  const tenantA = summaries.find((summary) => summary.id === ACTIVE_TENANT_ID);
  const tenantB = summaries.find((summary) => summary.id === INACTIVE_TENANT_ID);

  assert.equal(tenantA?.signals.activeAdminMembershipCount, 0);
  assert.equal(tenantA?.setup.status, "needs_attention");
  assert.equal(tenantB?.signals.activeAdminMembershipCount, 3);
});

test("new tenant with no implementation type shows unselected incomplete state", () => {
  const summary = buildTenantSetupSummary(
    tenant({ id: INACTIVE_TENANT_ID, slug: "new-shop", status: "inactive" }),
    {
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
    },
  );

  assert.equal(summary.status, "needs_attention");
  assert.equal(summary.readinessStatus, "not_started");
  assert.equal(summary.implementationType, null);
  assert.equal(summary.implementationTypeConfigured, false);
});

test("brand and contact settings are configured without support phone or email", () => {
  const summary = buildTenantSetupSummary(
    tenant({ id: INACTIVE_TENANT_ID, slug: "brand-ready", status: "inactive" }),
    completeSignals(),
  );
  const area = summary.areas.find((entry) => entry.key === "brandContactSettings");

  assert.equal(area?.status, "complete");
  assert.match(area?.detail ?? "", /Phone and email are optional/);
});

test("brand and contact settings require brand name", () => {
  const summary = buildTenantSetupSummary(
    tenant({ id: INACTIVE_TENANT_ID, slug: "missing-brand", status: "inactive" }),
    completeSignals({
      settings: {
        "support.timezone": "America/New_York",
        "runtime.storageNamespace": "missing_brand",
        "implementation.type": "full_site_platform_subdomain",
      },
    }),
  );
  const area = summary.areas.find((entry) => entry.key === "brandContactSettings");

  assert.equal(area?.status, "needs_attention");
  assert.match(area?.detail ?? "", /brand\.name/);
});

test("brand and contact settings require support timezone", () => {
  const summary = buildTenantSetupSummary(
    tenant({ id: INACTIVE_TENANT_ID, slug: "missing-timezone", status: "inactive" }),
    completeSignals({
      settings: {
        "brand.name": "Missing Timezone",
        "runtime.storageNamespace": "missing_timezone",
        "implementation.type": "full_site_platform_subdomain",
      },
    }),
  );
  const area = summary.areas.find((entry) => entry.key === "brandContactSettings");

  assert.equal(area?.status, "needs_attention");
  assert.match(area?.detail ?? "", /support\.timezone/);
});

test("brand and contact settings require runtime storage namespace", () => {
  const summary = buildTenantSetupSummary(
    tenant({ id: INACTIVE_TENANT_ID, slug: "missing-storage", status: "inactive" }),
    completeSignals({
      settings: {
        "brand.name": "Missing Storage",
        "support.timezone": "America/New_York",
        "implementation.type": "full_site_platform_subdomain",
      },
    }),
  );
  const area = summary.areas.find((entry) => entry.key === "brandContactSettings");

  assert.equal(area?.status, "needs_attention");
  assert.match(area?.detail ?? "", /runtime\.storageNamespace/);
});

test("header phone and email are optional and do not create support requirements", () => {
  const withoutHeaderContact = buildTenantSetupSummary(
    tenant({ id: INACTIVE_TENANT_ID, slug: "header-contact-optional", status: "inactive" }),
    completeSignals(),
  );
  const withHeaderContact = buildTenantSetupSummary(
    tenant({ id: INACTIVE_TENANT_ID, slug: "header-contact-saved", status: "inactive" }),
    completeSignals({
      settings: {
        ...completeSignals().settings,
        "settings.header.phoneNumber": "+1-555-555-0123",
        "settings.header.emailAddress": "hello@example.com",
      },
    }),
  );

  assert.equal(
    withoutHeaderContact.areas.find((area) => area.key === "brandContactSettings")?.status,
    "complete",
  );
  assert.equal(
    withHeaderContact.areas.find((area) => area.key === "brandContactSettings")?.status,
    "complete",
  );
});

test("full-site platform-subdomain rules require website content and platform domain", () => {
  const summary = buildTenantSetupSummary(
    tenant({ id: INACTIVE_TENANT_ID, slug: "platform-site", status: "inactive" }),
    completeSignals({
      activePublicDomainCount: 1,
      activePlatformSubdomainCount: 1,
      activeCustomDomainCount: 0,
      activeBookingDomainCount: 0,
      publishedContentCount: 1,
      settings: {
        ...completeSignals().settings,
        "implementation.type": "full_site_platform_subdomain",
      },
    }),
  );

  assert.equal(summary.status, "complete");
  assert.equal(summary.readinessStatus, "ready_to_launch");
  assert.equal(summary.requiredAreaCount, 8);
  assert.equal(
    summary.areas.find((area) => area.key === "websiteContent")?.required,
    true,
  );
  assert.equal(
    summary.areas.find((area) => area.key === "publicDomains")?.status,
    "complete",
  );
});

test("full-site custom-domain rules require website content and custom domain", () => {
  const missingCustomDomain = buildTenantSetupSummary(
    tenant({ id: INACTIVE_TENANT_ID, slug: "custom-site", status: "inactive" }),
    completeSignals({
      activePublicDomainCount: 1,
      activePlatformSubdomainCount: 1,
      activeCustomDomainCount: 0,
      publishedContentCount: 1,
      settings: {
        ...completeSignals().settings,
        "implementation.type": "full_site_custom_domain",
      },
    }),
  );
  const configured = buildTenantSetupSummary(
    tenant({ id: INACTIVE_TENANT_ID, slug: "custom-site", status: "inactive" }),
    completeSignals({
      activePublicDomainCount: 1,
      activePlatformSubdomainCount: 0,
      activeCustomDomainCount: 1,
      publishedContentCount: 1,
      settings: {
        ...completeSignals().settings,
        "implementation.type": "full_site_custom_domain",
      },
    }),
  );

  assert.equal(
    missingCustomDomain.areas.find((area) => area.key === "publicDomains")?.status,
    "needs_attention",
  );
  assert.equal(configured.status, "complete");
  assert.equal(configured.readinessStatus, "ready_to_launch");
});

test("existing-site hosted-booking rules do not require website content", () => {
  const summary = buildTenantSetupSummary(
    tenant({ id: INACTIVE_TENANT_ID, slug: "booking-only", status: "inactive" }),
    completeSignals({
      activePublicDomainCount: 1,
      activePlatformSubdomainCount: 0,
      activeCustomDomainCount: 0,
      activeBookingDomainCount: 1,
      publishedContentCount: 0,
      settings: {
        ...completeSignals().settings,
        "implementation.type": "existing_site_hosted_booking",
      },
    }),
  );
  const websiteArea = summary.areas.find((area) => area.key === "websiteContent");

  assert.equal(websiteArea?.required, false);
  assert.equal(websiteArea?.status, "not_applicable");
  assert.equal(summary.requiredAreaCount, 7);
  assert.equal(summary.status, "complete");
});

test("existing-site hosted-booking requires a usable booking or platform domain", () => {
  const missingDomain = buildTenantSetupSummary(
    tenant({ id: INACTIVE_TENANT_ID, slug: "booking-missing", status: "inactive" }),
    completeSignals({
      activePublicDomainCount: 1,
      activePlatformSubdomainCount: 0,
      activeCustomDomainCount: 1,
      activeBookingDomainCount: 0,
      settings: {
        ...completeSignals().settings,
        "implementation.type": "existing_site_hosted_booking",
      },
    }),
  );
  const platformSubdomain = buildTenantSetupSummary(
    tenant({ id: INACTIVE_TENANT_ID, slug: "booking-platform", status: "inactive" }),
    completeSignals({
      activePublicDomainCount: 1,
      activePlatformSubdomainCount: 1,
      activeCustomDomainCount: 0,
      activeBookingDomainCount: 0,
      settings: {
        ...completeSignals().settings,
        "implementation.type": "existing_site_hosted_booking",
      },
    }),
  );

  assert.equal(
    missingDomain.areas.find((area) => area.key === "publicDomains")?.status,
    "needs_attention",
  );
  assert.equal(platformSubdomain.status, "complete");
});

test("website content distinguishes configured content from safe code defaults", () => {
  const usingDefaults = buildTenantSetupSummary(
    tenant({ id: ACTIVE_TENANT_ID, slug: "defaults-shop" }),
    completeSignals({
      publishedContentCount: 0,
      draftContentCount: 0,
      settings: {
        ...completeSignals().settings,
        "implementation.type": "existing_site_hosted_booking",
      },
    }),
  );
  const configured = buildTenantSetupSummary(
    tenant({ id: ACTIVE_TENANT_ID, slug: "configured-shop" }),
    completeSignals({ publishedContentCount: 2, draftContentCount: 1 }),
  );

  assert.equal(usingDefaults.status, "complete");
  assert.equal(
    usingDefaults.areas.find((area) => area.key === "websiteContent")?.status,
    "not_applicable",
  );
  assert.equal(
    configured.areas.find((area) => area.key === "websiteContent")?.status,
    "complete",
  );
});

test("public domains distinguish active production hostnames from missing configuration", () => {
  const pendingOnly = buildTenantSetupSummary(
    tenant({ id: ACTIVE_TENANT_ID, slug: "pending-domain-shop" }),
    completeSignals({
      activePublicDomainCount: 0,
      activePlatformSubdomainCount: 0,
      activeCustomDomainCount: 0,
      activeBookingDomainCount: 0,
    }),
  );
  const configured = buildTenantSetupSummary(
    tenant({ id: ACTIVE_TENANT_ID, slug: "configured-domain-shop" }),
    completeSignals({ activePublicDomainCount: 2 }),
  );

  assert.equal(
    pendingOnly.areas.find((area) => area.key === "publicDomains")?.status,
    "needs_attention",
  );
  assert.match(
    pendingOnly.areas.find((area) => area.key === "publicDomains")?.detail ?? "",
    /Localhost development compatibility does not count/,
  );
  assert.equal(
    configured.areas.find((area) => area.key === "publicDomains")?.status,
    "complete",
  );
});

test("ready-to-launch appears only when inactive tenant required areas are complete", () => {
  const ready = buildTenantSetupSummary(
    tenant({ id: INACTIVE_TENANT_ID, slug: "ready-shop", status: "inactive" }),
    completeSignals({ publishedContentCount: 1 }),
  );
  const incomplete = buildTenantSetupSummary(
    tenant({ id: INACTIVE_TENANT_ID, slug: "incomplete-shop", status: "inactive" }),
    completeSignals({ activeAdminMembershipCount: 0, publishedContentCount: 1 }),
  );

  assert.equal(ready.readinessStatus, "ready_to_launch");
  assert.equal(incomplete.readinessStatus, "in_progress");
});

test("active incomplete tenant shows warning readiness state", () => {
  const summary = buildTenantSetupSummary(
    tenant({ id: ACTIVE_TENANT_ID, slug: "active-incomplete", status: "active" }),
    completeSignals({ activeAdminMembershipCount: 0, publishedContentCount: 1 }),
  );

  assert.equal(summary.status, "needs_attention");
  assert.equal(summary.readinessStatus, "active_setup_incomplete");
});

test("active complete tenant remains active without automatic launch side effects", () => {
  const summary = buildTenantSetupSummary(
    tenant({ id: ACTIVE_TENANT_ID, slug: "active-complete", status: "active" }),
    completeSignals({ publishedContentCount: 1 }),
  );

  assert.equal(summary.status, "complete");
  assert.equal(summary.readinessStatus, "active");
});

test("implementation type is tenant-scoped", () => {
  const summaries = buildPlatformTenantSummaries(
    [
      tenant({ id: ACTIVE_TENANT_ID, slug: "tan-can-man" }),
      tenant({ id: INACTIVE_TENANT_ID, slug: "demo-dumpster-co", status: "inactive" }),
    ],
    new Map([
      [
        ACTIVE_TENANT_ID,
        completeSignals({
          activePublicDomainCount: 1,
          activePlatformSubdomainCount: 1,
          activeCustomDomainCount: 0,
          publishedContentCount: 1,
          settings: {
            ...completeSignals().settings,
            "brand.name": "Tan Can Man",
            "implementation.type": "full_site_platform_subdomain",
          },
        }),
      ],
      [
        INACTIVE_TENANT_ID,
        completeSignals({
          activePublicDomainCount: 1,
          activePlatformSubdomainCount: 0,
          activeCustomDomainCount: 0,
          activeBookingDomainCount: 1,
          publishedContentCount: 0,
          settings: {
            ...completeSignals().settings,
            "brand.name": "Demo Dumpster Company",
            "implementation.type": "existing_site_hosted_booking",
          },
        }),
      ],
    ]),
  );
  const tanCanMan = summaries.find((summary) => summary.id === ACTIVE_TENANT_ID);
  const demo = summaries.find((summary) => summary.id === INACTIVE_TENANT_ID);

  assert.equal(tanCanMan?.displayName, "Tan Can Man");
  assert.equal(tanCanMan?.setup.implementationType, "full_site_platform_subdomain");
  assert.equal(tanCanMan?.setup.readinessStatus, "active");
  assert.equal(
    tanCanMan?.setup.areas.find((area) => area.key === "brandContactSettings")?.status,
    "complete",
  );
  assert.equal(demo?.displayName, "Demo Dumpster Company");
  assert.equal(demo?.setup.implementationType, "existing_site_hosted_booking");
  assert.equal(demo?.setup.readinessStatus, "ready_to_launch");
  assert.equal(
    demo?.setup.areas.find((area) => area.key === "brandContactSettings")?.status,
    "complete",
  );
});

test("missing required setup areas produce needs-attention status", () => {
  const summary = buildTenantSetupSummary(
    tenant({ id: ACTIVE_TENANT_ID, slug: "missing-shop" }),
    completeSignals({
      activeAdminMembershipCount: 0,
      activeServiceAreaZipCount: 0,
      activeDumpsterCount: 0,
      publicProductCount: 0,
      pricing: null,
      settings: {},
    }),
  );

  assert.equal(summary.status, "needs_attention");
  assert.ok(summary.needsAttentionCount >= 5);
});
