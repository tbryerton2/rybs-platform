import "server-only";

import { requirePlatformAdmin } from "@/lib/platform-admin/auth";
import {
  CURRENT_SITE_DEACTIVATION_CONFIRMATION,
  DEFAULT_NEW_TENANT_TIMEZONE,
  buildTenantStorageNamespace,
  extractPlatformTenantUuidFromRpcResponse,
  normalizePlatformBusinessName,
  normalizePlatformBusinessSlug,
  normalizePlatformTenantId,
  normalizeTenantLifecycleStatus,
  type PlatformTenantValidationError,
  type TenantLifecycleStatus,
} from "@/lib/platform-admin/tenant-validation";
import {
  buildTenantSetupSummary,
  buildPlatformTenantSummaries,
  getPlatformTenantIndexStats,
  isTenantImplementationType,
  type PlatformPricingSignal,
  type PlatformTenantRecord,
  type PlatformTenantSummary,
  type TenantSetupSignals,
  type TenantImplementationType,
} from "@/lib/platform-admin/setup-completeness";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getConfiguredCurrentTenantSlug } from "@/lib/tenant/resolution";
import { findTenantByIdStrict } from "@/lib/tenant/server";

type TenantRow = {
  id: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string | null;
};

type BusinessAdminMembershipRow = {
  business_id: string;
};

type TenantSettingRow = {
  tenant_id: string;
  category: string;
  key: string;
  value_json: unknown;
};

type PricingSettingsRow = {
  id: string;
  business_id: string;
  standard_rental_price: number | string | null;
  included_rental_days: number | string | null;
  daily_overage_price: number | string | null;
  included_tons: number | string | null;
  ton_overage_price: number | string | null;
  max_rental_days: number | string | null;
};

type BusinessScopedRow = {
  business_id: string;
};

type DumpsterRow = {
  business_id: string;
  active: boolean;
  service_status: string | null;
  operational_status: string | null;
};

type TenantContentRow = {
  tenant_id: string;
  status: string;
};

type TenantDomainSignalRow = {
  tenant_id: string;
  domain_type: string;
};

type TenantDomainRow = {
  id: string;
  hostname: string;
  domain_type: string;
  status: string;
  is_primary: boolean;
  provider: string | null;
  provider_status: string;
  verification_status: string;
  dns_instructions: unknown;
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string | null;
};

export type PlatformTenantDomain = {
  id: string;
  hostname: string;
  domainType: string;
  status: string;
  isPrimary: boolean;
  provider: string | null;
  providerStatus: string;
  verificationStatus: string;
  dnsInstructions: unknown;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type PlatformTenantIndex = {
  tenants: PlatformTenantSummary[];
  stats: ReturnType<typeof getPlatformTenantIndexStats>;
};

export type PlatformTenantDetail = {
  tenant: PlatformTenantSummary;
  domains: PlatformTenantDomain[];
};

const TENANT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PlatformTenantMutationErrorCode =
  | "invalid_input"
  | "duplicate_slug"
  | "duplicate_admin_membership"
  | "auth_user_not_found"
  | "not_found"
  | "stale_update"
  | "already_active"
  | "already_inactive"
  | "confirmation_required"
  | "database_error";

export class PlatformTenantMutationError extends Error {
  code: PlatformTenantMutationErrorCode;
  field?: PlatformTenantValidationError["field"];

  constructor(
    code: PlatformTenantMutationErrorCode,
    message: string,
    field?: PlatformTenantValidationError["field"],
  ) {
    super(message);
    this.name = "PlatformTenantMutationError";
    this.code = code;
    this.field = field;
  }
}

type SupabaseDbError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

export type CreatePlatformTenantInput = {
  businessName: unknown;
  slug: unknown;
  status: unknown;
};

export type UpdatePlatformTenantBasicInput = {
  tenantId: unknown;
  businessName: unknown;
  slug: unknown;
  expectedUpdatedAt?: unknown;
};

export type UpdatePlatformTenantLifecycleStatusInput = {
  tenantId: unknown;
  targetStatus: unknown;
  acknowledgeIncompleteSetup?: unknown;
  confirmationSlug?: unknown;
  currentSiteConfirmation?: unknown;
};

export type UpdatePlatformTenantImplementationInput = {
  tenantId: unknown;
  implementationType: unknown;
};

export type AssignBusinessAdminInput = {
  tenantId: unknown;
  email: unknown;
};

function mapTenantRow(row: TenantRow): PlatformTenantRecord {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTenantDomainRow(row: TenantDomainRow): PlatformTenantDomain {
  return {
    id: row.id,
    hostname: row.hostname,
    domainType: row.domain_type,
    status: row.status,
    isPrimary: row.is_primary,
    provider: row.provider,
    providerStatus: row.provider_status,
    verificationStatus: row.verification_status,
    dnsInstructions: row.dns_instructions,
    lastCheckedAt: row.last_checked_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createEmptySignals(): TenantSetupSignals {
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
  };
}

function initializeSignalMap(tenantIds: string[]) {
  return new Map(tenantIds.map((tenantId) => [tenantId, createEmptySignals()]));
}

function requireSignals(signalsByTenantId: Map<string, TenantSetupSignals>, tenantId: string) {
  const signals = signalsByTenantId.get(tenantId);

  if (!signals) {
    throw new Error(`Unexpected tenant setup signal for tenant ${tenantId}.`);
  }

  return signals;
}

function incrementBusinessCount(
  signalsByTenantId: Map<string, TenantSetupSignals>,
  tenantId: string,
  key: keyof Pick<
    TenantSetupSignals,
    | "activeAdminMembershipCount"
    | "activeServiceAreaZipCount"
    | "activeDumpsterCount"
    | "bookableDumpsterCount"
    | "publicProductCount"
    | "activePublicDomainCount"
    | "activePlatformSubdomainCount"
    | "activeCustomDomainCount"
    | "activeBookingDomainCount"
  >,
) {
  const signals = requireSignals(signalsByTenantId, tenantId);
  signals[key] += 1;
}

function isBookableDumpster(row: DumpsterRow) {
  return (
    row.active &&
    row.service_status === "Ready" &&
    row.operational_status !== "Maintenance hold"
  );
}

function mapPricingSignal(row: PricingSettingsRow): PlatformPricingSignal {
  return {
    id: row.id,
    standardRentalPrice: row.standard_rental_price,
    includedRentalDays: row.included_rental_days,
    dailyOveragePrice: row.daily_overage_price,
    includedTons: row.included_tons,
    tonOveragePrice: row.ton_overage_price,
    maxRentalDays: row.max_rental_days,
  };
}

function assertNoQueryError(result: { error: { message: string } | null }) {
  if (result.error) {
    throw new Error(result.error.message);
  }
}

function logPlatformTenantMutationError(event: string, details: Record<string, unknown>) {
  console.error("[platform-admin-tenants]", { event, ...details });
}

function throwValidationError(error: PlatformTenantValidationError): never {
  throw new PlatformTenantMutationError("invalid_input", error.message, error.field);
}

function mapDatabaseMutationError(error: SupabaseDbError, context: Record<string, unknown>): never {
  logPlatformTenantMutationError("mutation_database_error", {
    ...context,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  if (error.code === "23505" || error.message?.includes("tenants_slug_key")) {
    throw new PlatformTenantMutationError(
      "duplicate_slug",
      "That slug is already used by another business.",
      "slug",
    );
  }

  if (error.message?.includes("PLATFORM_TENANT_NOT_FOUND")) {
    throw new PlatformTenantMutationError("not_found", "Business not found.", "tenantId");
  }

  if (error.message?.includes("PLATFORM_TENANT_STALE")) {
    throw new PlatformTenantMutationError(
      "stale_update",
      "This business changed since you opened the page. Refresh and try again.",
      "updatedAt",
    );
  }

  throw new PlatformTenantMutationError(
    "database_error",
    "We could not save this business. Try again in a moment.",
  );
}

async function assertSlugAvailable(slug: string, exceptTenantId?: string) {
  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    mapDatabaseMutationError(error, { operation: "check_slug", slug, exceptTenantId });
  }

  const existingTenantId = (data as { id: string } | null)?.id;

  if (existingTenantId && existingTenantId !== exceptTenantId) {
    throw new PlatformTenantMutationError(
      "duplicate_slug",
      "That slug is already used by another business.",
      "slug",
    );
  }
}

async function requirePlatformTenantForMutation(tenantId: string) {
  const tenant = await findTenantByIdStrict(tenantId, { requireActive: false });

  if (!tenant) {
    throw new PlatformTenantMutationError("not_found", "Business not found.", "tenantId");
  }

  return tenant;
}

function normalizeExpectedUpdatedAt(input: unknown) {
  const value = typeof input === "string" ? input.trim() : "";
  return value || null;
}

function normalizeImplementationType(input: unknown): TenantImplementationType | null {
  const value = typeof input === "string" ? input.trim() : "";
  if (!value) return null;

  if (isTenantImplementationType(value)) {
    return value;
  }

  throw new PlatformTenantMutationError(
    "invalid_input",
    "Choose a valid implementation type.",
    "status",
  );
}

function normalizeAdminEmail(input: unknown) {
  const email = typeof input === "string" ? input.trim().toLowerCase() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new PlatformTenantMutationError(
      "invalid_input",
      "Enter the exact email for an existing Supabase Auth user.",
      "status",
    );
  }

  return email;
}

function formBoolean(value: unknown) {
  return value === true || value === "true" || value === "1" || value === "on";
}

async function requireActivationAcknowledgementIfIncomplete(input: {
  tenant: Awaited<ReturnType<typeof requirePlatformTenantForMutation>>;
  acknowledgeIncompleteSetup?: unknown;
}) {
  const tenantRecord: PlatformTenantRecord = {
    id: input.tenant.id,
    slug: input.tenant.slug,
    status: input.tenant.status,
    createdAt: input.tenant.created_at,
    updatedAt: input.tenant.updated_at,
  };
  const signalsByTenantId = await loadTenantSetupSignals([input.tenant.id]);
  const setup = buildTenantSetupSummary(
    tenantRecord,
    signalsByTenantId.get(input.tenant.id),
  );

  if (setup.status === "complete") {
    return;
  }

  if (!formBoolean(input.acknowledgeIncompleteSetup)) {
    throw new PlatformTenantMutationError(
      "confirmation_required",
      "Confirm that you want to activate this business before required setup is complete.",
      "confirmation",
    );
  }
}

async function findExistingAuthUserByExactEmail(email: string) {
  const perPage = 1000;
  const maxPages = 20;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      mapDatabaseMutationError(error, { operation: "list_auth_users_for_admin_assignment" });
    }

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) {
      return user;
    }

    if (data.users.length < perPage) {
      break;
    }
  }

  throw new PlatformTenantMutationError(
    "auth_user_not_found",
    "No existing Supabase Auth user was found for that exact email.",
    "status",
  );
}

function requireDeactivationConfirmation(input: {
  tenantSlug: string;
  confirmationSlug?: unknown;
  currentSiteConfirmation?: unknown;
}) {
  const confirmationSlug =
    typeof input.confirmationSlug === "string"
      ? input.confirmationSlug.trim().toLowerCase()
      : "";

  if (confirmationSlug !== input.tenantSlug) {
    throw new PlatformTenantMutationError(
      "confirmation_required",
      "Type the business slug to confirm deactivation.",
      "confirmation",
    );
  }

  const configuredCurrentSiteSlug = getConfiguredCurrentTenantSlug();

  if (input.tenantSlug === configuredCurrentSiteSlug) {
    const confirmationPhrase =
      typeof input.currentSiteConfirmation === "string"
        ? input.currentSiteConfirmation.trim()
        : "";

    if (confirmationPhrase !== CURRENT_SITE_DEACTIVATION_CONFIRMATION) {
      throw new PlatformTenantMutationError(
        "confirmation_required",
        `Type ${CURRENT_SITE_DEACTIVATION_CONFIRMATION} to deactivate the configured current-site tenant.`,
        "confirmation",
      );
    }
  }
}

async function loadTenantSetupSignals(tenantIds: string[]) {
  const signalsByTenantId = initializeSignalMap(tenantIds);

  if (tenantIds.length === 0) {
    return signalsByTenantId;
  }

  const [
    adminMemberships,
    settings,
    pricing,
    serviceAreaZips,
    dumpsters,
    productSettings,
    tenantDomains,
    contentEntries,
  ] = await Promise.all([
    supabaseAdmin
      .from("business_admin_memberships")
      .select("business_id")
      .in("business_id", tenantIds)
      .eq("status", "active"),
    supabaseAdmin
      .from("tenant_settings")
      .select("tenant_id, category, key, value_json")
      .in("tenant_id", tenantIds),
    supabaseAdmin
      .from("pricing_settings")
      .select(
        "id, business_id, standard_rental_price, included_rental_days, daily_overage_price, included_tons, ton_overage_price, max_rental_days",
      )
      .in("business_id", tenantIds),
    supabaseAdmin
      .from("service_area_zips")
      .select("business_id")
      .in("business_id", tenantIds)
      .eq("active", true),
    supabaseAdmin
      .from("dumpsters")
      .select("business_id, active, service_status, operational_status")
      .in("business_id", tenantIds),
    supabaseAdmin
      .from("dumpster_product_settings")
      .select("business_id")
      .in("business_id", tenantIds)
      .eq("is_public", true),
    supabaseAdmin
      .from("tenant_domains")
      .select("tenant_id, domain_type")
      .in("tenant_id", tenantIds)
      .eq("status", "active"),
    supabaseAdmin
      .from("tenant_content_entries")
      .select("tenant_id, status")
      .in("tenant_id", tenantIds)
      .in("status", ["published", "draft"]),
  ]);

  for (const result of [
    adminMemberships,
    settings,
    pricing,
    serviceAreaZips,
    dumpsters,
    productSettings,
    tenantDomains,
    contentEntries,
  ]) {
    assertNoQueryError(result);
  }

  for (const row of (adminMemberships.data ?? []) as BusinessAdminMembershipRow[]) {
    incrementBusinessCount(signalsByTenantId, row.business_id, "activeAdminMembershipCount");
  }

  for (const row of (settings.data ?? []) as TenantSettingRow[]) {
    const tenantSignals = requireSignals(signalsByTenantId, row.tenant_id);
    tenantSignals.settings[`${row.category}.${row.key}`] = row.value_json;
  }

  for (const row of (pricing.data ?? []) as PricingSettingsRow[]) {
    const tenantSignals = requireSignals(signalsByTenantId, row.business_id);
    tenantSignals.pricing = tenantSignals.pricing ?? mapPricingSignal(row);
  }

  for (const row of (serviceAreaZips.data ?? []) as BusinessScopedRow[]) {
    incrementBusinessCount(signalsByTenantId, row.business_id, "activeServiceAreaZipCount");
  }

  for (const row of (dumpsters.data ?? []) as DumpsterRow[]) {
    if (row.active) {
      incrementBusinessCount(signalsByTenantId, row.business_id, "activeDumpsterCount");
    }

    if (isBookableDumpster(row)) {
      incrementBusinessCount(signalsByTenantId, row.business_id, "bookableDumpsterCount");
    }
  }

  for (const row of (productSettings.data ?? []) as BusinessScopedRow[]) {
    incrementBusinessCount(signalsByTenantId, row.business_id, "publicProductCount");
  }

  for (const row of (tenantDomains.data ?? []) as TenantDomainSignalRow[]) {
    incrementBusinessCount(signalsByTenantId, row.tenant_id, "activePublicDomainCount");
    if (row.domain_type === "platform_subdomain") {
      incrementBusinessCount(signalsByTenantId, row.tenant_id, "activePlatformSubdomainCount");
    } else if (row.domain_type === "custom_domain") {
      incrementBusinessCount(signalsByTenantId, row.tenant_id, "activeCustomDomainCount");
    } else if (row.domain_type === "booking_domain") {
      incrementBusinessCount(signalsByTenantId, row.tenant_id, "activeBookingDomainCount");
    }
  }

  for (const row of (contentEntries.data ?? []) as TenantContentRow[]) {
    const tenantSignals = requireSignals(signalsByTenantId, row.tenant_id);

    if (row.status === "published") {
      tenantSignals.publishedContentCount += 1;
    } else if (row.status === "draft") {
      tenantSignals.draftContentCount += 1;
    }
  }

  return signalsByTenantId;
}

export async function getPlatformTenantIndex(): Promise<PlatformTenantIndex> {
  await requirePlatformAdmin();

  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("id, slug, status, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const tenants = ((data ?? []) as TenantRow[]).map(mapTenantRow);
  const signalsByTenantId = await loadTenantSetupSignals(tenants.map((tenant) => tenant.id));
  const summaries = buildPlatformTenantSummaries(tenants, signalsByTenantId);

  return {
    tenants: summaries,
    stats: getPlatformTenantIndexStats(summaries),
  };
}

export async function getPlatformTenantDetail(
  tenantId: string,
): Promise<PlatformTenantDetail | null> {
  await requirePlatformAdmin();

  if (!TENANT_UUID_PATTERN.test(tenantId)) {
    return null;
  }

  const tenant = await findTenantByIdStrict(tenantId);

  if (!tenant) {
    return null;
  }

  const tenantRecord: PlatformTenantRecord = {
    id: tenant.id,
    slug: tenant.slug,
    status: tenant.status,
    createdAt: tenant.created_at,
    updatedAt: tenant.updated_at,
  };
  const signalsByTenantId = await loadTenantSetupSignals([tenant.id]);
  const [summary] = buildPlatformTenantSummaries([tenantRecord], signalsByTenantId);
  const { data: domainRows, error: domainError } = await supabaseAdmin
    .from("tenant_domains")
    .select(
      "id, hostname, domain_type, status, is_primary, provider, provider_status, verification_status, dns_instructions, last_checked_at, last_error, created_at, updated_at",
    )
    .eq("tenant_id", tenant.id)
    .order("is_primary", { ascending: false })
    .order("hostname", { ascending: true });

  if (domainError) {
    throw new Error(domainError.message);
  }

  return {
    tenant: summary,
    domains: ((domainRows ?? []) as TenantDomainRow[]).map(mapTenantDomainRow),
  };
}

export async function createPlatformTenant(input: CreatePlatformTenantInput) {
  await requirePlatformAdmin();

  const businessName = normalizePlatformBusinessName(input.businessName);
  if (!businessName.ok) throwValidationError(businessName.error);

  const slug = normalizePlatformBusinessSlug(input.slug);
  if (!slug.ok) throwValidationError(slug.error);

  const status = normalizeTenantLifecycleStatus(input.status);
  if (!status.ok) throwValidationError(status.error);

  await assertSlugAvailable(slug.value);

  const rpcResult = await supabaseAdmin.rpc("platform_admin_create_tenant", {
    p_brand_name: businessName.value,
    p_slug: slug.value,
    p_status: status.value,
    p_storage_namespace: buildTenantStorageNamespace(slug.value),
    p_timezone: DEFAULT_NEW_TENANT_TIMEZONE,
  });

  if (rpcResult.error) {
    mapDatabaseMutationError(rpcResult.error, {
      operation: "create_tenant",
      slug: slug.value,
    });
  }

  const createdTenantId = extractPlatformTenantUuidFromRpcResponse(
    rpcResult.data,
    "platform_admin_create_tenant",
  );

  if (!createdTenantId) {
    logPlatformTenantMutationError("mutation_invalid_rpc_response", {
      operation: "create_tenant",
      slug: slug.value,
      responseShape: Array.isArray(rpcResult.data) ? "array" : typeof rpcResult.data,
      responseKeys:
        rpcResult.data && typeof rpcResult.data === "object" && !Array.isArray(rpcResult.data)
          ? Object.keys(rpcResult.data)
          : undefined,
    });
    throw new PlatformTenantMutationError(
      "database_error",
      "The business was created but the response could not be verified.",
    );
  }

  return { tenantId: createdTenantId };
}

export async function updatePlatformTenantBasic(input: UpdatePlatformTenantBasicInput) {
  await requirePlatformAdmin();

  const tenantId = normalizePlatformTenantId(input.tenantId);
  if (!tenantId.ok) throwValidationError(tenantId.error);

  const businessName = normalizePlatformBusinessName(input.businessName);
  if (!businessName.ok) throwValidationError(businessName.error);

  const slug = normalizePlatformBusinessSlug(input.slug);
  if (!slug.ok) throwValidationError(slug.error);

  await requirePlatformTenantForMutation(tenantId.value);
  await assertSlugAvailable(slug.value, tenantId.value);

  const rpcResult = await supabaseAdmin.rpc("platform_admin_update_tenant_basic", {
    p_brand_name: businessName.value,
    p_expected_updated_at: normalizeExpectedUpdatedAt(input.expectedUpdatedAt),
    p_slug: slug.value,
    p_tenant_id: tenantId.value,
  });

  if (rpcResult.error) {
    mapDatabaseMutationError(rpcResult.error, {
      operation: "update_tenant_basic",
      tenantId: tenantId.value,
      slug: slug.value,
    });
  }

  return { tenantId: tenantId.value };
}

export async function updatePlatformTenantImplementation(
  input: UpdatePlatformTenantImplementationInput,
) {
  await requirePlatformAdmin();

  const tenantId = normalizePlatformTenantId(input.tenantId);
  if (!tenantId.ok) throwValidationError(tenantId.error);

  const implementationType = normalizeImplementationType(input.implementationType);
  const tenant = await requirePlatformTenantForMutation(tenantId.value);

  if (!implementationType) {
    const { error } = await supabaseAdmin.from("tenant_settings").upsert(
      {
        tenant_id: tenant.id,
        category: "implementation",
        key: "type",
        value_json: "",
      },
      { onConflict: "tenant_id,category,key" },
    );

    if (error) {
      mapDatabaseMutationError(error, {
        operation: "clear_tenant_implementation_type",
        tenantId: tenant.id,
      });
    }

    return { tenantId: tenant.id, implementationType: null };
  }

  const { error } = await supabaseAdmin.from("tenant_settings").upsert(
    {
      tenant_id: tenant.id,
      category: "implementation",
      key: "type",
      value_json: implementationType,
    },
    { onConflict: "tenant_id,category,key" },
  );

  if (error) {
    mapDatabaseMutationError(error, {
      operation: "update_tenant_implementation_type",
      tenantId: tenant.id,
      implementationType,
    });
  }

  return { tenantId: tenant.id, implementationType };
}

export async function assignExistingUserAsBusinessAdmin(input: AssignBusinessAdminInput) {
  await requirePlatformAdmin();

  const tenantId = normalizePlatformTenantId(input.tenantId);
  if (!tenantId.ok) throwValidationError(tenantId.error);

  const email = normalizeAdminEmail(input.email);
  const tenant = await requirePlatformTenantForMutation(tenantId.value);
  const user = await findExistingAuthUserByExactEmail(email);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("business_admin_memberships")
    .select("id, status")
    .eq("business_id", tenant.id)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existingError) {
    mapDatabaseMutationError(existingError, {
      operation: "check_business_admin_membership",
      tenantId: tenant.id,
      authUserId: user.id,
    });
  }

  const existingMembership = existing as { id: string; status: string } | null;
  if (existingMembership?.status === "active") {
    throw new PlatformTenantMutationError(
      "duplicate_admin_membership",
      "That user already has active admin access for this business.",
      "status",
    );
  }

  if (existingMembership) {
    const { error } = await supabaseAdmin
      .from("business_admin_memberships")
      .update({ role: "owner", status: "active" })
      .eq("id", existingMembership.id)
      .eq("business_id", tenant.id)
      .eq("auth_user_id", user.id);

    if (error) {
      mapDatabaseMutationError(error, {
        operation: "reactivate_business_admin_membership",
        tenantId: tenant.id,
        authUserId: user.id,
      });
    }

    return { tenantId: tenant.id, authUserId: user.id, email, reactivated: true };
  }

  const { error } = await supabaseAdmin.from("business_admin_memberships").insert({
    business_id: tenant.id,
    auth_user_id: user.id,
    role: "owner",
    status: "active",
  });

  if (error) {
    mapDatabaseMutationError(error, {
      operation: "assign_business_admin_membership",
      tenantId: tenant.id,
      authUserId: user.id,
    });
  }

  return { tenantId: tenant.id, authUserId: user.id, email, reactivated: false };
}

export async function updatePlatformTenantLifecycleStatus(
  input: UpdatePlatformTenantLifecycleStatusInput,
) {
  await requirePlatformAdmin();

  const tenantId = normalizePlatformTenantId(input.tenantId);
  if (!tenantId.ok) throwValidationError(tenantId.error);

  const targetStatus = normalizeTenantLifecycleStatus(input.targetStatus);
  if (!targetStatus.ok) throwValidationError(targetStatus.error);

  const tenant = await requirePlatformTenantForMutation(tenantId.value);
  const currentStatus = tenant.status as TenantLifecycleStatus;

  if (targetStatus.value === "active" && currentStatus === "active") {
    throw new PlatformTenantMutationError(
      "already_active",
      "This business is already active.",
      "status",
    );
  }

  if (targetStatus.value === "inactive" && currentStatus === "inactive") {
    throw new PlatformTenantMutationError(
      "already_inactive",
      "This business is already inactive.",
      "status",
    );
  }

  if (targetStatus.value === "inactive") {
    requireDeactivationConfirmation({
      tenantSlug: tenant.slug,
      confirmationSlug: input.confirmationSlug,
      currentSiteConfirmation: input.currentSiteConfirmation,
    });
  }

  if (targetStatus.value === "active") {
    await requireActivationAcknowledgementIfIncomplete({
      tenant,
      acknowledgeIncompleteSetup: input.acknowledgeIncompleteSetup,
    });
  }

  const { data, error } = await supabaseAdmin
    .from("tenants")
    .update({ status: targetStatus.value })
    .eq("id", tenant.id)
    .eq("status", currentStatus)
    .select("id")
    .maybeSingle();

  if (error) {
    mapDatabaseMutationError(error, {
      operation: "update_tenant_status",
      tenantId: tenant.id,
      targetStatus: targetStatus.value,
    });
  }

  if (!(data as { id: string } | null)?.id) {
    throw new PlatformTenantMutationError(
      "stale_update",
      "This business changed since you opened the page. Refresh and try again.",
      "status",
    );
  }

  return {
    tenantId: tenant.id,
    status: targetStatus.value,
  };
}
