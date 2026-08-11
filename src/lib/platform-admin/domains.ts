import "server-only";

import { requirePlatformAdmin } from "@/lib/platform-admin/auth";
import {
  isPlatformTenantUuid,
  normalizePlatformTenantId,
  type PlatformTenantValidationError,
} from "@/lib/platform-admin/tenant-validation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isPlainLocalhostHostname,
  normalizePublicHostname,
} from "@/lib/tenant/resolution";
import { findTenantByIdStrict } from "@/lib/tenant/server";
import {
  VERCEL_PROVIDER,
  buildVercelDomainSnapshot,
  buildWildcardPlatformSubdomainSnapshot,
  getVercelDomainIntegrationDiagnostics,
  isPlatformSubdomainCoveredByConfiguredWildcard,
  provisionVercelProjectDomain,
  removeVercelProjectDomain,
  fetchVercelDomainSnapshot,
  type VercelDnsInstructions,
  type VercelDomainProviderStatus,
  type VercelDomainVerificationStatus,
} from "@/lib/platform-admin/vercel-domains";

export const PLATFORM_DOMAIN_TYPES = [
  "platform_subdomain",
  "custom_domain",
  "booking_domain",
] as const;

export const PLATFORM_DOMAIN_STATUSES = ["active", "pending", "disabled"] as const;

export type PlatformDomainType = (typeof PLATFORM_DOMAIN_TYPES)[number];
export type PlatformDomainStatus = (typeof PLATFORM_DOMAIN_STATUSES)[number];
export type PlatformDomainProvider = typeof VERCEL_PROVIDER;

export type PlatformDomainField =
  | PlatformTenantValidationError["field"]
  | "domainId"
  | "hostname"
  | "domainType"
  | "domainStatus"
  | "providerStatus"
  | "primary"
  | "confirmation";

export type PlatformTenantDomain = {
  id: string;
  tenantId: string;
  hostname: string;
  domainType: PlatformDomainType;
  status: PlatformDomainStatus;
  isPrimary: boolean;
  provider: PlatformDomainProvider | null;
  providerStatus: VercelDomainProviderStatus;
  verificationStatus: VercelDomainVerificationStatus;
  dnsInstructions: VercelDnsInstructions | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string | null;
};

type TenantDomainRow = {
  id: string;
  tenant_id: string;
  hostname: string;
  domain_type: PlatformDomainType;
  status: PlatformDomainStatus;
  is_primary: boolean;
  provider: PlatformDomainProvider | null;
  provider_status: VercelDomainProviderStatus;
  verification_status: VercelDomainVerificationStatus;
  dns_instructions: VercelDnsInstructions | null;
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string | null;
};

type SupabaseDbError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

const TENANT_DOMAIN_SELECT =
  "id, tenant_id, hostname, domain_type, status, is_primary, provider, provider_status, verification_status, dns_instructions, last_checked_at, last_error, created_at, updated_at";

export type CreatePlatformTenantDomainInput = {
  tenantId: unknown;
  hostname: unknown;
  domainType: unknown;
  status?: unknown;
  isPrimary?: unknown;
};

export type UpdatePlatformTenantDomainInput = {
  tenantId: unknown;
  domainId: unknown;
  domainType: unknown;
  status: unknown;
  isPrimary?: unknown;
};

export type TenantDomainMutationInput = {
  tenantId: unknown;
  domainId: unknown;
};

export type RemovePlatformTenantDomainInput = TenantDomainMutationInput & {
  confirmation?: unknown;
  clearPrimary?: unknown;
  acknowledgeLastActive?: unknown;
};

export class PlatformDomainMutationError extends Error {
  code:
    | "invalid_input"
    | "duplicate_hostname"
    | "not_found"
    | "unsafe_removal"
    | "provider_not_configured"
    | "provider_error"
    | "database_error";
  field?: PlatformDomainField;

  constructor(
    code: PlatformDomainMutationError["code"],
    message: string,
    field?: PlatformDomainField,
  ) {
    super(message);
    this.name = "PlatformDomainMutationError";
    this.code = code;
    this.field = field;
  }
}

function mapTenantDomainRow(row: TenantDomainRow): PlatformTenantDomain {
  return {
    id: row.id,
    tenantId: row.tenant_id,
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

function asBoolean(value: unknown) {
  return value === true || value === "true" || value === "1" || value === "on";
}

function throwValidationError(message: string, field: PlatformDomainField): never {
  throw new PlatformDomainMutationError("invalid_input", message, field);
}

function logDomainMutationError(event: string, details: Record<string, unknown>) {
  console.error("[platform-admin-domains]", { event, ...details });
}

function mapDatabaseMutationError(error: SupabaseDbError, context: Record<string, unknown>): never {
  logDomainMutationError("mutation_database_error", {
    ...context,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  if (
    error.code === "23505" ||
    error.message?.includes("tenant_domains_hostname_unique")
  ) {
    throw new PlatformDomainMutationError(
      "duplicate_hostname",
      "That hostname is already assigned to a business.",
      "hostname",
    );
  }

  if (error.message?.includes("PLATFORM_TENANT_DOMAIN_NOT_FOUND")) {
    throw new PlatformDomainMutationError("not_found", "Domain mapping not found.", "domainId");
  }

  if (error.message?.includes("PLATFORM_TENANT_DOMAIN_PRIMARY_REQUIRES_ACTIVE")) {
    throw new PlatformDomainMutationError(
      "invalid_input",
      "Only active domains can be marked primary.",
      "primary",
    );
  }

  throw new PlatformDomainMutationError(
    "database_error",
    "We could not save this domain mapping. Try again in a moment.",
  );
}

function normalizeDomainType(input: unknown): PlatformDomainType {
  if (PLATFORM_DOMAIN_TYPES.includes(input as PlatformDomainType)) {
    return input as PlatformDomainType;
  }

  throwValidationError("Choose a valid domain type.", "domainType");
}

function normalizeDomainStatus(input: unknown, fallback: PlatformDomainStatus): PlatformDomainStatus {
  const value = typeof input === "string" && input.trim() ? input.trim() : fallback;

  if (PLATFORM_DOMAIN_STATUSES.includes(value as PlatformDomainStatus)) {
    return value as PlatformDomainStatus;
  }

  throwValidationError("Choose a valid domain status.", "domainStatus");
}

export function normalizePlatformDomainHostname(input: unknown) {
  const raw = typeof input === "string" ? input.trim() : "";

  if (!raw) {
    throwValidationError("Enter a hostname.", "hostname");
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    throwValidationError("Enter only the hostname, without a protocol.", "hostname");
  }

  if (/[/?#]/.test(raw)) {
    throwValidationError("Enter only the hostname, without a path or query string.", "hostname");
  }

  if (raw.includes(":")) {
    throwValidationError("Enter only the hostname, without a port.", "hostname");
  }

  const hostname = normalizePublicHostname(raw);
  if (!hostname) {
    throwValidationError("Enter a valid hostname.", "hostname");
  }

  if (isPlainLocalhostHostname(hostname) || hostname.endsWith(".localhost")) {
    throwValidationError("Localhost development hostnames are handled by code and should not be stored.", "hostname");
  }

  return hostname;
}

function normalizeDomainId(input: unknown) {
  const domainId = typeof input === "string" ? input.trim() : "";

  if (!isPlatformTenantUuid(domainId)) {
    throwValidationError("Unknown domain mapping.", "domainId");
  }

  return domainId;
}

async function requireTenantForDomainMutation(tenantIdInput: unknown) {
  const tenantId = normalizePlatformTenantId(tenantIdInput);
  if (!tenantId.ok) {
    throwValidationError(tenantId.error.message, tenantId.error.field);
  }

  const tenant = await findTenantByIdStrict(tenantId.value, { requireActive: false });
  if (!tenant) {
    throw new PlatformDomainMutationError("not_found", "Business not found.", "tenantId");
  }

  return tenant;
}

async function loadDomainForTenant(tenantId: string, domainId: string) {
  const { data, error } = await supabaseAdmin
    .from("tenant_domains")
    .select(TENANT_DOMAIN_SELECT)
    .eq("id", domainId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    mapDatabaseMutationError(error, { operation: "load_domain", tenantId, domainId });
  }

  if (!data) {
    throw new PlatformDomainMutationError("not_found", "Domain mapping not found.", "domainId");
  }

  return mapTenantDomainRow(data as TenantDomainRow);
}

async function countActiveDomainsForTenant(tenantId: string) {
  const { count, error } = await supabaseAdmin
    .from("tenant_domains")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  if (error) {
    mapDatabaseMutationError(error, { operation: "count_active_domains", tenantId });
  }

  return count ?? 0;
}

async function assertHostnameAvailableForTenant(hostname: string, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("tenant_domains")
    .select("id, tenant_id")
    .eq("hostname", hostname)
    .maybeSingle();

  if (error) {
    mapDatabaseMutationError(error, { operation: "check_hostname", hostname, tenantId });
  }

  const existing = data as { id: string; tenant_id: string } | null;
  if (!existing) return;

  if (existing.tenant_id === tenantId) {
    throw new PlatformDomainMutationError(
      "duplicate_hostname",
      "That hostname is already assigned to this business.",
      "hostname",
    );
  }

  throw new PlatformDomainMutationError(
    "duplicate_hostname",
    "That hostname is already assigned to another business.",
    "hostname",
  );
}

async function clearDomainPrimary(tenantId: string, domainId: string) {
  const { error } = await supabaseAdmin
    .from("tenant_domains")
    .update({ is_primary: false })
    .eq("id", domainId)
    .eq("tenant_id", tenantId);

  if (error) {
    mapDatabaseMutationError(error, { operation: "clear_primary", tenantId, domainId });
  }
}

function mapProviderError(error: unknown): PlatformDomainMutationError {
  if (error instanceof PlatformDomainMutationError) {
    return error;
  }

  const message = error instanceof Error
    ? error.message
    : "Vercel could not complete the domain request. Try again in a moment.";

  if (message.includes("VERCEL_API_TOKEN") || message.includes("VERCEL_PROJECT_ID")) {
    return new PlatformDomainMutationError("provider_not_configured", message, "providerStatus");
  }

  return new PlatformDomainMutationError("provider_error", message, "providerStatus");
}

function providerSnapshotUpdate(snapshot: ReturnType<typeof buildVercelDomainSnapshot>) {
  return {
    provider: snapshot.provider,
    provider_status: snapshot.providerStatus,
    verification_status: snapshot.verificationStatus,
    dns_instructions: snapshot.dnsInstructions,
    last_checked_at: snapshot.lastCheckedAt,
    last_error: snapshot.lastError,
  };
}

async function updateDomainProviderSnapshot(
  domain: PlatformTenantDomain,
  snapshot: ReturnType<typeof buildVercelDomainSnapshot>,
) {
  const { error } = await supabaseAdmin
    .from("tenant_domains")
    .update(providerSnapshotUpdate(snapshot))
    .eq("id", domain.id)
    .eq("tenant_id", domain.tenantId);

  if (error) {
    mapDatabaseMutationError(error, {
      operation: "update_domain_provider_snapshot",
      tenantId: domain.tenantId,
      domainId: domain.id,
    });
  }
}

async function markDomainProviderError(
  domain: PlatformTenantDomain,
  error: PlatformDomainMutationError,
) {
  const { error: dbError } = await supabaseAdmin
    .from("tenant_domains")
    .update({
      provider: VERCEL_PROVIDER,
      provider_status: "error",
      verification_status: domain.verificationStatus,
      last_checked_at: new Date().toISOString(),
      last_error: error.message,
    })
    .eq("id", domain.id)
    .eq("tenant_id", domain.tenantId);

  if (dbError) {
    mapDatabaseMutationError(dbError, {
      operation: "mark_domain_provider_error",
      tenantId: domain.tenantId,
      domainId: domain.id,
    });
  }
}

async function markDomainProvisioning(domain: PlatformTenantDomain) {
  const { error } = await supabaseAdmin
    .from("tenant_domains")
    .update({
      provider: VERCEL_PROVIDER,
      provider_status: "provisioning",
      last_checked_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", domain.id)
    .eq("tenant_id", domain.tenantId);

  if (error) {
    mapDatabaseMutationError(error, {
      operation: "mark_domain_provisioning",
      tenantId: domain.tenantId,
      domainId: domain.id,
    });
  }
}

function isWildcardReadyPlatformSubdomain(domain: Pick<PlatformTenantDomain, "domainType" | "hostname">) {
  return domain.domainType === "platform_subdomain" &&
    isPlatformSubdomainCoveredByConfiguredWildcard(domain.hostname);
}

function assertDomainCanBecomeActive(domain: PlatformTenantDomain) {
  if (domain.providerStatus === "ready") {
    return;
  }

  if (isWildcardReadyPlatformSubdomain(domain)) {
    return;
  }

  throw new PlatformDomainMutationError(
    "invalid_input",
    "This domain cannot be activated until Vercel reports it is configured and verified.",
    "domainStatus",
  );
}

export function getPlatformDomainIntegrationStatus() {
  return getVercelDomainIntegrationDiagnostics();
}

export async function listPlatformTenantDomains(tenantIdInput: unknown) {
  await requirePlatformAdmin();
  const tenant = await requireTenantForDomainMutation(tenantIdInput);

  const { data, error } = await supabaseAdmin
    .from("tenant_domains")
    .select(TENANT_DOMAIN_SELECT)
    .eq("tenant_id", tenant.id)
    .order("is_primary", { ascending: false })
    .order("hostname", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as TenantDomainRow[]).map(mapTenantDomainRow);
}

export async function createPlatformTenantDomain(input: CreatePlatformTenantDomainInput) {
  await requirePlatformAdmin();
  const tenant = await requireTenantForDomainMutation(input.tenantId);
  const hostname = normalizePlatformDomainHostname(input.hostname);
  const domainType = normalizeDomainType(input.domainType);
  const status = normalizeDomainStatus(input.status, "pending");
  const isPrimary = asBoolean(input.isPrimary);
  const wildcardSnapshot = domainType === "platform_subdomain" &&
    isPlatformSubdomainCoveredByConfiguredWildcard(hostname)
    ? buildWildcardPlatformSubdomainSnapshot(hostname)
    : null;

  if (status === "active" && !wildcardSnapshot) {
    throwValidationError(
      "Production domains must be provisioned and verified before activation.",
      "domainStatus",
    );
  }

  if (isPrimary && status !== "active") {
    throwValidationError("Only active domains can be marked primary.", "primary");
  }

  await assertHostnameAvailableForTenant(hostname, tenant.id);

  const { data, error } = await supabaseAdmin
    .from("tenant_domains")
    .insert({
      tenant_id: tenant.id,
      hostname,
      domain_type: domainType,
      status,
      is_primary: false,
      ...(wildcardSnapshot ? providerSnapshotUpdate(wildcardSnapshot) : {}),
    })
    .select("id")
    .single();

  if (error) {
    mapDatabaseMutationError(error, { operation: "create_domain", tenantId: tenant.id, hostname });
  }

  const domainId = (data as { id: string }).id;
  if (isPrimary) {
    await setPlatformTenantDomainPrimary({ tenantId: tenant.id, domainId });
  }

  return { tenantId: tenant.id, domainId, hostname };
}

export async function updatePlatformTenantDomain(input: UpdatePlatformTenantDomainInput) {
  await requirePlatformAdmin();
  const tenant = await requireTenantForDomainMutation(input.tenantId);
  const domainId = normalizeDomainId(input.domainId);
  const domain = await loadDomainForTenant(tenant.id, domainId);
  const domainType = normalizeDomainType(input.domainType);
  const status = normalizeDomainStatus(input.status, domain.status);
  const isPrimary = asBoolean(input.isPrimary);
  const updatedDomain = { ...domain, domainType, status };

  if (status === "active") {
    assertDomainCanBecomeActive(updatedDomain);
  }

  if (isPrimary && status !== "active") {
    throwValidationError("Only active domains can be marked primary.", "primary");
  }

  const { error } = await supabaseAdmin
    .from("tenant_domains")
    .update({
      domain_type: domainType,
      status,
      is_primary: status === "active" ? domain.isPrimary : false,
    })
    .eq("id", domain.id)
    .eq("tenant_id", tenant.id);

  if (error) {
    mapDatabaseMutationError(error, { operation: "update_domain", tenantId: tenant.id, domainId });
  }

  if (isPrimary) {
    await setPlatformTenantDomainPrimary({ tenantId: tenant.id, domainId });
  } else if (domain.isPrimary) {
    await clearDomainPrimary(tenant.id, domain.id);
  }

  return { tenantId: tenant.id, domainId: domain.id };
}

export async function activatePlatformTenantDomain(input: TenantDomainMutationInput) {
  await requirePlatformAdmin();
  const tenant = await requireTenantForDomainMutation(input.tenantId);
  const domainId = normalizeDomainId(input.domainId);
  const domain = await loadDomainForTenant(tenant.id, domainId);
  const wildcardSnapshot = isWildcardReadyPlatformSubdomain(domain)
    ? buildWildcardPlatformSubdomainSnapshot(domain.hostname)
    : null;

  if (wildcardSnapshot && domain.providerStatus !== "ready") {
    await updateDomainProviderSnapshot(domain, wildcardSnapshot);
  }

  assertDomainCanBecomeActive(wildcardSnapshot
    ? { ...domain, providerStatus: wildcardSnapshot.providerStatus }
    : domain);

  const { error } = await supabaseAdmin
    .from("tenant_domains")
    .update({ status: "active" })
    .eq("id", domain.id)
    .eq("tenant_id", tenant.id);

  if (error) {
    mapDatabaseMutationError(error, { operation: "activate_domain", tenantId: tenant.id, domainId });
  }

  return { tenantId: tenant.id, domainId: domain.id };
}

export async function disablePlatformTenantDomain(input: TenantDomainMutationInput) {
  await requirePlatformAdmin();
  const tenant = await requireTenantForDomainMutation(input.tenantId);
  const domainId = normalizeDomainId(input.domainId);
  const domain = await loadDomainForTenant(tenant.id, domainId);

  const { error } = await supabaseAdmin
    .from("tenant_domains")
    .update({ status: "disabled", is_primary: false })
    .eq("id", domain.id)
    .eq("tenant_id", tenant.id);

  if (error) {
    mapDatabaseMutationError(error, { operation: "disable_domain", tenantId: tenant.id, domainId });
  }

  return { tenantId: tenant.id, domainId: domain.id };
}

export async function setPlatformTenantDomainPrimary(input: TenantDomainMutationInput) {
  await requirePlatformAdmin();
  const tenant = await requireTenantForDomainMutation(input.tenantId);
  const domainId = normalizeDomainId(input.domainId);
  await loadDomainForTenant(tenant.id, domainId);

  const { error } = await supabaseAdmin.rpc("platform_admin_set_primary_tenant_domain", {
    p_domain_id: domainId,
    p_tenant_id: tenant.id,
  });

  if (error) {
    mapDatabaseMutationError(error, { operation: "set_primary_domain", tenantId: tenant.id, domainId });
  }

  return { tenantId: tenant.id, domainId };
}

export async function provisionPlatformTenantDomain(input: TenantDomainMutationInput) {
  await requirePlatformAdmin();
  const tenant = await requireTenantForDomainMutation(input.tenantId);
  const domainId = normalizeDomainId(input.domainId);
  const domain = await loadDomainForTenant(tenant.id, domainId);

  if (isWildcardReadyPlatformSubdomain(domain)) {
    await updateDomainProviderSnapshot(domain, buildWildcardPlatformSubdomainSnapshot(domain.hostname));
    return { tenantId: tenant.id, domainId: domain.id };
  }

  await markDomainProvisioning(domain);

  try {
    const snapshot = await provisionVercelProjectDomain({ hostname: domain.hostname });
    await updateDomainProviderSnapshot(domain, snapshot);
  } catch (error) {
    const providerError = mapProviderError(error);
    await markDomainProviderError(domain, providerError);
    throw providerError;
  }

  return { tenantId: tenant.id, domainId: domain.id };
}

export async function checkPlatformTenantDomain(input: TenantDomainMutationInput) {
  await requirePlatformAdmin();
  const tenant = await requireTenantForDomainMutation(input.tenantId);
  const domainId = normalizeDomainId(input.domainId);
  const domain = await loadDomainForTenant(tenant.id, domainId);

  if (isWildcardReadyPlatformSubdomain(domain)) {
    await updateDomainProviderSnapshot(domain, buildWildcardPlatformSubdomainSnapshot(domain.hostname));
    return { tenantId: tenant.id, domainId: domain.id };
  }

  try {
    const snapshot = await fetchVercelDomainSnapshot({
      hostname: domain.hostname,
      attemptVerification: true,
    });
    await updateDomainProviderSnapshot(domain, snapshot);
  } catch (error) {
    const providerError = mapProviderError(error);
    await markDomainProviderError(domain, providerError);
    throw providerError;
  }

  return { tenantId: tenant.id, domainId: domain.id };
}

export async function removePlatformTenantDomain(input: RemovePlatformTenantDomainInput) {
  await requirePlatformAdmin();
  const tenant = await requireTenantForDomainMutation(input.tenantId);
  const domainId = normalizeDomainId(input.domainId);
  const domain = await loadDomainForTenant(tenant.id, domainId);
  const confirmation = typeof input.confirmation === "string" ? input.confirmation.trim().toLowerCase() : "";

  if (confirmation !== domain.hostname) {
    throw new PlatformDomainMutationError(
      "unsafe_removal",
      "Type the hostname to confirm removal.",
      "confirmation",
    );
  }

  if (domain.isPrimary && !asBoolean(input.clearPrimary)) {
    throw new PlatformDomainMutationError(
      "unsafe_removal",
      "This is the primary domain. Confirm that primary state should be cleared before removal.",
      "primary",
    );
  }

  const activeDomainCount = await countActiveDomainsForTenant(tenant.id);
  if (
    domain.status === "active" &&
    activeDomainCount <= 1 &&
    !asBoolean(input.acknowledgeLastActive)
  ) {
    throw new PlatformDomainMutationError(
      "unsafe_removal",
      "This is the only active domain for the business. Acknowledge that the public site will no longer resolve through a stored production hostname.",
      "confirmation",
    );
  }

  if (domain.provider === VERCEL_PROVIDER && !isWildcardReadyPlatformSubdomain(domain)) {
    try {
      await removeVercelProjectDomain({ hostname: domain.hostname });
    } catch (error) {
      const providerError = mapProviderError(error);
      await markDomainProviderError(domain, providerError);
      throw providerError;
    }
  }

  const { error } = await supabaseAdmin
    .from("tenant_domains")
    .delete()
    .eq("id", domain.id)
    .eq("tenant_id", tenant.id);

  if (error) {
    mapDatabaseMutationError(error, { operation: "remove_domain", tenantId: tenant.id, domainId });
  }

  return { tenantId: tenant.id, domainId: domain.id };
}
