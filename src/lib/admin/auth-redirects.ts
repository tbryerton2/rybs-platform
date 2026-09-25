import "server-only";

import { normalizeAdminAppOrigin } from "@/lib/admin/app-url";
import { normalizePublicHostname } from "@/lib/tenant/resolution";

export type AdminAuthRedirectInput = {
  adminAppUrl?: string | null;
  forwardedHost?: string | null;
  host?: string | null;
  forwardedProto?: string | null;
  siteUrl?: string | null;
  nodeEnv?: string | null;
  fallbackBaseUrl?: string | null;
};

function firstHeaderValue(value: string | null | undefined) {
  return value?.split(",")[0]?.trim() || null;
}

function cleanRequestHost(value: string | null | undefined) {
  const rawHost = firstHeaderValue(value)
    ?.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .split(/[/?#]/)[0]
    ?.toLowerCase()
    .replace(/\.$/, "");

  if (!rawHost) return null;
  return normalizePublicHostname(rawHost) ? rawHost : null;
}

function normalizeProtocol(value: string | null | undefined) {
  const protocol = firstHeaderValue(value)?.toLowerCase();
  return protocol === "https" || protocol === "http" ? protocol : null;
}

function getRequestProtocol(host: string, input: AdminAuthRedirectInput) {
  const forwardedProtocol = normalizeProtocol(input.forwardedProto);
  if (forwardedProtocol) return forwardedProtocol;

  if (host.includes("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]")) {
    return "http";
  }

  return input.nodeEnv === "production" ? "https" : "http";
}

export function getAdminAuthRedirectRequestHost(input: AdminAuthRedirectInput) {
  return cleanRequestHost(input.forwardedHost) ?? cleanRequestHost(input.host);
}

export function getAdminAuthRedirectRequestProtocol(
  host: string,
  input: AdminAuthRedirectInput,
) {
  return getRequestProtocol(host, input);
}

export function getAdminAuthRedirectUrl(
  path: `/${string}`,
  input: AdminAuthRedirectInput,
) {
  const adminOrigin = normalizeAdminAppOrigin(input.adminAppUrl);
  if (adminOrigin) {
    return new URL(path, adminOrigin).toString();
  }

  const requestHost = getAdminAuthRedirectRequestHost(input);

  if (requestHost) {
    const protocol = getRequestProtocol(requestHost, input);
    return new URL(path, `${protocol}://${requestHost}`).toString();
  }

  const fallbackBaseUrl = input.fallbackBaseUrl?.trim();
  if (fallbackBaseUrl) {
    return new URL(path, fallbackBaseUrl).toString();
  }

  const siteUrl = input.siteUrl?.trim();
  if (siteUrl) {
    return new URL(path, siteUrl).toString();
  }

  return new URL(path, "http://localhost:3000").toString();
}
