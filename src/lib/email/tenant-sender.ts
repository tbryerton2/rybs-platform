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

function assertVerifiedIdentity(
  identity: TenantEmailIdentity | null,
  businessId: string,
): TenantEmailIdentity {
  if (
    !identity ||
    identity.businessId !== businessId ||
    identity.provider !== "ses" ||
    identity.providerStatus !== "verified" ||
    identity.verificationStatus !== "verified"
  ) {
    throw new TenantEmailSenderError("not_verified");
  }

  return identity;
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

export async function resolveTenantEmailSender(
  input: ResolveTenantEmailSenderInput,
): Promise<TenantEmailSender> {
  const businessId = assertTrustedBusinessId(input);
  const [identity, tenant] = await Promise.all([
    getTenantEmailIdentityByBusinessId(businessId),
    loadTenantContext(input, businessId),
  ]);
  const verifiedIdentity = assertVerifiedIdentity(identity, businessId);
  const allowSupportFallback = input.allowSupportReplyToFallback !== false;
  const [brand, support] = await Promise.all([
    input.businessName ? null : getBrandSettingsForTenant(tenant),
    input.supportEmail || !allowSupportFallback ? null : getSupportSettingsForTenant(businessId),
  ]);
  const senderDisplayName =
    clean(verifiedIdentity.senderDisplayName) ??
    clean(input.businessName) ??
    clean(brand?.name) ??
    tenant.slug;
  const replyToEmail =
    cleanEmail(verifiedIdentity.replyToEmail) ??
    cleanEmail(input.supportEmail) ??
    (allowSupportFallback ? cleanEmail(support?.email) : null);

  return {
    businessId,
    senderDisplayName,
    senderEmail: verifiedIdentity.fromEmail,
    formattedFrom: formatTenantEmailSenderSource({
      senderDisplayName,
      senderEmail: verifiedIdentity.fromEmail,
    }),
    replyToEmail,
    sesRegion: verifiedIdentity.sesRegion,
    providerStatus: verifiedIdentity.providerStatus,
    verificationStatus: verifiedIdentity.verificationStatus,
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
