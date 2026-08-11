import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertResolvedCurrentSiteTenant,
  createDomainDisabledError,
  createDomainTenantInactiveError,
  createHostnameInvalidError,
  createHostnameUnknownError,
  createStrictTenantNotFoundError,
  normalizePublicHostname,
  resolveDevelopmentTenantSlugForHostname,
} from "@/lib/tenant/resolution";
import {
  buildTenantStorageKey,
  DEFAULT_TENANT_STORAGE_NAMESPACE,
  sanitizeStorageNamespace,
  type TenantStorageKeyName,
} from "./runtime";

export type TenantRecord = {
  id: string;
  slug: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
};

export type TenantDomainRecord = {
  id: string;
  tenantId: string;
  hostname: string;
  domainType: "platform_subdomain" | "custom_domain" | "booking_domain";
  status: "active" | "pending" | "disabled";
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

type TenantDomainLookupRow = {
  id: string;
  tenant_id: string;
  hostname: string;
  domain_type: TenantDomainRecord["domainType"];
  status: TenantDomainRecord["status"];
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  tenants: TenantRecord | TenantRecord[] | null;
};

type TenantSettingRow = {
  category: string;
  key: string;
  value_json: unknown;
};

type TenantContentRow = {
  key: string;
  status: string;
  value_json: unknown;
  updated_at?: string | null;
};

export type BrandSettings = {
  name: string;
  tagline: string | null;
  legalDisplayName: string | null;
  headerPrimaryCtaLabel: string;
  headerPrimaryCtaType: "tel" | "mailto" | "url";
  headerPrimaryCtaValue: string | null;
};

export type SupportSettings = {
  phone: string | null;
  email: string | null;
  timezone: string;
};

export type RuntimeSettings = {
  storageNamespace: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function asCtaType(value: unknown): BrandSettings["headerPrimaryCtaType"] {
  return value === "mailto" || value === "url" ? value : "tel";
}

const getTenantSettingsMap = cache(async (tenantId: string) => {
  const { data, error } = await supabaseAdmin
    .from("tenant_settings")
    .select("category, key, value_json")
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    ((data ?? []) as TenantSettingRow[]).map((row) => [`${row.category}.${row.key}`, row.value_json]),
  );
});

export type TenantContentStatus = "draft" | "published" | "archived";
export type TenantContentReadOptions = {
  preview?: boolean;
  tenantId?: string;
};

const getTenantContentMap = cache(async (tenantId: string, status: TenantContentStatus) => {
  const { data, error } = await supabaseAdmin
    .from("tenant_content_entries")
    .select("key, status, value_json, updated_at")
    .eq("tenant_id", tenantId)
    .eq("status", status);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(((data ?? []) as TenantContentRow[]).map((row) => [row.key, row]));
});

export const getCurrentTenant = cache(async (): Promise<TenantRecord> => {
  const headerStore = await headers();
  return resolvePublicTenantFromHostname(headerStore.get("host"));
});

const resolveTenantBySlugForDevelopment = cache(async (slug: string): Promise<TenantRecord> => {
  const lookup = await supabaseAdmin
    .from("tenants")
    .select("id, slug, status, created_at, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (lookup.error) {
    throw new Error(lookup.error.message);
  }

  return assertResolvedCurrentSiteTenant(lookup.data as TenantRecord | null, slug);
});

const resolvePublicTenantFromNormalizedHostname = cache(
  async (hostname: string): Promise<TenantRecord> => {
    if (process.env.NODE_ENV === "development") {
      const localTenantSlug = resolveDevelopmentTenantSlugForHostname(hostname);
      if (localTenantSlug) {
        return resolveTenantBySlugForDevelopment(localTenantSlug);
      }
    }

    const { data, error } = await supabaseAdmin
      .from("tenant_domains")
      .select(
        "id, tenant_id, hostname, domain_type, status, is_primary, created_at, updated_at, tenants!inner(id, slug, status, created_at, updated_at)",
      )
      .eq("hostname", hostname)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    const row = data as TenantDomainLookupRow | null;
    if (!row) {
      throw createHostnameUnknownError(hostname);
    }

    if (row.status !== "active") {
      throw createDomainDisabledError(hostname);
    }

    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    if (!tenant) {
      throw createHostnameUnknownError(hostname);
    }

    if (tenant.status !== "active") {
      throw createDomainTenantInactiveError(hostname);
    }

    return tenant;
  },
);

export async function resolvePublicTenantFromHostname(hostnameInput: string | null | undefined) {
  const hostname = normalizePublicHostname(hostnameInput);
  if (!hostname) {
    throw createHostnameInvalidError(hostnameInput ?? "");
  }

  return resolvePublicTenantFromNormalizedHostname(hostname);
}

export async function resolvePublicTenantFromRequest(request: Request) {
  return resolvePublicTenantFromHostname(request.headers.get("host"));
}

export type StrictTenantLookupOptions = {
  requireActive?: boolean;
};

async function findTenantStrict(
  field: "id" | "slug",
  value: string,
  options?: StrictTenantLookupOptions,
) {
  const cleanedValue = value.trim();
  if (!cleanedValue) return null;

  let lookup = supabaseAdmin
    .from("tenants")
    .select("id, slug, status, created_at, updated_at")
    .eq(field, cleanedValue);

  if (options?.requireActive) {
    lookup = lookup.eq("status", "active");
  }

  const { data, error } = await lookup.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? (data as TenantRecord) : null;
}

// Strict tenant lookups for platform/tenant-switching code. These never fall
// back to DEFAULT_TENANT_SLUG or another active tenant.
export async function findTenantByIdStrict(
  tenantId: string,
  options?: StrictTenantLookupOptions,
) {
  return findTenantStrict("id", tenantId, options);
}

export async function findTenantBySlugStrict(
  slug: string,
  options?: StrictTenantLookupOptions,
) {
  return findTenantStrict("slug", slug, options);
}

export async function requireTenantByIdStrict(
  tenantId: string,
  options?: StrictTenantLookupOptions,
) {
  const tenant = await findTenantByIdStrict(tenantId, options);
  if (!tenant) {
    throw createStrictTenantNotFoundError({
      field: "id",
      value: tenantId,
      requireActive: options?.requireActive,
    });
  }
  return tenant;
}

export async function requireTenantBySlugStrict(
  slug: string,
  options?: StrictTenantLookupOptions,
) {
  const tenant = await findTenantBySlugStrict(slug, options);
  if (!tenant) {
    throw createStrictTenantNotFoundError({
      field: "slug",
      value: slug,
      requireActive: options?.requireActive,
    });
  }
  return tenant;
}

export async function getTenantSettings(tenantId: string) {
  return getTenantSettingsMap(tenantId);
}

export async function getTenantSetting(category: string, key: string) {
  const tenant = await getCurrentTenant();
  const settings = await getTenantSettingsMap(tenant.id);
  return settings.get(`${category}.${key}`);
}

export async function getTenantContentEntries(tenantId: string) {
  return getTenantContentMap(tenantId, "published");
}

export async function getTenantContentByStatus(key: string, status: TenantContentStatus) {
  const tenant = await getCurrentTenant();
  return getTenantContentByStatusForTenant(tenant.id, key, status);
}

export async function getTenantContentByStatusForTenant(
  tenantId: string,
  key: string,
  status: TenantContentStatus,
) {
  const contentEntries = await getTenantContentMap(tenantId, status);
  return contentEntries.get(key)?.value_json;
}

export async function getTenantContentRowByStatus(key: string, status: TenantContentStatus) {
  const tenant = await getCurrentTenant();
  return getTenantContentRowByStatusForTenant(tenant.id, key, status);
}

export async function getTenantContentRowByStatusForTenant(
  tenantId: string,
  key: string,
  status: TenantContentStatus,
) {
  const contentEntries = await getTenantContentMap(tenantId, status);
  return contentEntries.get(key) ?? null;
}

export async function getTenantContent(key: string, options?: TenantContentReadOptions) {
  const tenantId = options?.tenantId ?? (await getCurrentTenant()).id;

  if (!options?.preview) {
    return getTenantContentByStatusForTenant(tenantId, key, "published");
  }

  const jar = await cookies();
  const previewEnabled = jar.get("cms_preview")?.value === "1";

  if (previewEnabled) {
    const draftValue = await getTenantContentByStatusForTenant(tenantId, key, "draft");
    if (draftValue !== undefined) {
      return draftValue;
    }
  }

  return getTenantContentByStatusForTenant(tenantId, key, "published");
}

export async function getTenantContentDraftFirst(key: string) {
  const tenant = await getCurrentTenant();
  return getTenantContentDraftFirstForTenant(tenant.id, key);
}

export async function getTenantContentDraftFirstForTenant(tenantId: string, key: string) {
  const draftValue = await getTenantContentByStatusForTenant(tenantId, key, "draft");
  if (draftValue !== undefined) {
    return draftValue;
  }
  return getTenantContentByStatusForTenant(tenantId, key, "published");
}

export async function getTenantContentStatuses(keys: string[]) {
  const tenant = await getCurrentTenant();
  const [draftMap, publishedMap] = await Promise.all([
    getTenantContentMap(tenant.id, "draft"),
    getTenantContentMap(tenant.id, "published"),
  ]);

  return keys.map((key) => ({
    key,
    draft: draftMap.get(key) ?? null,
    published: publishedMap.get(key) ?? null,
  }));
}

export async function getBrandSettings(): Promise<BrandSettings> {
  const tenant = await getCurrentTenant();
  return getBrandSettingsForTenant(tenant);
}

export async function getBrandSettingsForTenant(tenant: TenantRecord): Promise<BrandSettings> {
  const settings = await getTenantSettingsMap(tenant.id);

  return {
    name: asString(settings.get("brand.name")) ?? tenant.slug,
    tagline: asString(settings.get("brand.tagline")),
    legalDisplayName: asString(settings.get("brand.legalDisplayName")),
    headerPrimaryCtaLabel: asString(settings.get("brand.headerPrimaryCtaLabel")) ?? "Contact",
    headerPrimaryCtaType: asCtaType(settings.get("brand.headerPrimaryCtaType")),
    headerPrimaryCtaValue: asString(settings.get("brand.headerPrimaryCtaValue")),
  };
}

export async function getSupportSettings(): Promise<SupportSettings> {
  const tenant = await getCurrentTenant();
  return getSupportSettingsForTenant(tenant.id);
}

export async function getSupportSettingsForTenant(tenantId: string): Promise<SupportSettings> {
  const settings = await getTenantSettingsMap(tenantId);

  return {
    phone: asString(settings.get("support.phone")),
    email: asString(settings.get("support.email")),
    timezone: asString(settings.get("support.timezone")) ?? "UTC",
  };
}

export async function getRuntimeSettings(): Promise<RuntimeSettings> {
  const tenant = await getCurrentTenant();
  return getRuntimeSettingsForTenant(tenant.id);
}

export async function getRuntimeSettingsForTenant(tenantId: string): Promise<RuntimeSettings> {
  const settings = await getTenantSettingsMap(tenantId);

  return {
    storageNamespace: sanitizeStorageNamespace(
      asString(settings.get("runtime.storageNamespace")) ?? DEFAULT_TENANT_STORAGE_NAMESPACE,
    ),
  };
}

export async function getServerTenantStorageKey(key: TenantStorageKeyName) {
  const runtime = await getRuntimeSettings();
  return buildTenantStorageKey(runtime.storageNamespace, key);
}

export async function getServerTenantStorageKeyForTenant(
  tenantId: string,
  key: TenantStorageKeyName,
) {
  const runtime = await getRuntimeSettingsForTenant(tenantId);
  return buildTenantStorageKey(runtime.storageNamespace, key);
}
