import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DEFAULT_LOCAL_TENANT_SLUG, normalizePublicHostname } from "@/lib/tenant/resolution";
import {
  getBrandSettingsForTenant,
  getSupportSettingsForTenant,
  getTenantSettings,
  type TenantRecord,
} from "@/lib/tenant/server";

type TenantDomainRow = {
  hostname: string;
  domain_type: "platform_subdomain" | "custom_domain" | "booking_domain";
  status: "active" | "pending" | "disabled";
  is_primary: boolean;
};

type RequestUrlContext = {
  host?: string | null;
  protocol?: string | null;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function normalizeEmailList(value: unknown) {
  const rawValues = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n;]/) : [];

  return Array.from(
    new Set(
      rawValues
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry)),
    ),
  );
}

function getRequestBaseUrl(context?: RequestUrlContext) {
  const rawHost = context?.host
    ?.trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .split(/[/?#]/)[0]
    ?.toLowerCase()
    .replace(/\.$/, "");
  const hostname = normalizePublicHostname(rawHost);
  if (!hostname) return null;

  const protocol = context?.protocol?.trim() || (hostname.includes("localhost") ? "http" : "https");
  return `${protocol.replace(/:$/, "")}://${rawHost}`;
}

function sortTenantDomains(left: TenantDomainRow, right: TenantDomainRow) {
  if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1;

  const priority = {
    custom_domain: 0,
    platform_subdomain: 1,
    booking_domain: 2,
  };

  const priorityDelta = priority[left.domain_type] - priority[right.domain_type];
  if (priorityDelta !== 0) return priorityDelta;

  return left.hostname.localeCompare(right.hostname);
}

export async function getTenantPublicBaseUrl(
  tenant: TenantRecord,
  context?: RequestUrlContext,
) {
  const requestBaseUrl = getRequestBaseUrl(context);
  if (requestBaseUrl) return requestBaseUrl;

  const { data, error } = await supabaseAdmin
    .from("tenant_domains")
    .select("hostname, domain_type, status, is_primary")
    .eq("tenant_id", tenant.id)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  const domain = ((data ?? []) as TenantDomainRow[]).sort(sortTenantDomains)[0];
  if (domain) return `https://${domain.hostname}`;

  const globalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (tenant.slug === DEFAULT_LOCAL_TENANT_SLUG && globalSiteUrl) {
    return globalSiteUrl.replace(/\/$/, "");
  }

  return null;
}

export async function getTenantCommunicationSettings(
  tenant: TenantRecord,
  context?: RequestUrlContext,
) {
  const [brand, support, settings, publicBaseUrl] = await Promise.all([
    getBrandSettingsForTenant(tenant),
    getSupportSettingsForTenant(tenant.id),
    getTenantSettings(tenant.id),
    getTenantPublicBaseUrl(tenant, context),
  ]);

  const explicitRecipients = [
    ...normalizeEmailList(settings.get("notifications.bookingEmails")),
    ...normalizeEmailList(settings.get("notifications.bookingEmail")),
    ...normalizeEmailList(settings.get("notification.bookingEmails")),
    ...normalizeEmailList(settings.get("notification.bookingEmail")),
  ];
  const supportEmail = asString(settings.get("support.email"));
  const fallbackRecipients = supportEmail ? [supportEmail] : [];
  const legacyTanRecipients =
    tenant.slug === DEFAULT_LOCAL_TENANT_SLUG
      ? normalizeEmailList(process.env.ADMIN_BOOKING_EMAIL)
      : [];

  return {
    businessName: brand.name,
    supportEmail: support.email,
    supportPhone: support.phone,
    publicBaseUrl,
    bookingNotificationRecipients:
      explicitRecipients.length > 0
        ? explicitRecipients
        : fallbackRecipients.length > 0
          ? fallbackRecipients
          : legacyTanRecipients,
  };
}
