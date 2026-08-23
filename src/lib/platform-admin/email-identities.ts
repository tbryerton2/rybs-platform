import "server-only";

import {
  TENANT_EMAIL_IDENTITY_SELECT,
  cleanTenantEmailIdentityText,
  getTenantEmailIdentityByBusinessId,
  normalizeTenantEmailSenderDomain,
  normalizeTenantEmailSenderLocalPart,
  type TenantEmailIdentity,
  type TenantEmailIdentityRow,
} from "@/lib/email/tenant-email-identity";
import { requirePlatformAdmin } from "@/lib/platform-admin/auth";
import {
  normalizePlatformTenantId,
  type PlatformTenantValidationError,
} from "@/lib/platform-admin/tenant-validation";
import {
  SES_EMAIL_PROVIDER,
  fetchSesEmailIdentitySnapshot,
  getSesEmailIdentityIntegrationDiagnostics,
  mapSesEmailIdentityError,
  provisionSesEmailIdentity,
  removeSesEmailIdentity,
  type SesEmailIdentitySnapshot,
} from "@/lib/platform-admin/ses-email-identities";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findTenantByIdStrict } from "@/lib/tenant/server";

export type PlatformEmailIdentityField =
  | PlatformTenantValidationError["field"]
  | "senderDomain"
  | "senderLocalPart"
  | "senderDisplayName"
  | "replyToEmail"
  | "providerStatus"
  | "confirmation";

export type SavePlatformTenantEmailIdentityInput = {
  tenantId: unknown;
  senderDomain: unknown;
  senderLocalPart: unknown;
  senderDisplayName?: unknown;
  replyToEmail?: unknown;
};

export type TenantEmailIdentityMutationInput = {
  tenantId: unknown;
};

export type RemovePlatformTenantEmailIdentityInput = TenantEmailIdentityMutationInput & {
  confirmation?: unknown;
};

type SupabaseDbError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

type EmailIdentityOwnerRow = {
  id: string;
  business_id: string;
  sender_domain: string;
};

export class PlatformEmailIdentityMutationError extends Error {
  code:
    | "invalid_input"
    | "duplicate_sender_domain"
    | "duplicate_identity"
    | "not_found"
    | "unsafe_replacement"
    | "unsafe_removal"
    | "provider_not_configured"
    | "provider_error"
    | "database_error";
  field?: PlatformEmailIdentityField;

  constructor(
    code: PlatformEmailIdentityMutationError["code"],
    message: string,
    field?: PlatformEmailIdentityField,
  ) {
    super(message);
    this.name = "PlatformEmailIdentityMutationError";
    this.code = code;
    this.field = field;
  }
}

function throwValidationError(message: string, field: PlatformEmailIdentityField): never {
  throw new PlatformEmailIdentityMutationError("invalid_input", message, field);
}

function logEmailIdentityMutationError(event: string, details: Record<string, unknown>) {
  console.error("[platform-admin-email-identities]", { event, ...details });
}

function mapDatabaseMutationError(error: SupabaseDbError, context: Record<string, unknown>): never {
  logEmailIdentityMutationError("mutation_database_error", {
    ...context,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  if (
    error.code === "23505" ||
    error.message?.includes("tenant_email_identities_sender_domain_unique")
  ) {
    throw new PlatformEmailIdentityMutationError(
      "duplicate_sender_domain",
      "That sender domain is already assigned to another business.",
      "senderDomain",
    );
  }

  if (error.message?.includes("tenant_email_identities_business_unique")) {
    throw new PlatformEmailIdentityMutationError(
      "duplicate_identity",
      "This business already has a sender identity.",
      "senderDomain",
    );
  }

  throw new PlatformEmailIdentityMutationError(
    "database_error",
    "We could not save this sender identity. Try again in a moment.",
  );
}

function normalizeSenderDomain(input: unknown) {
  const raw = typeof input === "string" ? input : "";
  const senderDomain = normalizeTenantEmailSenderDomain(raw);

  if (!senderDomain) {
    throwValidationError("Enter a valid sender domain.", "senderDomain");
  }

  return senderDomain;
}

function normalizeSenderLocalPart(input: unknown) {
  const raw = typeof input === "string" && input.trim() ? input : "bookings";
  const senderLocalPart = normalizeTenantEmailSenderLocalPart(raw);

  if (!senderLocalPart) {
    throwValidationError("Enter a valid sender local part.", "senderLocalPart");
  }

  return senderLocalPart;
}

function normalizeOptionalEmail(input: unknown) {
  const value = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (!value) return null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throwValidationError("Enter a valid Reply-To email address.", "replyToEmail");
  }

  return value;
}

function normalizeOptionalDisplayName(input: unknown) {
  const value = typeof input === "string" ? input.trim() : "";
  return value || null;
}

async function requireTenantForEmailIdentityMutation(tenantIdInput: unknown) {
  const tenantId = normalizePlatformTenantId(tenantIdInput);
  if (!tenantId.ok) {
    throwValidationError(tenantId.error.message, tenantId.error.field);
  }

  const tenant = await findTenantByIdStrict(tenantId.value, { requireActive: false });
  if (!tenant) {
    throw new PlatformEmailIdentityMutationError("not_found", "Business not found.", "tenantId");
  }

  return tenant;
}

function mapProviderError(error: unknown): PlatformEmailIdentityMutationError {
  if (error instanceof PlatformEmailIdentityMutationError) {
    return error;
  }

  const providerError = mapSesEmailIdentityError(error);

  if (providerError.code === "configuration_missing") {
    return new PlatformEmailIdentityMutationError(
      "provider_not_configured",
      providerError.message,
      "providerStatus",
    );
  }

  return new PlatformEmailIdentityMutationError(
    "provider_error",
    providerError.message,
    "providerStatus",
  );
}

function providerSnapshotUpdate(snapshot: SesEmailIdentitySnapshot) {
  return {
    provider: snapshot.provider,
    provider_status: snapshot.providerStatus,
    verification_status: snapshot.verificationStatus,
    ses_region: snapshot.sesRegion,
    dkim_tokens: snapshot.dkimTokens,
    dns_instructions: snapshot.dnsInstructions,
    last_checked_at: snapshot.lastCheckedAt,
    last_error: snapshot.lastError,
  };
}

async function loadEmailIdentityForTenant(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("tenant_email_identities")
    .select(TENANT_EMAIL_IDENTITY_SELECT)
    .eq("business_id", tenantId)
    .maybeSingle();

  if (error) {
    mapDatabaseMutationError(error, { operation: "load_email_identity", tenantId });
  }

  if (!data) {
    throw new PlatformEmailIdentityMutationError(
      "not_found",
      "Email sender identity has not been configured for this business.",
      "senderDomain",
    );
  }

  const identity = await getTenantEmailIdentityByBusinessId(tenantId);
  if (!identity) {
    throw new PlatformEmailIdentityMutationError(
      "database_error",
      "Email sender identity exists but could not be read safely.",
    );
  }

  return identity;
}

async function assertSenderDomainAvailableForTenant(senderDomain: string, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("tenant_email_identities")
    .select("id, business_id, sender_domain")
    .eq("sender_domain", senderDomain)
    .maybeSingle();

  if (error) {
    mapDatabaseMutationError(error, { operation: "check_sender_domain", senderDomain, tenantId });
  }

  const existing = data as EmailIdentityOwnerRow | null;
  if (!existing || existing.business_id === tenantId) {
    return;
  }

  throw new PlatformEmailIdentityMutationError(
    "duplicate_sender_domain",
    "That sender domain is already assigned to another business.",
    "senderDomain",
  );
}

function assertDomainCanBeChanged(existing: TenantEmailIdentity | null, nextSenderDomain: string) {
  if (!existing || existing.senderDomain === nextSenderDomain) {
    return;
  }

  if (
    existing.providerStatus === "verified" ||
    existing.providerStatus === "dns_required" ||
    existing.providerStatus === "failed"
  ) {
    throw new PlatformEmailIdentityMutationError(
      "unsafe_replacement",
      "Remove the existing SES email identity before changing the sender domain.",
      "senderDomain",
    );
  }
}

async function updateEmailIdentityProviderSnapshot(
  identity: TenantEmailIdentity,
  snapshot: SesEmailIdentitySnapshot,
) {
  const { error } = await supabaseAdmin
    .from("tenant_email_identities")
    .update(providerSnapshotUpdate(snapshot))
    .eq("id", identity.id)
    .eq("business_id", identity.businessId);

  if (error) {
    mapDatabaseMutationError(error, {
      operation: "update_email_identity_provider_snapshot",
      tenantId: identity.businessId,
      identityId: identity.id,
    });
  }
}

async function markEmailIdentityProviderError(
  identity: TenantEmailIdentity,
  error: PlatformEmailIdentityMutationError,
) {
  const { error: dbError } = await supabaseAdmin
    .from("tenant_email_identities")
    .update({
      provider: SES_EMAIL_PROVIDER,
      provider_status: "failed",
      verification_status: identity.verificationStatus,
      last_checked_at: new Date().toISOString(),
      last_error: error.message,
    })
    .eq("id", identity.id)
    .eq("business_id", identity.businessId);

  if (dbError) {
    mapDatabaseMutationError(dbError, {
      operation: "mark_email_identity_provider_error",
      tenantId: identity.businessId,
      identityId: identity.id,
    });
  }
}

async function markEmailIdentityProvisioning(identity: TenantEmailIdentity) {
  const { error } = await supabaseAdmin
    .from("tenant_email_identities")
    .update({
      provider: SES_EMAIL_PROVIDER,
      last_checked_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", identity.id)
    .eq("business_id", identity.businessId);

  if (error) {
    mapDatabaseMutationError(error, {
      operation: "mark_email_identity_provisioning",
      tenantId: identity.businessId,
      identityId: identity.id,
    });
  }
}

function shouldRemoveSesIdentity(identity: TenantEmailIdentity) {
  return identity.provider === SES_EMAIL_PROVIDER &&
    identity.providerStatus !== "pending" &&
    identity.providerStatus !== "disabled";
}

async function removeProviderIdentityIfNeeded(identity: TenantEmailIdentity) {
  if (!shouldRemoveSesIdentity(identity)) {
    return;
  }

  try {
    await removeSesEmailIdentity({ senderDomain: identity.senderDomain });
  } catch (error) {
    const providerError = mapProviderError(error);
    await markEmailIdentityProviderError(identity, providerError);
    throw providerError;
  }
}

export function getPlatformEmailIdentityIntegrationStatus() {
  return getSesEmailIdentityIntegrationDiagnostics();
}

export async function getPlatformTenantEmailIdentity(tenantIdInput: unknown) {
  await requirePlatformAdmin();
  const tenant = await requireTenantForEmailIdentityMutation(tenantIdInput);
  return getTenantEmailIdentityByBusinessId(tenant.id);
}

export async function savePlatformTenantEmailIdentity(input: SavePlatformTenantEmailIdentityInput) {
  await requirePlatformAdmin();
  const tenant = await requireTenantForEmailIdentityMutation(input.tenantId);
  const senderDomain = normalizeSenderDomain(input.senderDomain);
  const senderLocalPart = normalizeSenderLocalPart(input.senderLocalPart);
  const senderDisplayName = normalizeOptionalDisplayName(input.senderDisplayName);
  const replyToEmail = normalizeOptionalEmail(input.replyToEmail);
  const existing = await getTenantEmailIdentityByBusinessId(tenant.id);

  assertDomainCanBeChanged(existing, senderDomain);
  await assertSenderDomainAvailableForTenant(senderDomain, tenant.id);

  const basePayload = {
    sender_domain: senderDomain,
    sender_local_part: senderLocalPart,
    sender_display_name: senderDisplayName,
    reply_to_email: replyToEmail,
    provider: SES_EMAIL_PROVIDER,
  };
  const domainChanged = existing && existing.senderDomain !== senderDomain;

  if (existing) {
    const { error } = await supabaseAdmin
      .from("tenant_email_identities")
      .update({
        ...basePayload,
        ...(domainChanged
          ? {
              provider_status: "pending",
              verification_status: "pending",
              ses_region: null,
              dkim_tokens: [],
              dns_instructions: null,
              last_checked_at: null,
              last_error: null,
            }
          : { last_error: cleanTenantEmailIdentityText(existing.lastError) }),
      })
      .eq("id", existing.id)
      .eq("business_id", tenant.id);

    if (error) {
      mapDatabaseMutationError(error, {
        operation: "update_email_identity",
        tenantId: tenant.id,
        senderDomain,
      });
    }
  } else {
    const { error } = await supabaseAdmin
      .from("tenant_email_identities")
      .insert({
        business_id: tenant.id,
        ...basePayload,
        provider_status: "pending",
        verification_status: "pending",
        dkim_tokens: [],
      } satisfies Partial<TenantEmailIdentityRow>);

    if (error) {
      mapDatabaseMutationError(error, {
        operation: "create_email_identity",
        tenantId: tenant.id,
        senderDomain,
      });
    }
  }

  return { tenantId: tenant.id };
}

export async function provisionPlatformTenantEmailIdentity(input: TenantEmailIdentityMutationInput) {
  await requirePlatformAdmin();
  const tenant = await requireTenantForEmailIdentityMutation(input.tenantId);
  const identity = await loadEmailIdentityForTenant(tenant.id);

  if (identity.providerStatus === "disabled") {
    throw new PlatformEmailIdentityMutationError(
      "invalid_input",
      "Enable or save this email sender identity before provisioning it.",
      "providerStatus",
    );
  }

  await markEmailIdentityProvisioning(identity);

  try {
    const snapshot = await provisionSesEmailIdentity({ senderDomain: identity.senderDomain });
    await updateEmailIdentityProviderSnapshot(identity, snapshot);
  } catch (error) {
    const providerError = mapProviderError(error);
    await markEmailIdentityProviderError(identity, providerError);
    throw providerError;
  }

  return { tenantId: tenant.id };
}

export async function checkPlatformTenantEmailIdentity(input: TenantEmailIdentityMutationInput) {
  await requirePlatformAdmin();
  const tenant = await requireTenantForEmailIdentityMutation(input.tenantId);
  const identity = await loadEmailIdentityForTenant(tenant.id);

  try {
    const snapshot = await fetchSesEmailIdentitySnapshot({ senderDomain: identity.senderDomain });
    await updateEmailIdentityProviderSnapshot(identity, snapshot);
  } catch (error) {
    const providerError = mapProviderError(error);
    await markEmailIdentityProviderError(identity, providerError);
    throw providerError;
  }

  return { tenantId: tenant.id };
}

export async function disablePlatformTenantEmailIdentity(input: TenantEmailIdentityMutationInput) {
  await requirePlatformAdmin();
  const tenant = await requireTenantForEmailIdentityMutation(input.tenantId);
  const identity = await loadEmailIdentityForTenant(tenant.id);

  await removeProviderIdentityIfNeeded(identity);

  const { error } = await supabaseAdmin
    .from("tenant_email_identities")
    .update({
      provider_status: "disabled",
      verification_status: "disabled",
      dkim_tokens: [],
      dns_instructions: null,
      last_checked_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", identity.id)
    .eq("business_id", tenant.id);

  if (error) {
    mapDatabaseMutationError(error, {
      operation: "disable_email_identity",
      tenantId: tenant.id,
      identityId: identity.id,
    });
  }

  return { tenantId: tenant.id };
}

export async function removePlatformTenantEmailIdentity(input: RemovePlatformTenantEmailIdentityInput) {
  await requirePlatformAdmin();
  const tenant = await requireTenantForEmailIdentityMutation(input.tenantId);
  const identity = await loadEmailIdentityForTenant(tenant.id);
  const confirmation = typeof input.confirmation === "string"
    ? input.confirmation.trim().toLowerCase()
    : "";

  if (confirmation !== identity.senderDomain) {
    throw new PlatformEmailIdentityMutationError(
      "unsafe_removal",
      "Type the sender domain to confirm removal.",
      "confirmation",
    );
  }

  await removeProviderIdentityIfNeeded(identity);

  const { error } = await supabaseAdmin
    .from("tenant_email_identities")
    .delete()
    .eq("id", identity.id)
    .eq("business_id", tenant.id);

  if (error) {
    mapDatabaseMutationError(error, {
      operation: "remove_email_identity",
      tenantId: tenant.id,
      identityId: identity.id,
    });
  }

  return { tenantId: tenant.id };
}
