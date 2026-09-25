import "server-only";

import {
  getAdminAuthRedirectUrl,
  type AdminAuthRedirectInput,
} from "./auth-redirects.ts";
import { buildAdminPasswordRecoveryEmail } from "../email/templates/admin-password-recovery.ts";

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
  redirectTo: string;
};

export type SendAdminPasswordRecoveryDeps = {
  findAuthUserByEmail?: (email: string) => Promise<AdminRecoveryUser | null>;
  hasActiveAdminMembership?: (authUserId: string) => Promise<boolean>;
  generateRecoveryLink?: (input: {
    email: string;
    redirectTo: string;
  }) => Promise<string | null>;
  getRybManagedEmailSenderConfig?: () => {
    senderEmail: string | null;
    sesRegion: string | null;
  };
  sendEmail?: (message: AdminRecoveryEmailMessage) => Promise<unknown>;
};

export function getAdminPasswordRecoveryRedirectUrl(input: RecoveryRedirectInput) {
  return getAdminAuthRedirectUrl("/admin/update-password", input);
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

async function defaultHasActiveAdminMembership(authUserId: string) {
  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  const { data, error } = await supabaseAdmin
    .from("business_admin_memberships")
    .select("id")
    .eq("auth_user_id", authUserId)
    .in("role", ["owner", "admin"])
    .eq("status", "active")
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.length);
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

async function defaultSendEmail(message: AdminRecoveryEmailMessage) {
  const { sendEmail } = await import("@/lib/email/ses");
  return sendEmail(message);
}

async function defaultGetRybManagedEmailSenderConfig() {
  const { getRybManagedEmailSenderConfig } = await import("@/lib/email/tenant-sender");
  return getRybManagedEmailSenderConfig();
}

export async function sendAdminPasswordRecoveryEmail(
  input: SendAdminPasswordRecoveryInput,
  deps: SendAdminPasswordRecoveryDeps = {},
): Promise<SendAdminPasswordRecoveryResult> {
  const redirectTo = getAdminPasswordRecoveryRedirectUrl(input);
  const findAuthUserByEmail = deps.findAuthUserByEmail ?? defaultFindAuthUserByEmail;
  const authUser = await findAuthUserByEmail(input.email);

  if (!authUser?.id) {
    return { status: "skipped", redirectTo };
  }

  const hasActiveAdminMembership = deps.hasActiveAdminMembership ?? defaultHasActiveAdminMembership;
  const hasMembership = await hasActiveAdminMembership(authUser.id);

  if (!hasMembership) {
    return { status: "skipped", redirectTo };
  }

  const getRybManagedEmailSenderConfig =
    deps.getRybManagedEmailSenderConfig ?? defaultGetRybManagedEmailSenderConfig;
  const sender = await getRybManagedEmailSenderConfig();
  if (!sender.senderEmail) {
    throw new Error("RYBS_MANAGED_SES_FROM_EMAIL is required for admin password recovery.");
  }

  const generateRecoveryLink = deps.generateRecoveryLink ?? defaultGenerateRecoveryLink;
  const actionLink = await generateRecoveryLink({
    email: input.email,
    redirectTo,
  });

  if (!actionLink) {
    throw new Error("Password recovery link was not generated.");
  }

  const recoveryEmail = buildAdminPasswordRecoveryEmail({
    businessName: "RYBS Platform",
    resetUrl: actionLink,
  });
  const sendEmail = deps.sendEmail ?? defaultSendEmail;

  await sendEmail({
    to: input.email,
    subject: recoveryEmail.subject,
    text: recoveryEmail.text,
    html: recoveryEmail.html,
    fromEmail: sender.senderEmail,
    fromDisplayName: "RYBS Platform",
    region: sender.sesRegion ?? undefined,
  });

  return {
    status: "sent",
    redirectTo,
  };
}
