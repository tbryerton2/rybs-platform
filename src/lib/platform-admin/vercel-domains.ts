import "server-only";

import { normalizePublicHostname } from "@/lib/tenant/resolution";

export const VERCEL_PROVIDER = "vercel" as const;

export const VERCEL_DOMAIN_PROVIDER_STATUSES = [
  "not_provisioned",
  "provisioning",
  "awaiting_dns",
  "awaiting_verification",
  "ready",
  "error",
] as const;

export const VERCEL_DOMAIN_VERIFICATION_STATUSES = [
  "unknown",
  "verified",
  "verification_required",
] as const;

export type VercelDomainProviderStatus = (typeof VERCEL_DOMAIN_PROVIDER_STATUSES)[number];
export type VercelDomainVerificationStatus = (typeof VERCEL_DOMAIN_VERIFICATION_STATUSES)[number];

export type VercelDnsRecordInstruction = {
  type: string;
  name: string;
  value: string;
  reason?: string | null;
};

export type VercelDnsInstructions = {
  source: "vercel";
  records: VercelDnsRecordInstruction[];
  notes: string[];
};

type VercelProjectDomainResponse = {
  name?: string;
  apexName?: string;
  projectId?: string;
  verified?: boolean;
  verification?: Array<{
    type?: string;
    domain?: string;
    value?: string;
    reason?: string;
  }>;
};

type VercelDomainConfigResponse = {
  configuredBy?: string | null;
  configured?: boolean;
  misconfigured?: boolean;
  recommendedCNAME?: VercelRecommendedDnsValue[] | string[] | string;
  recommendedIPv4?: VercelRecommendedIpv4Value[] | string[] | string;
  recommendedA?: VercelRecommendedDnsValue[] | string[] | string;
  recommendedAValues?: VercelRecommendedIpv4Value[] | string[] | string;
  acceptedChallenges?: Array<{
    type?: string;
    value?: string;
  }>;
};

type VercelRecommendedDnsValue = {
  rank?: number;
  value?: string;
};

type VercelRecommendedIpv4Value = {
  rank?: number;
  value?: string[] | string;
};

export type VercelDomainSnapshot = {
  provider: typeof VERCEL_PROVIDER;
  providerStatus: VercelDomainProviderStatus;
  verificationStatus: VercelDomainVerificationStatus;
  dnsInstructions: VercelDnsInstructions | null;
  lastCheckedAt: string;
  lastError: string | null;
  projectDomain: VercelProjectDomainResponse | null;
  domainConfig: VercelDomainConfigResponse | null;
};

export class VercelDomainIntegrationError extends Error {
  status?: number;
  code?: string;
  retryable: boolean;

  constructor(message: string, input?: { status?: number; code?: string; retryable?: boolean }) {
    super(message);
    this.name = "VercelDomainIntegrationError";
    this.status = input?.status;
    this.code = input?.code;
    this.retryable = input?.retryable ?? false;
  }
}

type VercelApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

type VercelClientConfig = {
  token: string;
  projectId: string;
  teamId?: string;
  fetcher?: typeof fetch;
};

type VercelDomainClient = {
  addProjectDomain(hostname: string): Promise<VercelProjectDomainResponse>;
  getProjectDomain(hostname: string): Promise<VercelProjectDomainResponse>;
  verifyProjectDomain(hostname: string): Promise<VercelProjectDomainResponse>;
  removeProjectDomain(hostname: string): Promise<void>;
  getDomainConfig(hostname: string): Promise<VercelDomainConfigResponse>;
};

function envValue(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

export function getVercelDomainIntegrationDiagnostics(env = process.env) {
  const tokenConfigured = Boolean(env.VERCEL_API_TOKEN?.trim());
  const projectConfigured = Boolean(env.VERCEL_PROJECT_ID?.trim());
  const teamConfigured = Boolean(env.VERCEL_TEAM_ID?.trim());
  const platformBaseDomainConfigured = Boolean(env.PLATFORM_PUBLIC_BASE_DOMAIN?.trim());

  return {
    tokenConfigured,
    projectConfigured,
    teamConfigured,
    platformBaseDomainConfigured,
    configured: tokenConfigured && projectConfigured,
  };
}

function getVercelClientConfig(): VercelClientConfig {
  const token = envValue("VERCEL_API_TOKEN");
  const projectId = envValue("VERCEL_PROJECT_ID");

  if (!token || !projectId) {
    throw new VercelDomainIntegrationError(
      "Vercel domain integration is not configured. Set VERCEL_API_TOKEN and VERCEL_PROJECT_ID.",
      { code: "configuration_missing" },
    );
  }

  return {
    token,
    projectId,
    teamId: envValue("VERCEL_TEAM_ID") ?? undefined,
  };
}

function appendTeamId(url: URL, teamId?: string) {
  if (teamId) {
    url.searchParams.set("teamId", teamId);
  }
}

function safeVercelErrorMessage(input: unknown) {
  const body = input as VercelApiErrorBody;
  const message = body?.error?.message;
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  return "Vercel could not complete the domain request.";
}

function safeVercelErrorCode(input: unknown) {
  const body = input as VercelApiErrorBody;
  const code = body?.error?.code;
  return typeof code === "string" && code.trim() ? code.trim() : undefined;
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export function createVercelDomainClient(config = getVercelClientConfig()): VercelDomainClient {
  const fetcher = config.fetcher ?? fetch;

  async function request<T>(input: {
    method: "GET" | "POST" | "DELETE";
    pathname: string;
    query?: Record<string, string | undefined>;
    body?: Record<string, unknown>;
    ignoreMissing?: boolean;
  }) {
    const url = new URL(input.pathname, "https://api.vercel.com");
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
    appendTeamId(url, config.teamId);

    const response = await fetcher(url, {
      method: input.method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    const body = await parseJson(response);

    if (input.ignoreMissing && response.status === 404) {
      return null as T;
    }

    if (!response.ok) {
      const code = safeVercelErrorCode(body);
      throw new VercelDomainIntegrationError(safeVercelErrorMessage(body), {
        status: response.status,
        code,
        retryable: isRetryableStatus(response.status),
      });
    }

    return body as T;
  }

  const encodedProject = encodeURIComponent(config.projectId);

  return {
    async addProjectDomain(hostname) {
      return request<VercelProjectDomainResponse>({
        method: "POST",
        pathname: `/v10/projects/${encodedProject}/domains`,
        body: { name: hostname },
      });
    },
    async getProjectDomain(hostname) {
      return request<VercelProjectDomainResponse>({
        method: "GET",
        pathname: `/v9/projects/${encodedProject}/domains/${encodeURIComponent(hostname)}`,
      });
    },
    async verifyProjectDomain(hostname) {
      return request<VercelProjectDomainResponse>({
        method: "POST",
        pathname: `/v9/projects/${encodedProject}/domains/${encodeURIComponent(hostname)}/verify`,
      });
    },
    async removeProjectDomain(hostname) {
      await request<null>({
        method: "DELETE",
        pathname: `/v9/projects/${encodedProject}/domains/${encodeURIComponent(hostname)}`,
        ignoreMissing: true,
      });
    },
    async getDomainConfig(hostname) {
      return request<VercelDomainConfigResponse>({
        method: "GET",
        pathname: `/v6/domains/${encodeURIComponent(hostname)}/config`,
        query: { projectIdOrName: config.projectId },
      });
    },
  };
}

function rankedDnsValues(value: unknown) {
  if (!Array.isArray(value)) {
    if (typeof value === "string" && value.trim()) {
      return [value.trim()];
    }

    return [] as string[];
  }

  const ranked = value
    .map((item) => {
      if (typeof item === "string") {
        return { rank: Number.MAX_SAFE_INTEGER, values: [item.trim()] };
      }

      if (item && typeof item === "object" && "value" in item) {
        const ranked = item as { rank?: unknown; value?: unknown };
        const values = Array.isArray(ranked.value)
          ? ranked.value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          : typeof ranked.value === "string" && ranked.value.trim()
            ? [ranked.value.trim()]
            : [];

        return {
          rank: typeof ranked.rank === "number" ? ranked.rank : Number.MAX_SAFE_INTEGER,
          values,
        };
      }

      return { rank: Number.MAX_SAFE_INTEGER, values: [] };
    })
    .sort((left, right) => left.rank - right.rank)
    .filter((item) => item.values.length > 0);

  const topRank = ranked[0]?.rank;
  if (topRank === undefined) return [];

  return ranked
    .filter((item) => item.rank === topRank)
    .flatMap((item) => item.values);
}

function dnsRecordNameForHostname(hostname: string, apexName?: string) {
  const apex = normalizePublicHostname(apexName);
  if (!apex) return hostname;
  if (hostname === apex) return "@";
  if (hostname.endsWith(`.${apex}`)) {
    return hostname.slice(0, -(apex.length + 1));
  }

  return hostname;
}

function isApexHostname(hostname: string) {
  return hostname.split(".").length === 2;
}

function buildDnsInstructions(input: {
  hostname: string;
  projectDomain: VercelProjectDomainResponse | null;
  domainConfig: VercelDomainConfigResponse | null;
}) {
  const records: VercelDnsRecordInstruction[] = [];
  const notes: string[] = [];
  const apex = normalizePublicHostname(input.projectDomain?.apexName);
  const isApexDomain = apex ? input.hostname === apex : isApexHostname(input.hostname);
  const shouldUseCname = !isApexDomain;

  for (const challenge of input.projectDomain?.verification ?? []) {
    if (!challenge.type || !challenge.domain || !challenge.value) continue;

    records.push({
      type: challenge.type.toUpperCase(),
      name: challenge.domain,
      value: challenge.value,
      reason: challenge.reason ?? "Vercel ownership verification",
    });
  }

  if (shouldUseCname) {
    for (const value of rankedDnsValues(input.domainConfig?.recommendedCNAME)) {
      records.push({
        type: "CNAME",
        name: dnsRecordNameForHostname(input.hostname, input.projectDomain?.apexName),
        value,
        reason: "Point this subdomain at the Vercel project.",
      });
    }
  }

  const recommendedAValues = [
    ...rankedDnsValues(input.domainConfig?.recommendedIPv4),
    ...rankedDnsValues(input.domainConfig?.recommendedA),
    ...rankedDnsValues(input.domainConfig?.recommendedAValues),
  ];

  if (isApexDomain) {
    for (const value of recommendedAValues) {
      records.push({
        type: "A",
        name: "@",
        value,
        reason: "Point this apex domain at the Vercel project.",
      });
    }
  }

  if (records.length === 0 && input.domainConfig?.misconfigured) {
    notes.push(
      isApexHostname(input.hostname)
        ? "Vercel reports this apex domain is misconfigured, but the API did not return an A record target. Check the Vercel dashboard before changing DNS."
        : "Vercel reports this subdomain is misconfigured, but the API did not return a CNAME target. Check the Vercel dashboard before changing DNS.",
    );
  }

  if (records.length === 0 && notes.length === 0) {
    return null;
  }

  return {
    source: VERCEL_PROVIDER,
    records,
    notes,
  } satisfies VercelDnsInstructions;
}

function isConfigurationReady(domainConfig: VercelDomainConfigResponse | null) {
  if (!domainConfig) return false;
  if (domainConfig.configured === true) return true;
  if (domainConfig.misconfigured === false) return true;
  return false;
}

export function buildVercelDomainSnapshot(input: {
  hostname: string;
  projectDomain: VercelProjectDomainResponse | null;
  domainConfig: VercelDomainConfigResponse | null;
  lastError?: string | null;
}): VercelDomainSnapshot {
  const configurationReady = isConfigurationReady(input.domainConfig);
  const ownershipVerified = input.projectDomain?.verified !== false;
  const verificationStatus: VercelDomainVerificationStatus = ownershipVerified
    ? "verified"
    : "verification_required";
  const providerStatus: VercelDomainProviderStatus = input.lastError
    ? "error"
    : ownershipVerified && configurationReady
      ? "ready"
      : ownershipVerified
        ? "awaiting_dns"
        : "awaiting_verification";

  return {
    provider: VERCEL_PROVIDER,
    providerStatus,
    verificationStatus,
    dnsInstructions: buildDnsInstructions(input),
    lastCheckedAt: new Date().toISOString(),
    lastError: input.lastError ?? null,
    projectDomain: input.projectDomain,
    domainConfig: input.domainConfig,
  };
}

export async function fetchVercelDomainSnapshot(input: {
  hostname: string;
  attemptVerification?: boolean;
  client?: VercelDomainClient;
}) {
  const client = input.client ?? createVercelDomainClient();
  let projectDomain = await client.getProjectDomain(input.hostname);

  if (input.attemptVerification && projectDomain.verified === false) {
    try {
      projectDomain = await client.verifyProjectDomain(input.hostname);
    } catch (error) {
      if (
        !(error instanceof VercelDomainIntegrationError) ||
        error.status === 401 ||
        error.status === 403 ||
        error.retryable
      ) {
        throw error;
      }
    }
  }

  const domainConfig = await client.getDomainConfig(input.hostname);

  return buildVercelDomainSnapshot({
    hostname: input.hostname,
    projectDomain,
    domainConfig,
  });
}

export async function provisionVercelProjectDomain(input: {
  hostname: string;
  client?: VercelDomainClient;
}) {
  const client = input.client ?? createVercelDomainClient();

  try {
    await client.addProjectDomain(input.hostname);
  } catch (error) {
    if (
      !(error instanceof VercelDomainIntegrationError) ||
      (error.code !== "not_modified" && error.status !== 409 && error.status !== 400)
    ) {
      throw error;
    }
  }

  return fetchVercelDomainSnapshot({
    hostname: input.hostname,
    attemptVerification: true,
    client,
  });
}

export async function removeVercelProjectDomain(input: {
  hostname: string;
  client?: VercelDomainClient;
}) {
  const client = input.client ?? createVercelDomainClient();
  await client.removeProjectDomain(input.hostname);
}

export function getConfiguredPlatformPublicBaseDomain(env = process.env) {
  const normalized = normalizePublicHostname(env.PLATFORM_PUBLIC_BASE_DOMAIN);
  return normalized && !normalized.endsWith(".localhost") ? normalized : null;
}

export function isPlatformSubdomainCoveredByConfiguredWildcard(
  hostname: string,
  env = process.env,
) {
  const baseDomain = getConfiguredPlatformPublicBaseDomain(env);
  return Boolean(baseDomain && hostname.endsWith(`.${baseDomain}`) && hostname !== baseDomain);
}

export function buildWildcardPlatformSubdomainSnapshot(hostname: string): VercelDomainSnapshot {
  return {
    provider: VERCEL_PROVIDER,
    providerStatus: "ready",
    verificationStatus: "verified",
    dnsInstructions: {
      source: VERCEL_PROVIDER,
      records: [],
      notes: [
        `${hostname} is covered by the configured Vercel wildcard platform domain. No customer DNS change is required for this tenant subdomain.`,
      ],
    },
    lastCheckedAt: new Date().toISOString(),
    lastError: null,
    projectDomain: null,
    domainConfig: null,
  };
}
