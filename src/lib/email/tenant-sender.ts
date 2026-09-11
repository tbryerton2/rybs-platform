import "server-only";

import {
  getTenantEmailIdentityByBusinessId,
  type TenantEmailIdentity,
  type TenantEmailIdentityStatus,
} from "@/lib/email/tenant-email-identity";
import {
  findTenantByIdStrict,
  getBrandSettingsForTenant,
  getSupportSettingsForTenant,
  type TenantRecord,
} from "@/lib/tenant/server";

export type TenantEmailSender = {
  businessId: string;
  source: "tenant_verified" | "rybs_managed";
  senderDisplayName: string;
  senderEmail: string;
  formattedFrom: string;
  replyToEmail: string | null;
  sesRegion: string | null;
  providerStatus: TenantEmailIdentityStatus;
  verificationStatus: TenantEmailIdentityStatus;
};

export type ResolveTenantEmailSenderInput = {
  businessId?: string | null;
  tenant?: TenantRecord | null;
  businessName?: string | null;
  supportEmail?: string | null;
  allowSupportReplyToFallback?: boolean;
};

export class TenantEmailSenderError extends Error {
  code: "invalid_context" | "not_verified";

  constructor(code: TenantEmailSenderError["code"], message = "Tenant email sender is not verified.") {
    super(message);
    this.name = "TenantEmailSenderError";
    this.code = code;
  }
}

function clean(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function cleanEmail(value: string | null | undefined) {
  const cleaned = clean(value)?.toLowerCase() ?? null;
  return cleaned && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) ? cleaned : null;
}

function assertTrustedBusinessId(input: ResolveTenantEmailSenderInput) {
  const businessId = clean(input.businessId) ?? clean(input.tenant?.id);

  if (!businessId) {
    throw new TenantEmailSenderError(
      "invalid_context",
      "Tenant email sender requires a trusted business_id.",
    );
  }

  if (input.tenant && input.tenant.id !== businessId) {
    throw new TenantEmailSenderError(
      "invalid_context",
      "Tenant email sender context does not match the requested business_id.",
    );
  }

  return businessId;
}

function quoteDisplayName(value: string) {
  return `"${value.replace(/[\r\n]+/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function formatTenantEmailSenderSource(input: {
  senderDisplayName?: string | null;
  senderEmail: string;
}) {
  const displayName = clean(input.senderDisplayName);
  return displayName ? `${quoteDisplayName(displayName)} <${input.senderEmail}>` : input.senderEmail;
}

function isVerifiedIdentity(
  identity: TenantEmailIdentity | null,
  businessId: string,
) {
  return Boolean(
    identity &&
      identity.businessId === businessId &&
      identity.provider === "ses" &&
      identity.providerStatus === "verified" &&
      identity.verificationStatus === "verified",
  );
}

async function loadTenantContext(input: ResolveTenantEmailSenderInput, businessId: string) {
  const tenant = input.tenant ?? (await findTenantByIdStrict(businessId, { requireActive: false }));

  if (!tenant) {
    throw new TenantEmailSenderError(
      "invalid_context",
      "Tenant email sender could not find the requested business.",
    );
  }

  return tenant;
}

export function getRybManagedEmailSenderConfig(env = process.env) {
  const senderEmail = cleanEmail(env.RYBS_MANAGED_SES_FROM_EMAIL);
  const sesRegion = clean(env.RYBS_MANAGED_SES_REGION) ?? null;

  return {
    configured: Boolean(senderEmail),
    senderEmail,
    sesRegion,
  };
}

export async function resolveTenantEmailSender(
  input: ResolveTenantEmailSenderInput,
): Promise<TenantEmailSender> {
  const businessId = assertTrustedBusinessId(input);
  const [identity, tenant] = await Promise.all([
    getTenantEmailIdentityByBusinessId(businessId),
    loadTenantContext(input, businessId),
  ]);
  const allowSupportFallback = input.allowSupportReplyToFallback !== false;
  const [brand, support] = await Promise.all([
    input.businessName ? null : getBrandSettingsForTenant(tenant),
    input.supportEmail || !allowSupportFallback ? null : getSupportSettingsForTenant(businessId),
  ]);
  const verifiedIdentity = isVerifiedIdentity(identity, businessId) ? identity : null;
  const rybsManagedSender = getRybManagedEmailSenderConfig();
  const senderEmail = verifiedIdentity?.fromEmail ?? rybsManagedSender.senderEmail;

  if (!senderEmail) {
    throw new TenantEmailSenderError("not_verified");
  }

  const senderDisplayName =
    clean(verifiedIdentity?.senderDisplayName) ??
    clean(identity?.senderDisplayName) ??
    clean(input.businessName) ??
    clean(brand?.name) ??
    tenant.slug;
  const replyToEmail =
    cleanEmail(verifiedIdentity?.replyToEmail) ??
    cleanEmail(identity?.replyToEmail) ??
    cleanEmail(input.supportEmail) ??
    (allowSupportFallback ? cleanEmail(support?.email) : null);
  const source = verifiedIdentity ? "tenant_verified" : "rybs_managed";
  const sesRegion = verifiedIdentity?.sesRegion ?? rybsManagedSender.sesRegion;

  return {
    businessId,
    source,
    senderDisplayName,
    senderEmail,
    formattedFrom: formatTenantEmailSenderSource({
      senderDisplayName,
      senderEmail,
    }),
    replyToEmail,
    sesRegion,
    providerStatus: verifiedIdentity?.providerStatus ?? "verified",
    verificationStatus: verifiedIdentity?.verificationStatus ?? "verified",
  };
}

export function tenantSenderSendEmailOptions(sender: TenantEmailSender) {
  return {
    fromEmail: sender.senderEmail,
    fromDisplayName: sender.senderDisplayName,
    replyTo: sender.replyToEmail,
    region: sender.sesRegion ?? undefined,
    useDefaultReplyTo: false,
  };
}
