import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildTenantStorageKey,
  DEFAULT_TENANT_STORAGE_NAMESPACE,
  sanitizeStorageNamespace,
  type TenantStorageKeyName,
} from "./runtime";

const DEFAULT_TENANT_SLUG = "tan-can-man";

export type TenantRecord = {
  id: string;
  slug: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
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
  const configuredSlug = process.env.DEFAULT_TENANT_SLUG?.trim() || DEFAULT_TENANT_SLUG;

  const preferredLookup = await supabaseAdmin
    .from("tenants")
    .select("id, slug, status, created_at, updated_at")
    .eq("slug", configuredSlug)
    .eq("status", "active")
    .maybeSingle();

  if (preferredLookup.error) {
    throw new Error(preferredLookup.error.message);
  }

  if (preferredLookup.data) {
    return preferredLookup.data as TenantRecord;
  }

  const fallbackLookup = await supabaseAdmin
    .from("tenants")
    .select("id, slug, status, created_at, updated_at")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallbackLookup.error) {
    throw new Error(fallbackLookup.error.message);
  }

  if (!fallbackLookup.data) {
    throw new Error("No active tenant is configured.");
  }

  return fallbackLookup.data as TenantRecord;
});

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
  const contentEntries = await getTenantContentMap(tenant.id, status);
  return contentEntries.get(key)?.value_json;
}

export async function getTenantContentRowByStatus(key: string, status: TenantContentStatus) {
  const tenant = await getCurrentTenant();
  const contentEntries = await getTenantContentMap(tenant.id, status);
  return contentEntries.get(key) ?? null;
}

export async function getTenantContent(key: string, options?: TenantContentReadOptions) {
  if (!options?.preview) {
    return getTenantContentByStatus(key, "published");
  }

  const jar = await cookies();
  const previewEnabled = jar.get("cms_preview")?.value === "1";

  if (previewEnabled) {
    const draftValue = await getTenantContentByStatus(key, "draft");
    if (draftValue !== undefined) {
      return draftValue;
    }
  }

  return getTenantContentByStatus(key, "published");
}

export async function getTenantContentDraftFirst(key: string) {
  const draftValue = await getTenantContentByStatus(key, "draft");
  if (draftValue !== undefined) {
    return draftValue;
  }
  return getTenantContentByStatus(key, "published");
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
  const settings = await getTenantSettingsMap(tenant.id);

  return {
    phone: asString(settings.get("support.phone")),
    email: asString(settings.get("support.email")),
    timezone: asString(settings.get("support.timezone")) ?? "UTC",
  };
}

export async function getRuntimeSettings(): Promise<RuntimeSettings> {
  const tenant = await getCurrentTenant();
  const settings = await getTenantSettingsMap(tenant.id);

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
