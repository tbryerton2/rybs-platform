"use server";

import { redirect } from "next/navigation";
import {
  createAdminAuthClient,
  setAdminSessionCookiesFromServerAction,
} from "@/lib/admin/auth";
import { normalizeEmail } from "@/lib/customers";

function cleanEmail(value: FormDataEntryValue | null) {
  return normalizeEmail(typeof value === "string" ? value : "");
}

function cleanPassword(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function signInAdminWithPasswordAction(formData: FormData) {
  const email = cleanEmail(formData.get("email"));
  const password = cleanPassword(formData.get("password"));

  if (!email) {
    redirect("/admin/login?error=invalid-email");
  }

  if (!password) {
    redirect(`/admin/login?error=missing-password&email=${encodeURIComponent(email)}`);
  }

  const authClient = createAdminAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    redirect(`/admin/login?error=invalid-credentials&email=${encodeURIComponent(email)}`);
  }

  await setAdminSessionCookiesFromServerAction({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });

  redirect("/admin");
}
