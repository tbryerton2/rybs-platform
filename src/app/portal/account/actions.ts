"use server";

import { redirect } from "next/navigation";
import { clearPortalSessionCookies, deactivatePortalAccess, requirePortalCustomer } from "@/lib/portal/auth";

export async function deactivatePortalAccountAction() {
  const customer = await requirePortalCustomer();
  await deactivatePortalAccess(customer.id, "Customer closed portal access");
  await clearPortalSessionCookies();
  redirect("/portal/login?closed=1");
}
