import { NextResponse } from "next/server";
import {
  clearPlatformAdminSessionCookies,
  createPlatformAdminAuthClient,
} from "@/lib/platform-admin/auth";

export async function GET(req: Request) {
  try {
    await createPlatformAdminAuthClient().auth.signOut();
  } catch (error) {
    console.error("[platform-admin-auth-logout]", {
      event: "sign_out_failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  const response = NextResponse.redirect(new URL("/platform-admin/login", req.url));
  clearPlatformAdminSessionCookies(response, req.headers.get("host"));

  return response;
}
