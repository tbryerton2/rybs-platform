"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendAdminPasswordRecoveryEmail } from "@/lib/admin/password-recovery";
import { normalizeEmail } from "@/lib/customers";

function cleanEmail(value: FormDataEntryValue | null) {
  return normalizeEmail(typeof value === "string" ? value : "");
}

async function getAdminPasswordRecoveryRequestContext() {
  const headerStore = await headers();

  return {
    adminAppUrl: process.env.ADMIN_APP_URL,
    forwardedHost: headerStore.get("x-forwarded-host"),
    host: headerStore.get("host"),
    forwardedProto: headerStore.get("x-forwarded-proto"),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    nodeEnv: process.env.NODE_ENV,
  };
}

export async function sendAdminPasswordResetAction(formData: FormData) {
  const email = cleanEmail(formData.get("email"));

  if (!email) {
    redirect("/admin/forgot-password?error=invalid-email");
  }

  try {
    await sendAdminPasswordRecoveryEmail({
      email,
      ...(await getAdminPasswordRecoveryRequestContext()),
    });
  } catch (error) {
    console.warn("[admin-password-recovery] reset email failed", {
      email,
      message: error instanceof Error ? error.message : "unknown",
    });
    redirect(`/admin/forgot-password?error=send-failed&email=${encodeURIComponent(email)}`);
  }

  redirect(`/admin/forgot-password?sent=1&email=${encodeURIComponent(email)}`);
}
