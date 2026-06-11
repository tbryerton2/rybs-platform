import { NextResponse } from "next/server";
import { clearAdminSessionCookies, createAdminAuthClient } from "@/lib/admin/auth";

export async function GET(req: Request) {
  const response = NextResponse.redirect(new URL("/admin/login", req.url));
  const host = req.headers.get("host");

  if (process.env.NODE_ENV !== "production") {
    console.info("[admin-auth-logout]", {
      event: "route_hit",
      pathname: new URL(req.url).pathname,
      hasAccessCookie: req.headers.get("cookie")?.includes("tcm_admin_access_token=") ?? false,
      hasRefreshCookie: req.headers.get("cookie")?.includes("tcm_admin_refresh_token=") ?? false,
    });
  }

  try {
    await createAdminAuthClient().auth.signOut();
  } catch (error) {
    console.error("[admin-auth-logout]", {
      event: "sign_out_failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  clearAdminSessionCookies(response, host);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}
