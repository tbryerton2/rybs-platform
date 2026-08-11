import test from "node:test";
import assert from "node:assert/strict";

import {
  CURRENT_SITE_DEACTIVATION_CONFIRMATION,
  DEFAULT_NEW_TENANT_TIMEZONE,
  buildTenantStorageNamespace,
  extractPlatformTenantUuidFromRpcResponse,
  normalizePlatformBusinessName,
  normalizePlatformBusinessSlug,
  normalizeTenantLifecycleStatus,
} from "../src/lib/platform-admin/tenant-validation.ts";
import {
  buildPlatformTenantSummaries,
  type PlatformTenantRecord,
  type TenantSetupSignals,
} from "../src/lib/platform-admin/setup-completeness.ts";

const DEMO_TENANT_ID = "22222222-2222-4222-8222-222222222222";

function tenant(input: Partial<PlatformTenantRecord> & { id: string; slug: string }): PlatformTenantRecord {
  return {
    id: input.id,
    slug: input.slug,
    status: input.status ?? "inactive",
    createdAt: input.createdAt ?? "2026-08-06T00:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-08-06T00:00:00.000Z",
  };
}

function emptySignals(input: Partial<TenantSetupSignals> = {}): TenantSetupSignals {
  return {
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
    ...input,
  };
}

test("business creation validation normalizes slug and status safely", () => {
  assert.deepEqual(normalizePlatformBusinessSlug("  Demo-Dumpster-Co--"), {
    ok: true,
    value: "demo-dumpster-co",
  });
  assert.deepEqual(normalizeTenantLifecycleStatus("inactive"), {
    ok: true,
    value: "inactive",
  });
  assert.equal(DEFAULT_NEW_TENANT_TIMEZONE, "America/New_York");
  assert.equal(buildTenantStorageNamespace("demo-dumpster-co"), "demo_dumpster_co");
});

test("business creation validation rejects missing names, invalid slugs, and reserved slugs", () => {
  assert.equal(normalizePlatformBusinessName(" ").ok, false);
  assert.equal(normalizePlatformBusinessSlug("Demo Dumpster Co").ok, false);
  assert.equal(normalizePlatformBusinessSlug("platform-admin").ok, false);
  assert.equal(normalizeTenantLifecycleStatus("paused").ok, false);
});

test("new tenant minimum settings produce accurate incomplete setup status", () => {
  const [summary] = buildPlatformTenantSummaries(
    [tenant({ id: DEMO_TENANT_ID, slug: "demo-dumpster-co" })],
    new Map([
      [
        DEMO_TENANT_ID,
        emptySignals({
          settings: {
            "brand.name": "Demo Dumpster Co",
            "support.timezone": "America/New_York",
            "runtime.storageNamespace": "demo_dumpster_co",
          },
        }),
      ],
    ]),
  );

  assert.equal(summary.displayName, "Demo Dumpster Co");
  assert.equal(summary.status, "inactive");
  assert.equal(summary.setup.status, "needs_attention");
  assert.equal(summary.signals.activeAdminMembershipCount, 0);
  assert.equal(summary.signals.pricingConfigured, false);
  assert.equal(summary.signals.activeServiceAreaZipCount, 0);
  assert.equal(summary.signals.publicProductCount, 0);
  assert.equal(
    summary.setup.areas.find((area) => area.key === "websiteContent")?.status,
    "using_defaults",
  );
});

test("current-site deactivation confirmation phrase is explicit", () => {
  assert.equal(CURRENT_SITE_DEACTIVATION_CONFIRMATION, "DEACTIVATE CURRENT SITE");
});

test("tenant creation parses scalar and wrapped hosted Supabase RPC uuid responses", () => {
  const tenantId = "1618ccd7-fcaa-46e2-bb2d-2d0a60cc5bf7";

  assert.equal(extractPlatformTenantUuidFromRpcResponse(tenantId), tenantId);
  assert.equal(
    extractPlatformTenantUuidFromRpcResponse({ platform_admin_create_tenant: tenantId }),
    tenantId,
  );
  assert.equal(
    extractPlatformTenantUuidFromRpcResponse([{ platform_admin_create_tenant: tenantId }]),
    tenantId,
  );
  assert.equal(extractPlatformTenantUuidFromRpcResponse({ id: tenantId }), tenantId);
  assert.equal(extractPlatformTenantUuidFromRpcResponse([{ tenant_id: tenantId }]), tenantId);
});

test("tenant creation rejects RPC responses that do not contain a UUID", () => {
  assert.equal(extractPlatformTenantUuidFromRpcResponse(null), null);
  assert.equal(extractPlatformTenantUuidFromRpcResponse("created"), null);
  assert.equal(extractPlatformTenantUuidFromRpcResponse([{ platform_admin_create_tenant: "created" }]), null);
});
