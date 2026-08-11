"use server";

import { redirect } from "next/navigation";
import {
  createPlatformAdminAuthClient,
  setPlatformAdminSessionCookiesFromServerAction,
} from "@/lib/platform-admin/auth";
import { normalizeEmail } from "@/lib/identity";

function cleanEmail(value: FormDataEntryValue | null) {
  return normalizeEmail(typeof value === "string" ? value : "");
}

function cleanPassword(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function signInPlatformAdminWithPasswordAction(formData: FormData) {
  const email = cleanEmail(formData.get("email"));
  const password = cleanPassword(formData.get("password"));

  if (!email) {
    redirect("/platform-admin/login?error=invalid-email");
  }

  if (!password) {
    redirect(`/platform-admin/login?error=missing-password&email=${encodeURIComponent(email)}`);
  }

  const authClient = createPlatformAdminAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    redirect(`/platform-admin/login?error=invalid-credentials&email=${encodeURIComponent(email)}`);
  }

  await setPlatformAdminSessionCookiesFromServerAction({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });

  redirect("/platform-admin");
}
