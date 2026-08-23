"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { buildPortalLoginEmail } from "@/lib/email/templates/portal-login";
import { sendEmail } from "@/lib/email/ses";
import { resolveTenantEmailSender, tenantSenderSendEmailOptions } from "@/lib/email/tenant-sender";
import {
  ensureCustomerForEmail,
  normalizeEmail,
  PORTAL_ACCESS_DEACTIVATED_ERROR,
} from "@/lib/customers";
import {
  devPortalLog,
  PORTAL_LOGIN_COOLDOWN_SECONDS,
} from "@/lib/portal/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantCommunicationSettings } from "@/lib/tenant/communications";
import { getCurrentTenant, type TenantRecord } from "@/lib/tenant/server";

function cleanEmail(value: FormDataEntryValue | null) {
  return normalizeEmail(typeof value === "string" ? value : "");
}

async function getPortalRequestContext() {
  const headerStore = await headers();

  return {
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    protocol:
      headerStore.get("x-forwarded-proto") ??
      (process.env.NODE_ENV === "production" ? "https" : "http"),
  };
}

async function getPortalRedirectUrl(
  tenant: TenantRecord,
  requestContext: Awaited<ReturnType<typeof getPortalRequestContext>>,
) {
  const communication = await getTenantCommunicationSettings(tenant, requestContext);
  const baseUrl = communication.publicBaseUrl;

  if (!baseUrl) {
    throw new Error("No active portal domain is configured for this business.");
  }

  return {
    communication,
    emailRedirectTo: `${baseUrl}/portal/auth/callback`,
  };
}

export async function sendPortalLoginLinkAction(formData: FormData) {
  const email = cleanEmail(formData.get("email"));

  if (!email) {
    redirect("/portal/login?error=invalid-email");
  }

  let customerId: string | null = null;

  try {
    customerId = await ensureCustomerForEmail(email);
  } catch (error) {
    if (error instanceof Error && error.message === PORTAL_ACCESS_DEACTIVATED_ERROR) {
      redirect(`/portal/login?error=deactivated&email=${encodeURIComponent(email)}`);
    }
    devPortalLog("login_lookup_failed", {
      email,
      message: error instanceof Error ? error.message : "unknown",
    });
    redirect("/portal/login?error=lookup-failed");
  }

  if (!customerId) {
    redirect("/portal/login?error=not-found");
  }

  const tenant = await getCurrentTenant();
  const requestContext = await getPortalRequestContext();
  const { communication, emailRedirectTo } = await getPortalRedirectUrl(tenant, requestContext);
  devPortalLog("login_send_attempt", {
    email,
    emailRedirectTo,
    customerFound: !!customerId,
  });

  let linkResult = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: emailRedirectTo,
    },
  });

  if (
    linkResult.error &&
    linkResult.error.message.toLowerCase().includes("user") &&
    linkResult.error.message.toLowerCase().includes("not")
  ) {
    const createUserResult = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: `${randomUUID()}${randomUUID()}`,
    });

    if (createUserResult.error) {
      linkResult = {
        data: { properties: null, user: null },
        error: createUserResult.error,
      };
    } else {
      linkResult = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: emailRedirectTo,
        },
      });
    }
  }

  const { data, error } = linkResult;
  const actionLink = data?.properties?.action_link;

  if (error || !actionLink) {
    devPortalLog("login_send_failed", {
      email,
      emailRedirectTo,
      message: error?.message ?? "Magic link was not generated.",
      status: error?.status,
      code: error?.code,
    });

    const message = error?.message.toLowerCase() ?? "";
    const isRateLimited =
      error?.status === 429 ||
      message.includes("rate") ||
      message.includes("too many") ||
      message.includes("security purposes");

    if (isRateLimited) {
      redirect(
        `/portal/login?error=rate-limited&email=${encodeURIComponent(email)}&cooldown=${PORTAL_LOGIN_COOLDOWN_SECONDS}`,
      );
    }

    redirect(`/portal/login?error=send-failed&email=${encodeURIComponent(email)}`);
  }

  const portalEmail = buildPortalLoginEmail({
    businessName: communication.businessName,
    loginUrl: actionLink,
    supportEmail: communication.supportEmail,
    supportPhone: communication.supportPhone,
  });

  try {
    const sender = await resolveTenantEmailSender({
      tenant,
      businessName: communication.businessName,
      supportEmail: communication.supportEmail,
    });

    await sendEmail({
      to: email,
      subject: portalEmail.subject,
      text: portalEmail.text,
      html: portalEmail.html,
      ...tenantSenderSendEmailOptions(sender),
    });
  } catch (error) {
    devPortalLog("login_email_send_failed", {
      email,
      emailRedirectTo,
      message: error instanceof Error ? error.message : "unknown",
    });
    redirect(`/portal/login?error=send-failed&email=${encodeURIComponent(email)}`);
  }

  devPortalLog("login_send_succeeded", {
    email,
    emailRedirectTo,
    firstTimeMayCreateAuthUser: false,
  });

  redirect(
    `/portal/login?sent=1&email=${encodeURIComponent(email)}&cooldown=${PORTAL_LOGIN_COOLDOWN_SECONDS}`,
  );
}
