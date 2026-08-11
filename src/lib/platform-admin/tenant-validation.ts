export type TenantLifecycleStatus = "active" | "inactive";

export type PlatformTenantValidationError = {
  field: "businessName" | "slug" | "status" | "tenantId" | "confirmation" | "updatedAt";
  message: string;
};

export type PlatformTenantValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: PlatformTenantValidationError };

export const PLATFORM_ADMIN_RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "platform-admin",
  "www",
]);

export const DEFAULT_NEW_TENANT_TIMEZONE = "America/New_York";

export const CURRENT_SITE_DEACTIVATION_CONFIRMATION = "DEACTIVATE CURRENT SITE";

const TENANT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPlatformTenantUuid(value: string) {
  return TENANT_UUID_PATTERN.test(value);
}

export function extractPlatformTenantUuidFromRpcResponse(
  responseData: unknown,
  functionName = "platform_admin_create_tenant",
): string | null {
  if (typeof responseData === "string") {
    return isPlatformTenantUuid(responseData) ? responseData : null;
  }

  if (Array.isArray(responseData)) {
    for (const item of responseData) {
      const tenantId = extractPlatformTenantUuidFromRpcResponse(item, functionName);
      if (tenantId) return tenantId;
    }

    return null;
  }

  if (!responseData || typeof responseData !== "object") {
    return null;
  }

  const row = responseData as Record<string, unknown>;
  const preferredKeys = [
    "id",
    "tenant_id",
    "tenantId",
    "created_tenant_id",
    "createdTenantId",
    functionName,
  ];

  for (const key of preferredKeys) {
    const value = row[key];

    if (typeof value === "string" && isPlatformTenantUuid(value)) {
      return value;
    }
  }

  const entries = Object.entries(row);

  if (entries.length === 1) {
    const [, value] = entries[0]!;
    return typeof value === "string" && isPlatformTenantUuid(value) ? value : null;
  }

  return null;
}

export function normalizePlatformBusinessSlug(input: unknown): PlatformTenantValidationResult<string> {
  const raw = typeof input === "string" ? input : "";
  const slug = raw.trim().toLowerCase().replace(/^-+|-+$/g, "");

  if (!slug) {
    return {
      ok: false,
      error: { field: "slug", message: "Enter a slug for this business." },
    };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return {
      ok: false,
      error: {
        field: "slug",
        message: "Use only lowercase letters, numbers, and hyphens.",
      },
    };
  }

  if (PLATFORM_ADMIN_RESERVED_SLUGS.has(slug)) {
    return {
      ok: false,
      error: { field: "slug", message: "That slug is reserved for the platform." },
    };
  }

  return { ok: true, value: slug };
}

export function normalizePlatformBusinessName(input: unknown): PlatformTenantValidationResult<string> {
  const businessName = typeof input === "string" ? input.trim() : "";

  if (!businessName) {
    return {
      ok: false,
      error: { field: "businessName", message: "Enter a business name." },
    };
  }

  return { ok: true, value: businessName };
}

export function normalizeTenantLifecycleStatus(
  input: unknown,
): PlatformTenantValidationResult<TenantLifecycleStatus> {
  if (input === "active" || input === "inactive") {
    return { ok: true, value: input };
  }

  return {
    ok: false,
    error: { field: "status", message: "Choose active or inactive." },
  };
}

export function normalizePlatformTenantId(input: unknown): PlatformTenantValidationResult<string> {
  const tenantId = typeof input === "string" ? input.trim() : "";

  if (!isPlatformTenantUuid(tenantId)) {
    return {
      ok: false,
      error: { field: "tenantId", message: "Unknown business." },
    };
  }

  return { ok: true, value: tenantId };
}

export function buildTenantStorageNamespace(slug: string) {
  return slug.replaceAll("-", "_");
}
