import "server-only";

import {
  getAdminAuthRedirectRequestHost,
  getAdminAuthRedirectRequestProtocol,
  getAdminAuthRedirectUrl,
  type AdminAuthRedirectInput,
} from "./auth-redirects.ts";
import { buildAdminPasswordRecoveryEmail } from "../email/templates/admin-password-recovery.ts";
import type { TenantEmailSender } from "@/lib/email/tenant-sender";
import type { TenantRecord } from "@/lib/tenant/server";

type AdminRecoveryUser = {
  id: string;
  email?: string | null;
};

type AdminRecoveryEmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  fromEmail?: string;
  fromDisplayName?: string | null;
  region?: string | null;
  useDefaultReplyTo?: boolean;
};

type RecoveryRedirectInput = AdminAuthRedirectInput;

export type SendAdminPasswordRecoveryInput = RecoveryRedirectInput & {
  email: string;
};

export type SendAdminPasswordRecoveryResult = {
  status: "sent" | "skipped";
  tenant: TenantRecord | null;
  redirectTo: string;
  sender?: TenantEmailSender;
};

export type SendAdminPasswordRecoveryDeps = {
  resolveTenantFromHostname?: (hostname: string) => Promise<TenantRecord>;
  findAuthUserByEmail?: (email: string) => Promise<AdminRecoveryUser | null>;
  hasActiveAdminMembership?: (input: {
    businessId: string;
    authUserId: string;
  }) => Promise<boolean>;
  generateRecoveryLink?: (input: {
    email: string;
    redirectTo: string;
  }) => Promise<string | null>;
  getTenantCommunicationSettings?: (
    tenant: TenantRecord,
    context: { host?: string | null; protocol?: string | null },
  ) => Promise<{
    businessName: string;
    supportEmail: string | null;
    supportPhone: string | null;
    publicBaseUrl: string | null;
  }>;
  resolveTenantEmailSender?: (input: {
    tenant: TenantRecord;
    businessName: string;
    supportEmail?: string | null;
  }) => Promise<TenantEmailSender>;
  tenantSenderSendEmailOptions?: (sender: TenantEmailSender) => Promise<{
    fromEmail: string;
    fromDisplayName: string;
    replyTo: string | null;
    region?: string;
    useDefaultReplyTo: false;
  }> | {
    fromEmail: string;
    fromDisplayName: string;
    replyTo: string | null;
    region?: string;
    useDefaultReplyTo: false;
  };
  sendEmail?: (message: AdminRecoveryEmailMessage) => Promise<unknown>;
};

export function getAdminPasswordRecoveryRequestHost(input: RecoveryRedirectInput) {
  return getAdminAuthRedirectRequestHost(input);
}

export function getAdminPasswordRecoveryRequestProtocol(
  host: string,
  input: RecoveryRedirectInput,
) {
  return getAdminAuthRedirectRequestProtocol(host, input);
}

export function getAdminPasswordRecoveryRedirectUrl(input: RecoveryRedirectInput) {
  return getAdminAuthRedirectUrl("/admin/update-password", input);
}

async function defaultResolveTenantFromHostname(hostname: string) {
  const { resolvePublicTenantFromHostname } = await import("@/lib/tenant/server");
  return resolvePublicTenantFromHostname(hostname);
}

async function defaultFindAuthUserByEmail(email: string): Promise<AdminRecoveryUser | null> {
  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Could not list Supabase Auth users: ${error.message}`);
    }

    const users = data.users ?? [];
    const match = users.find((user) => user.email?.trim().toLowerCase() === email);

    if (match) {
      return {
        id: match.id,
        email: match.email,
      };
    }

    if (users.length < perPage) {
      return null;
    }
  }
}

async function defaultHasActiveAdminMembership(input: {
  businessId: string;
  authUserId: string;
}) {
  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  const { data, error } = await supabaseAdmin
    .from("business_admin_memberships")
    .select("id")
    .eq("business_id", input.businessId)
    .eq("auth_user_id", input.authUserId)
    .in("role", ["owner", "admin"])
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.id);
}

async function defaultGenerateRecoveryLink(input: {
  email: string;
  redirectTo: string;
}) {
  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: input.email,
    options: {
      redirectTo: input.redirectTo,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data?.properties?.action_link ?? null;
}

async function defaultGetTenantCommunicationSettings(
  tenant: TenantRecord,
  context: { host?: string | null; protocol?: string | null },
) {
  const { getTenantCommunicationSettings } = await import("@/lib/tenant/communications");
  return getTenantCommunicationSettings(tenant, context);
}

async function defaultResolveTenantEmailSender(input: {
  tenant: TenantRecord;
  businessName: string;
  supportEmail?: string | null;
}) {
  const { resolveTenantEmailSender } = await import("@/lib/email/tenant-sender");
  return resolveTenantEmailSender(input);
}

async function defaultSendEmail(message: AdminRecoveryEmailMessage) {
  const { sendEmail } = await import("@/lib/email/ses");
  return sendEmail(message);
}

async function defaultTenantSenderSendEmailOptions(sender: TenantEmailSender) {
  const { tenantSenderSendEmailOptions } = await import("@/lib/email/tenant-sender");
  return tenantSenderSendEmailOptions(sender);
}

export async function sendAdminPasswordRecoveryEmail(
  input: SendAdminPasswordRecoveryInput,
  deps: SendAdminPasswordRecoveryDeps = {},
): Promise<SendAdminPasswordRecoveryResult> {
  const requestHost = getAdminPasswordRecoveryRequestHost(input);
  const redirectTo = getAdminPasswordRecoveryRedirectUrl(input);

  if (!requestHost) {
    throw new Error("Admin password recovery requires a valid tenant request host.");
  }

  const requestProtocol = getAdminPasswordRecoveryRequestProtocol(requestHost, input);
  const resolveTenantFromHostname = deps.resolveTenantFromHostname ?? defaultResolveTenantFromHostname;
  const tenant = await resolveTenantFromHostname(requestHost);
  const findAuthUserByEmail = deps.findAuthUserByEmail ?? defaultFindAuthUserByEmail;
  const authUser = await findAuthUserByEmail(input.email);

  if (!authUser?.id) {
    return { status: "skipped", tenant, redirectTo };
  }

  const hasActiveAdminMembership = deps.hasActiveAdminMembership ?? defaultHasActiveAdminMembership;
  const hasMembership = await hasActiveAdminMembership({
    businessId: tenant.id,
    authUserId: authUser.id,
  });

  if (!hasMembership) {
    return { status: "skipped", tenant, redirectTo };
  }

  const getTenantCommunicationSettings =
    deps.getTenantCommunicationSettings ?? defaultGetTenantCommunicationSettings;
  const communication = await getTenantCommunicationSettings(tenant, {
    host: requestHost,
    protocol: requestProtocol,
  });
  const generateRecoveryLink = deps.generateRecoveryLink ?? defaultGenerateRecoveryLink;
  const actionLink = await generateRecoveryLink({
    email: input.email,
    redirectTo,
  });

  if (!actionLink) {
    throw new Error("Password recovery link was not generated.");
  }

  const resolveTenantEmailSender = deps.resolveTenantEmailSender ?? defaultResolveTenantEmailSender;
  const tenantSenderSendEmailOptions =
    deps.tenantSenderSendEmailOptions ??
    ((sender: TenantEmailSender) => defaultTenantSenderSendEmailOptions(sender));
  const sender = await resolveTenantEmailSender({
    tenant,
    businessName: communication.businessName,
    supportEmail: communication.supportEmail,
  });
  const senderOptions = await tenantSenderSendEmailOptions(sender);
  const recoveryEmail = buildAdminPasswordRecoveryEmail({
    businessName: communication.businessName,
    resetUrl: actionLink,
    supportEmail: communication.supportEmail,
    supportPhone: communication.supportPhone,
  });
  const sendEmail = deps.sendEmail ?? defaultSendEmail;

  await sendEmail({
    to: input.email,
    subject: recoveryEmail.subject,
    text: recoveryEmail.text,
    html: recoveryEmail.html,
    ...senderOptions,
  });

  return {
    status: "sent",
    tenant,
    redirectTo,
    sender,
  };
}
