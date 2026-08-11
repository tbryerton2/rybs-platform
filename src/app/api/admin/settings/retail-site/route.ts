import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdminOwnerForApi } from "@/lib/admin/auth";
import { saveRetailSiteSettingsForTenant } from "@/lib/tenant/retail-site-settings";

export async function PUT(req: Request) {
  const adminAuth = await requireAdminOwnerForApi();
  if (!adminAuth.ok) return adminAuth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const settings = await saveRetailSiteSettingsForTenant(adminAuth.session.business, body);

    revalidatePath("/", "layout");
    revalidatePath("/");
    revalidatePath("/admin/settings/retail-site");

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Retail site settings could not be saved.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
