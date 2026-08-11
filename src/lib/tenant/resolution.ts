export const DEFAULT_CURRENT_SITE_TENANT_SLUG = "tan-can-man";
export const DEFAULT_DEMO_LOCAL_TENANT_SLUG = "demo-dumpster-co";
export const DEMO_LOCAL_HOSTNAME = "demo-dumpster-co.localhost";

const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const HOSTNAME_LABEL_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export type TenantResolutionErrorCode =
  | "CURRENT_TENANT_NOT_FOUND"
  | "CURRENT_TENANT_INACTIVE"
  | "TENANT_NOT_FOUND"
  | "HOSTNAME_INVALID"
  | "HOSTNAME_UNKNOWN"
  | "DOMAIN_DISABLED"
  | "DOMAIN_TENANT_INACTIVE";

export class TenantResolutionError extends Error {
  code: TenantResolutionErrorCode;
  tenantIdentifier: string;
  publicMessage: string;

  constructor({
    code,
    tenantIdentifier,
    message,
    publicMessage = "This site is temporarily unavailable.",
  }: {
    code: TenantResolutionErrorCode;
    tenantIdentifier: string;
    message: string;
    publicMessage?: string;
  }) {
    super(message);
    this.name = "TenantResolutionError";
    this.code = code;
    this.tenantIdentifier = tenantIdentifier;
    this.publicMessage = publicMessage;
  }
}

export function isTenantResolutionError(error: unknown): error is TenantResolutionError {
  return error instanceof TenantResolutionError;
}

export function getConfiguredCurrentTenantSlug(env?: { DEFAULT_TENANT_SLUG?: string }) {
  const source = env ?? process.env;
  return source.DEFAULT_TENANT_SLUG?.trim() || DEFAULT_CURRENT_SITE_TENANT_SLUG;
}

export function getConfiguredDemoLocalTenantSlug(env?: { DEMO_LOCAL_TENANT_SLUG?: string }) {
  const source = env ?? process.env;
  return source.DEMO_LOCAL_TENANT_SLUG?.trim() || DEFAULT_DEMO_LOCAL_TENANT_SLUG;
}

function stripHostnamePort(value: string) {
  if (value.startsWith("[") && value.includes("]")) {
    const closingBracketIndex = value.indexOf("]");
    const rest = value.slice(closingBracketIndex + 1);
    if (rest && !/^:\d+$/.test(rest)) return null;
    return value.slice(0, closingBracketIndex + 1);
  }

  const colonCount = value.split(":").length - 1;
  if (colonCount === 1) {
    const [hostname, port] = value.split(":");
    if (!/^\d+$/.test(port ?? "")) return null;
    return hostname ?? "";
  }

  return value;
}

function stripProtocolAndPath(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const withoutProtocol = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  return withoutProtocol.split(/[/?#]/)[0] ?? "";
}

export function normalizePublicHostname(input: string | null | undefined): string | null {
  const withoutPort = stripHostnamePort(stripProtocolAndPath(input ?? ""));
  if (withoutPort === null) return null;

  const host = withoutPort
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");

  if (!host) return null;
  if (host === "[::1]") return "::1";
  if (LOCALHOST_HOSTNAMES.has(host)) return host;

  const labels = host.split(".");
  if (
    labels.length < 2 ||
    labels.some((label) => !HOSTNAME_LABEL_PATTERN.test(label))
  ) {
    return null;
  }

  return host;
}

export function isPlainLocalhostHostname(hostname: string) {
  return LOCALHOST_HOSTNAMES.has(hostname);
}

export function resolveDevelopmentTenantSlugForHostname(
  hostname: string,
  env?: {
    DEFAULT_TENANT_SLUG?: string;
    DEMO_LOCAL_TENANT_SLUG?: string;
  },
) {
  if (isPlainLocalhostHostname(hostname)) {
    return getConfiguredCurrentTenantSlug(env);
  }

  if (hostname === DEMO_LOCAL_HOSTNAME) {
    return getConfiguredDemoLocalTenantSlug(env);
  }

  return null;
}

export function createCurrentTenantNotFoundError(slug: string) {
  return new TenantResolutionError({
    code: "CURRENT_TENANT_NOT_FOUND",
    tenantIdentifier: slug,
    message: `Configured current-site tenant slug "${slug}" was not found.`,
  });
}

export function createCurrentTenantInactiveError(slug: string) {
  return new TenantResolutionError({
    code: "CURRENT_TENANT_INACTIVE",
    tenantIdentifier: slug,
    message: `Configured current-site tenant slug "${slug}" is inactive.`,
  });
}

export function createStrictTenantNotFoundError(input: {
  field: "id" | "slug";
  value: string;
  requireActive?: boolean;
}) {
  const activeSuffix = input.requireActive ? " active" : "";

  return new TenantResolutionError({
    code: "TENANT_NOT_FOUND",
    tenantIdentifier: input.value,
    message: `No${activeSuffix} tenant found for ${input.field} "${input.value}".`,
  });
}

export function createHostnameInvalidError(input: string) {
  return new TenantResolutionError({
    code: "HOSTNAME_INVALID",
    tenantIdentifier: input,
    message: `Public tenant hostname "${input}" is not valid.`,
    publicMessage: "This site is not configured.",
  });
}

export function createHostnameUnknownError(hostname: string) {
  return new TenantResolutionError({
    code: "HOSTNAME_UNKNOWN",
    tenantIdentifier: hostname,
    message: `No active public tenant domain is configured for hostname "${hostname}".`,
    publicMessage: "This site is not configured.",
  });
}

export function createDomainDisabledError(hostname: string) {
  return new TenantResolutionError({
    code: "DOMAIN_DISABLED",
    tenantIdentifier: hostname,
    message: `Public tenant domain "${hostname}" is not active.`,
  });
}

export function createDomainTenantInactiveError(hostname: string) {
  return new TenantResolutionError({
    code: "DOMAIN_TENANT_INACTIVE",
    tenantIdentifier: hostname,
    message: `Public tenant domain "${hostname}" points to an inactive tenant.`,
  });
}

export function assertResolvedCurrentSiteTenant<Tenant extends { slug: string; status: string }>(
  tenant: Tenant | null,
  slug: string,
): Tenant {
  if (!tenant) {
    throw createCurrentTenantNotFoundError(slug);
  }

  if (tenant.status !== "active") {
    throw createCurrentTenantInactiveError(slug);
  }

  return tenant;
}
