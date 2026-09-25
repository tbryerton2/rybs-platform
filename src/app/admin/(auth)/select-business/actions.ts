"use server";

import { redirect } from "next/navigation";
import {
  getAdminBusinessSelectionContext,
  setAdminSelectedBusinessCookieFromServerAction,
} from "@/lib/admin/auth";

export async function selectAdminBusinessAction(formData: FormData) {
  const businessId = typeof formData.get("businessId") === "string"
    ? String(formData.get("businessId")).trim()
    : "";

  if (!businessId) {
    redirect("/admin/select-business?error=missing-selection");
  }

  const context = await getAdminBusinessSelectionContext();
  const selectedBusiness = context.businesses.find((business) => business.id === businessId);

  if (!selectedBusiness) {
    redirect("/admin/select-business?error=invalid-selection");
  }

  await setAdminSelectedBusinessCookieFromServerAction(selectedBusiness.id);
  redirect("/admin");
}
