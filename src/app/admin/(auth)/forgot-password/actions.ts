"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminAuthClient } from "@/lib/admin/auth";
import { normalizeEmail } from "@/lib/customers";

function cleanEmail(value: FormDataEntryValue | null) {
  return normalizeEmail(typeof value === "string" ? value : "");
}

function normalizeProtocol(value: string | null) {
  const protocol = String(value ?? "").split(",")[0]?.trim().toLowerCase();
  return protocol === "https" || protocol === "http" ? protocol : null;
}

async function getAdminPasswordRecoveryRedirectUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    return new URL("/admin/update-password", siteUrl).toString();
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol =
    normalizeProtocol(headerStore.get("x-forwarded-proto")) ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  if (!host) {
    return "http://localhost:3000/admin/update-password";
  }

  return new URL("/admin/update-password", `${protocol}://${host}`).toString();
}

export async function sendAdminPasswordResetAction(formData: FormData) {
  const email = cleanEmail(formData.get("email"));

  if (!email) {
    redirect("/admin/forgot-password?error=invalid-email");
  }

  const authClient = createAdminAuthClient();
  const redirectTo = await getAdminPasswordRecoveryRedirectUrl();
  const { error } = await authClient.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    redirect(`/admin/forgot-password?error=send-failed&email=${encodeURIComponent(email)}`);
  }

  redirect(`/admin/forgot-password?sent=1&email=${encodeURIComponent(email)}`);
}
