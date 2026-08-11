import test from "node:test";
import assert from "node:assert/strict";

import {
  assertResolvedCurrentSiteTenant,
  createStrictTenantNotFoundError,
  DEFAULT_CURRENT_SITE_TENANT_SLUG,
  DEFAULT_DEMO_LOCAL_TENANT_SLUG,
  DEMO_LOCAL_HOSTNAME,
  getConfiguredCurrentTenantSlug,
  getConfiguredDemoLocalTenantSlug,
  isTenantResolutionError,
  normalizePublicHostname,
  resolveDevelopmentTenantSlugForHostname,
} from "../src/lib/tenant/resolution.ts";

test("exact default slug resolves the matching active tenant", () => {
  const tenant = {
    id: "11111111-1111-4111-8111-111111111111",
    slug: DEFAULT_CURRENT_SITE_TENANT_SLUG,
    status: "active",
  };

  assert.equal(assertResolvedCurrentSiteTenant(tenant, DEFAULT_CURRENT_SITE_TENANT_SLUG), tenant);
});

test("missing default slug does not resolve the first active tenant", () => {
  assert.throws(
    () => assertResolvedCurrentSiteTenant(null, "missing-business"),
    (error) =>
      isTenantResolutionError(error) &&
      error.code === "CURRENT_TENANT_NOT_FOUND" &&
      error.tenantIdentifier === "missing-business",
  );
});

test("inactive default tenant does not resolve another tenant", () => {
  assert.throws(
    () =>
      assertResolvedCurrentSiteTenant(
        {
          id: "11111111-1111-4111-8111-111111111111",
          slug: DEFAULT_CURRENT_SITE_TENANT_SLUG,
          status: "inactive",
        },
        DEFAULT_CURRENT_SITE_TENANT_SLUG,
      ),
    (error) =>
      isTenantResolutionError(error) &&
      error.code === "CURRENT_TENANT_INACTIVE" &&
      error.publicMessage === "This site is temporarily unavailable.",
  );
});

test("configured current-site slug uses DEFAULT_TENANT_SLUG exactly when provided", () => {
  assert.equal(
    getConfiguredCurrentTenantSlug({ DEFAULT_TENANT_SLUG: "  custom-shop  " }),
    "custom-shop",
  );
});

test("configured current-site slug falls back only to the Tan Can Man slug constant", () => {
  assert.equal(getConfiguredCurrentTenantSlug({ DEFAULT_TENANT_SLUG: "" }), "tan-can-man");
  assert.equal(getConfiguredCurrentTenantSlug({}), "tan-can-man");
});

test("hostname normalization lowercases and strips protocol, path, query, trailing dot, and port", () => {
  assert.equal(
    normalizePublicHostname("https://Demo-Dumpster-Co.Localhost:3000/pricing?tenant=tan-can-man"),
    DEMO_LOCAL_HOSTNAME,
  );
  assert.equal(normalizePublicHostname("LOCALHOST:3000"), "localhost");
  assert.equal(normalizePublicHostname("tenant.example.com."), "tenant.example.com");
});

test("invalid hostnames fail normalization instead of becoming a default tenant", () => {
  assert.equal(normalizePublicHostname(""), null);
  assert.equal(normalizePublicHostname("http://bad_host_name:3000"), null);
  assert.equal(normalizePublicHostname("tenant.example.com:abc"), null);
});

test("localhost resolves Tan Can Man only through explicit development behavior", () => {
  assert.equal(
    resolveDevelopmentTenantSlugForHostname("localhost", { DEFAULT_TENANT_SLUG: "" }),
    DEFAULT_CURRENT_SITE_TENANT_SLUG,
  );
  assert.equal(
    resolveDevelopmentTenantSlugForHostname("127.0.0.1", { DEFAULT_TENANT_SLUG: "tan-can-man" }),
    DEFAULT_CURRENT_SITE_TENANT_SLUG,
  );
});

test("Demo local hostname resolves Demo exactly through explicit development behavior", () => {
  assert.equal(
    resolveDevelopmentTenantSlugForHostname(DEMO_LOCAL_HOSTNAME, {}),
    DEFAULT_DEMO_LOCAL_TENANT_SLUG,
  );
  assert.equal(
    resolveDevelopmentTenantSlugForHostname(DEMO_LOCAL_HOSTNAME, {
      DEMO_LOCAL_TENANT_SLUG: "demo-dumpster-company",
    }),
    "demo-dumpster-company",
  );
});

test("development hostname behavior never treats unknown hostnames as Tan Can Man", () => {
  assert.equal(resolveDevelopmentTenantSlugForHostname("unknown.example.com", {}), null);
  assert.equal(resolveDevelopmentTenantSlugForHostname("tan-can-man.example.com", {}), null);
});

test("configured Demo local slug falls back only to the Demo slug constant", () => {
  assert.equal(getConfiguredDemoLocalTenantSlug({ DEMO_LOCAL_TENANT_SLUG: "" }), DEFAULT_DEMO_LOCAL_TENANT_SLUG);
  assert.equal(getConfiguredDemoLocalTenantSlug({}), DEFAULT_DEMO_LOCAL_TENANT_SLUG);
});

test("strict lookup errors are typed and do not imply tenant substitution", () => {
  const error = createStrictTenantNotFoundError({
    field: "id",
    value: "22222222-2222-4222-8222-222222222222",
    requireActive: true,
  });

  assert.equal(error.name, "TenantResolutionError");
  assert.equal(error.code, "TENANT_NOT_FOUND");
  assert.equal(error.tenantIdentifier, "22222222-2222-4222-8222-222222222222");
  assert.match(error.message, /No active tenant found for id/);
});
