export const DEFAULT_TENANT_STORAGE_NAMESPACE = "tenant";

export const TENANT_STORAGE_KEYS = {
  booking: "booking",
  lastBookingWarning: "last_booking_warning",
  portalAccessToken: "portal_access_token",
  portalRefreshToken: "portal_refresh_token",
  portalClientId: "client_id",
  portalLoginCooldownUntil: "portal_login_cooldown_until",
} as const;

export type TenantStorageKeyName =
  (typeof TENANT_STORAGE_KEYS)[keyof typeof TENANT_STORAGE_KEYS];

export function sanitizeStorageNamespace(input: string | null | undefined) {
  const normalized = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || DEFAULT_TENANT_STORAGE_NAMESPACE;
}

export function buildTenantStorageKey(namespace: string, key: TenantStorageKeyName) {
  return `${sanitizeStorageNamespace(namespace)}_${key}`;
}

export function getTenantStorageNamespace() {
  if (typeof document === "undefined") {
    return DEFAULT_TENANT_STORAGE_NAMESPACE;
  }

  return sanitizeStorageNamespace(document.documentElement.dataset.tenantStorageNamespace);
}

export function getTenantStorageKey(key: TenantStorageKeyName) {
  return buildTenantStorageKey(getTenantStorageNamespace(), key);
}
