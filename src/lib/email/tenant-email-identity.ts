import "server-only";

export const TENANT_EMAIL_IDENTITY_STATUSES = [
  "pending",
  "dns_required",
  "verified",
  "failed",
  "disabled",
] as const;

export type TenantEmailIdentityStatus = (typeof TENANT_EMAIL_IDENTITY_STATUSES)[number];

export type TenantEmailIdentity = {
  id: string;
  businessId: string;
  senderDomain: string;
  senderLocalPart: string;
  fromEmail: string;
  senderDisplayName: string | null;
  replyToEmail: string | null;
  provider: "ses";
  providerStatus: TenantEmailIdentityStatus;
  verificationStatus: TenantEmailIdentityStatus;
  sesRegion: string | null;
  dkimTokens: string[];
  dnsInstructions: unknown;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantEmailIdentityRow = {
  id: string;
  business_id: string;
  sender_domain: string;
  sender_local_part: string;
  sender_display_name: string | null;
  reply_to_email: string | null;
  provider: string;
  provider_status: string;
  verification_status: string;
  ses_region: string | null;
  dkim_tokens: unknown;
  dns_instructions: unknown;
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type TenantEmailIdentityQuery<T> = {
  eq(column: string, value: string): TenantEmailIdentityQuery<T>;
  maybeSingle<U = T>(): Promise<SupabaseResult<U>>;
};

type TenantEmailIdentityTableClient = {
  select(columns: string): TenantEmailIdentityQuery<TenantEmailIdentityRow>;
};

type TenantEmailIdentitySupabaseClient = {
  from(table: "tenant_email_identities"): TenantEmailIdentityTableClient;
};

export const TENANT_EMAIL_IDENTITY_SELECT = [
  "id",
  "business_id",
  "sender_domain",
  "sender_local_part",
  "sender_display_name",
  "reply_to_email",
  "provider",
  "provider_status",
  "verification_status",
  "ses_region",
  "dkim_tokens",
  "dns_instructions",
  "last_checked_at",
  "last_error",
  "created_at",
  "updated_at",
].join(", ");

let supabaseClientForTesting: TenantEmailIdentitySupabaseClient | null = null;

export function setTenantEmailIdentitySupabaseClientForTesting(
  client: TenantEmailIdentitySupabaseClient | null,
) {
  supabaseClientForTesting = client;
}

export function cleanTenantEmailIdentityText(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function normalizeLower(value: string | null | undefined) {
  return cleanTenantEmailIdentityText(value)?.toLowerCase() ?? null;
}

export function normalizeTenantEmailSenderDomain(value: string | null | undefined) {
  const normalized = normalizeLower(value);
  if (!normalized) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)) return null;
  if (/[:/?#]/.test(normalized)) return null;
  if (normalized.length > 253) return null;
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(normalized)) {
    return null;
  }
  return normalized;
}

export function normalizeTenantEmailSenderLocalPart(value: string | null | undefined) {
  const normalized = normalizeLower(value);
  if (!normalized) return null;
  if (normalized.length > 64) return null;
  if (!/^[a-z0-9][a-z0-9._+-]{0,63}$/.test(normalized)) return null;
  if (normalized.includes("..") || normalized.endsWith(".")) return null;
  return normalized;
}

export function deriveTenantEmailFromAddress(input: {
  senderDomain: string;
  senderLocalPart: string;
}) {
  const senderDomain = normalizeTenantEmailSenderDomain(input.senderDomain);
  const senderLocalPart = normalizeTenantEmailSenderLocalPart(input.senderLocalPart);

  if (!senderDomain || !senderLocalPart) {
    return null;
  }

  return `${senderLocalPart}@${senderDomain}`;
}

export function normalizeTenantEmailIdentityStatus(value: string): TenantEmailIdentityStatus {
  return TENANT_EMAIL_IDENTITY_STATUSES.includes(value as TenantEmailIdentityStatus)
    ? (value as TenantEmailIdentityStatus)
    : "pending";
}

function normalizeDkimTokens(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];

  return value
    .filter((token): token is string => typeof token === "string")
    .map((token) => token.trim())
    .filter(Boolean);
}

function toTenantEmailIdentity(row: TenantEmailIdentityRow): TenantEmailIdentity | null {
  const senderDomain = normalizeTenantEmailSenderDomain(row.sender_domain);
  const senderLocalPart = normalizeTenantEmailSenderLocalPart(row.sender_local_part);
  const fromEmail = deriveTenantEmailFromAddress({
    senderDomain: row.sender_domain,
    senderLocalPart: row.sender_local_part,
  });

  if (!senderDomain || !senderLocalPart || !fromEmail || row.provider !== "ses") {
    return null;
  }

  return {
    id: row.id,
    businessId: row.business_id,
    senderDomain,
    senderLocalPart,
    fromEmail,
    senderDisplayName: cleanTenantEmailIdentityText(row.sender_display_name),
    replyToEmail: normalizeLower(row.reply_to_email),
    provider: "ses",
    providerStatus: normalizeTenantEmailIdentityStatus(row.provider_status),
    verificationStatus: normalizeTenantEmailIdentityStatus(row.verification_status),
    sesRegion: cleanTenantEmailIdentityText(row.ses_region),
    dkimTokens: normalizeDkimTokens(row.dkim_tokens),
    dnsInstructions: row.dns_instructions,
    lastCheckedAt: row.last_checked_at,
    lastError: cleanTenantEmailIdentityText(row.last_error),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getSupabaseClient() {
  if (supabaseClientForTesting) return supabaseClientForTesting;
  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  return supabaseAdmin as unknown as TenantEmailIdentitySupabaseClient;
}

export async function getTenantEmailIdentityByBusinessId(businessId: string) {
  const cleanBusinessId = cleanTenantEmailIdentityText(businessId);
  if (!cleanBusinessId) return null;

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("tenant_email_identities")
    .select(TENANT_EMAIL_IDENTITY_SELECT)
    .eq("business_id", cleanBusinessId)
    .maybeSingle<TenantEmailIdentityRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toTenantEmailIdentity(data) : null;
}
