import { NextResponse } from "next/server";
import {
  CMS_PREVIEW_COOKIE,
  normalizeCmsPreviewRedirectPath,
  verifyCmsPreviewToken,
} from "@/lib/admin/cms-preview";
import { resolvePublicTenantFromRequest } from "@/lib/tenant/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") || "enter").trim();
  const redirectPath = normalizeCmsPreviewRedirectPath(url.searchParams.get("redirect"));
  const redirectUrl = new URL(redirectPath, url.origin);

  if (mode === "exit") {
    redirectUrl.searchParams.delete("preview");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(CMS_PREVIEW_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  const payload = verifyCmsPreviewToken(url.searchParams.get("token"));
  if (!payload) {
    return NextResponse.json({ ok: false, error: "Preview link expired. Open preview from CMS again." }, { status: 401 });
  }

  const tenant = await resolvePublicTenantFromRequest(req);
  if (tenant.id !== payload.tenantId) {
    return NextResponse.json({ ok: false, error: "Preview link does not match this public site." }, { status: 403 });
  }

  const payloadRedirectUrl = new URL(payload.redirectPath, url.origin);
  payloadRedirectUrl.searchParams.set("preview", "1");
  const response = NextResponse.redirect(payloadRedirectUrl);
  response.cookies.set(CMS_PREVIEW_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15,
  });

  return response;
}
