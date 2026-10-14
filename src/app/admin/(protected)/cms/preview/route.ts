import { NextResponse } from "next/server";
import { requireAdminOwnerForApi } from "@/lib/admin/auth";
import {
  createCmsPreviewToken,
  normalizeCmsPreviewRedirectPath,
} from "@/lib/admin/cms-preview";
import { getTenantPublicBaseUrl } from "@/lib/tenant/communications";

export async function GET(req: Request) {
  const adminAuth = await requireAdminOwnerForApi();
  if (!adminAuth.ok) return adminAuth.response;

  const url = new URL(req.url);
  const redirectPath = normalizeCmsPreviewRedirectPath(url.searchParams.get("redirect"));
  const mode = (url.searchParams.get("mode") || "enter").trim();
  const publicBaseUrl = await getTenantPublicBaseUrl(adminAuth.session.business);

  if (!publicBaseUrl) {
    return NextResponse.json(
      { ok: false, error: "This business does not have an active public domain for preview." },
      { status: 409 },
    );
  }

  const previewUrl = new URL("/cms-preview", publicBaseUrl);
  previewUrl.searchParams.set("redirect", redirectPath);

  if (mode === "exit") {
    previewUrl.searchParams.set("mode", "exit");
    return NextResponse.redirect(previewUrl);
  }

  previewUrl.searchParams.set(
    "token",
    createCmsPreviewToken({
      tenantId: adminAuth.session.business.id,
      redirectPath,
    }),
  );
  return NextResponse.redirect(previewUrl);
}
