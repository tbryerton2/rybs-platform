"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ensureCustomerForEmail,
  normalizeEmail,
  PORTAL_ACCESS_DEACTIVATED_ERROR,
} from "@/lib/customers";
import {
  createPortalAuthClient,
  devPortalLog,
  PORTAL_LOGIN_COOLDOWN_SECONDS,
} from "@/lib/portal/auth";

function cleanEmail(value: FormDataEntryValue | null) {
  return normalizeEmail(typeof value === "string" ? value : "");
}

async function getPortalRedirectUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    return `${siteUrl.replace(/\/$/, "")}/portal/auth/callback`;
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol =
    headerStore.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  if (!host) {
    return "http://localhost:3000/portal/auth/callback";
  }

  return `${protocol}://${host}/portal/auth/callback`;
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

  const authClient = createPortalAuthClient();
  const emailRedirectTo = await getPortalRedirectUrl();
  devPortalLog("login_send_attempt", {
    email,
    emailRedirectTo,
    customerFound: !!customerId,
  });
  const { error } = await authClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    devPortalLog("login_send_failed", {
      email,
      emailRedirectTo,
      message: error.message,
      status: error.status,
      code: error.code,
    });

    const message = error.message.toLowerCase();
    const isRateLimited =
      error.status === 429 ||
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

  devPortalLog("login_send_succeeded", {
    email,
    emailRedirectTo,
    firstTimeMayCreateAuthUser: true,
  });

  redirect(
    `/portal/login?sent=1&email=${encodeURIComponent(email)}&cooldown=${PORTAL_LOGIN_COOLDOWN_SECONDS}`,
  );
}
