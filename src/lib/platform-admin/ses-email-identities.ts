import "server-only";

import {
  CreateEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  GetEmailIdentityCommand,
  SESv2Client,
  type CreateEmailIdentityCommandOutput,
  type GetEmailIdentityCommandOutput,
} from "@aws-sdk/client-sesv2";
import {
  normalizeTenantEmailSenderDomain,
  type TenantEmailIdentityStatus,
} from "@/lib/email/tenant-email-identity";

export const SES_EMAIL_PROVIDER = "ses" as const;

export type SesEmailDnsRecordInstruction = {
  type: "CNAME";
  name: string;
  value: string;
  reason: string;
};

export type SesEmailDnsInstructions = {
  source: typeof SES_EMAIL_PROVIDER;
  records: SesEmailDnsRecordInstruction[];
  notes: string[];
};

export type SesEmailIdentityProviderStatus = TenantEmailIdentityStatus;

export type SesEmailIdentitySnapshot = {
  provider: typeof SES_EMAIL_PROVIDER;
  providerStatus: SesEmailIdentityProviderStatus;
  verificationStatus: SesEmailIdentityProviderStatus;
  sesRegion: string;
  dkimTokens: string[];
  dnsInstructions: SesEmailDnsInstructions | null;
  lastCheckedAt: string;
  lastError: string | null;
};

type SesEmailIdentityCommand =
  | CreateEmailIdentityCommand
  | GetEmailIdentityCommand
  | DeleteEmailIdentityCommand;

export type SesEmailIdentityClient = {
  send(command: SesEmailIdentityCommand): Promise<unknown>;
};

type SesEmailIdentityClientConfig = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type SesIdentitySnapshotInput = {
  senderDomain: string;
  verifiedForSending?: boolean;
  verificationStatus?: string;
  dkimStatus?: string;
  dkimTokens?: string[];
  signingHostedZone?: string | null;
  region?: string;
  lastError?: string | null;
};

export class SesEmailIdentityIntegrationError extends Error {
  code?: string;
  retryable: boolean;

  constructor(message: string, input?: { code?: string; retryable?: boolean }) {
    super(message);
    this.name = "SesEmailIdentityIntegrationError";
    this.code = input?.code;
    this.retryable = input?.retryable ?? false;
  }
}

function envValue(name: string, env = process.env) {
  const value = env[name]?.trim();
  return value || null;
}

export function getSesEmailIdentityIntegrationDiagnostics(env = process.env) {
  const regionConfigured = Boolean(env.AWS_REGION?.trim() || env.SES_REGION?.trim());
  const accessKeyConfigured = Boolean(env.AWS_ACCESS_KEY_ID?.trim());
  const secretKeyConfigured = Boolean(env.AWS_SECRET_ACCESS_KEY?.trim());

  return {
    regionConfigured,
    accessKeyConfigured,
    secretKeyConfigured,
    configured: regionConfigured && accessKeyConfigured && secretKeyConfigured,
  };
}

function getSesEmailIdentityClientConfig(): SesEmailIdentityClientConfig {
  const region = envValue("SES_REGION") ?? envValue("AWS_REGION");
  const accessKeyId = envValue("AWS_ACCESS_KEY_ID");
  const secretAccessKey = envValue("AWS_SECRET_ACCESS_KEY");

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new SesEmailIdentityIntegrationError(
      "SES email identity integration is not configured. Set AWS_REGION or SES_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.",
      { code: "configuration_missing" },
    );
  }

  return {
    region,
    accessKeyId,
    secretAccessKey,
  };
}

function getConfiguredSesRegion() {
  return getSesEmailIdentityClientConfig().region;
}

export function createSesEmailIdentityClient(
  config = getSesEmailIdentityClientConfig(),
): SesEmailIdentityClient {
  return new SESv2Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  }) as SesEmailIdentityClient;
}

function cleanDnsPart(value: string | null | undefined) {
  return value?.trim().replace(/\.$/, "") || null;
}

function normalizeDkimTokens(value: string[] | undefined) {
  if (!value) return [] as string[];

  return value
    .map((token) => cleanDnsPart(token))
    .filter((token): token is string => Boolean(token));
}

export function buildSesDkimDnsInstructions(input: {
  senderDomain: string;
  dkimTokens: string[];
  signingHostedZone?: string | null;
}): SesEmailDnsInstructions | null {
  const senderDomain = normalizeTenantEmailSenderDomain(input.senderDomain);
  const dkimTokens = normalizeDkimTokens(input.dkimTokens);
  const signingHostedZone = cleanDnsPart(input.signingHostedZone) ?? "dkim.amazonses.com";

  if (!senderDomain || dkimTokens.length === 0) {
    return null;
  }

  return {
    source: SES_EMAIL_PROVIDER,
    records: dkimTokens.map((token) => ({
      type: "CNAME",
      name: `${token}._domainkey.${senderDomain}`,
      value: `${token}.${signingHostedZone}`,
      reason: "Amazon SES Easy DKIM verification",
    })),
    notes: [
      "Add these CNAME records in the domain's DNS provider, then re-check verification from Platform Admin.",
      "No custom MAIL FROM records are managed in this phase.",
    ],
  };
}

function upper(value: string | undefined) {
  return value?.trim().toUpperCase() || null;
}

export function mapSesEmailIdentityStatus(input: {
  verifiedForSending?: boolean;
  verificationStatus?: string;
  dkimStatus?: string;
  dkimTokens?: string[];
}): SesEmailIdentityProviderStatus {
  const verificationStatus = upper(input.verificationStatus);
  const dkimStatus = upper(input.dkimStatus);
  const dkimTokens = normalizeDkimTokens(input.dkimTokens);

  if (input.verifiedForSending === true && dkimStatus === "SUCCESS") {
    return "verified";
  }

  if (
    verificationStatus === "FAILED" ||
    verificationStatus === "TEMPORARY_FAILURE" ||
    dkimStatus === "FAILED" ||
    dkimStatus === "TEMPORARY_FAILURE"
  ) {
    return "failed";
  }

  if (dkimTokens.length > 0) {
    return "dns_required";
  }

  return "pending";
}

export function buildSesEmailIdentitySnapshot(input: SesIdentitySnapshotInput): SesEmailIdentitySnapshot {
  const senderDomain = normalizeTenantEmailSenderDomain(input.senderDomain);
  if (!senderDomain) {
    throw new SesEmailIdentityIntegrationError("SES returned an invalid sender domain.", {
      code: "invalid_sender_domain",
    });
  }

  const dkimTokens = normalizeDkimTokens(input.dkimTokens);
  const providerStatus = input.lastError
    ? "failed"
    : mapSesEmailIdentityStatus({
        verifiedForSending: input.verifiedForSending,
        verificationStatus: input.verificationStatus,
        dkimStatus: input.dkimStatus,
        dkimTokens,
      });

  return {
    provider: SES_EMAIL_PROVIDER,
    providerStatus,
    verificationStatus: providerStatus,
    sesRegion: input.region ?? getConfiguredSesRegion(),
    dkimTokens,
    dnsInstructions: buildSesDkimDnsInstructions({
      senderDomain,
      dkimTokens,
      signingHostedZone: input.signingHostedZone,
    }),
    lastCheckedAt: new Date().toISOString(),
    lastError: input.lastError ?? null,
  };
}

function getDkimTokens(output: CreateEmailIdentityCommandOutput | GetEmailIdentityCommandOutput) {
  return output.DkimAttributes?.Tokens ?? [];
}

function getDkimStatus(output: CreateEmailIdentityCommandOutput | GetEmailIdentityCommandOutput) {
  return output.DkimAttributes?.Status;
}

function getSigningHostedZone(output: CreateEmailIdentityCommandOutput | GetEmailIdentityCommandOutput) {
  return output.DkimAttributes?.SigningHostedZone ?? null;
}

function buildSnapshotFromAwsOutput(input: {
  senderDomain: string;
  output: CreateEmailIdentityCommandOutput | GetEmailIdentityCommandOutput;
  region: string;
}) {
  return buildSesEmailIdentitySnapshot({
    senderDomain: input.senderDomain,
    verifiedForSending: input.output.VerifiedForSendingStatus,
    verificationStatus: "VerificationStatus" in input.output
      ? input.output.VerificationStatus
      : undefined,
    dkimStatus: getDkimStatus(input.output),
    dkimTokens: getDkimTokens(input.output),
    signingHostedZone: getSigningHostedZone(input.output),
    region: input.region,
  });
}

function isAlreadyExistsError(error: unknown) {
  const candidate = error as { name?: unknown; Code?: unknown; code?: unknown; message?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name : "";
  const code = typeof candidate.code === "string"
    ? candidate.code
    : typeof candidate.Code === "string"
      ? candidate.Code
      : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";

  return /AlreadyExists/i.test(name) ||
    /AlreadyExists/i.test(code) ||
    /already exists/i.test(message);
}

function isNotFoundError(error: unknown) {
  const candidate = error as { name?: unknown; Code?: unknown; code?: unknown; message?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name : "";
  const code = typeof candidate.code === "string"
    ? candidate.code
    : typeof candidate.Code === "string"
      ? candidate.Code
      : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";

  return /NotFound/i.test(name) ||
    /NotFound/i.test(code) ||
    /not found/i.test(message);
}

export function mapSesEmailIdentityError(error: unknown): SesEmailIdentityIntegrationError {
  if (error instanceof SesEmailIdentityIntegrationError) {
    return error;
  }

  const message = error instanceof Error
    ? error.message
    : "SES could not complete the email identity request.";

  if (
    message.includes("AWS_REGION") ||
    message.includes("SES_REGION") ||
    message.includes("AWS_ACCESS_KEY_ID") ||
    message.includes("AWS_SECRET_ACCESS_KEY")
  ) {
    return new SesEmailIdentityIntegrationError(message, { code: "configuration_missing" });
  }

  if (isNotFoundError(error)) {
    return new SesEmailIdentityIntegrationError("SES email identity was not found.", {
      code: "identity_not_found",
    });
  }

  return new SesEmailIdentityIntegrationError(message, { code: "provider_error" });
}

export async function fetchSesEmailIdentitySnapshot(input: {
  senderDomain: string;
  client?: SesEmailIdentityClient;
  region?: string;
}) {
  const senderDomain = normalizeTenantEmailSenderDomain(input.senderDomain);
  if (!senderDomain) {
    throw new SesEmailIdentityIntegrationError("Enter a valid sender domain.", {
      code: "invalid_sender_domain",
    });
  }

  const region = input.region ?? getConfiguredSesRegion();
  const client = input.client ?? createSesEmailIdentityClient();
  const output = await client.send(new GetEmailIdentityCommand({ EmailIdentity: senderDomain }));

  return buildSnapshotFromAwsOutput({
    senderDomain,
    output: output as GetEmailIdentityCommandOutput,
    region,
  });
}

export async function provisionSesEmailIdentity(input: {
  senderDomain: string;
  client?: SesEmailIdentityClient;
  region?: string;
}) {
  const senderDomain = normalizeTenantEmailSenderDomain(input.senderDomain);
  if (!senderDomain) {
    throw new SesEmailIdentityIntegrationError("Enter a valid sender domain.", {
      code: "invalid_sender_domain",
    });
  }

  const region = input.region ?? getConfiguredSesRegion();
  const client = input.client ?? createSesEmailIdentityClient();

  try {
    const output = await client.send(
      new CreateEmailIdentityCommand({ EmailIdentity: senderDomain }),
    );

    return buildSnapshotFromAwsOutput({
      senderDomain,
      output: output as CreateEmailIdentityCommandOutput,
      region,
    });
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }
  }

  return fetchSesEmailIdentitySnapshot({ senderDomain, client, region });
}

export async function removeSesEmailIdentity(input: {
  senderDomain: string;
  client?: SesEmailIdentityClient;
}) {
  const senderDomain = normalizeTenantEmailSenderDomain(input.senderDomain);
  if (!senderDomain) {
    throw new SesEmailIdentityIntegrationError("Enter a valid sender domain.", {
      code: "invalid_sender_domain",
    });
  }

  const client = input.client ?? createSesEmailIdentityClient();

  try {
    await client.send(new DeleteEmailIdentityCommand({ EmailIdentity: senderDomain }));
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }
}
