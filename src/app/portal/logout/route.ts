import { NextResponse } from "next/server";
import {
  getPortalAccessTokenCookieName,
  getPortalRefreshTokenCookieName,
} from "@/lib/portal/auth";

export async function GET(req: Request) {
  const [accessTokenCookie, refreshTokenCookie] = await Promise.all([
    getPortalAccessTokenCookieName(),
    getPortalRefreshTokenCookieName(),
  ]);
  const response = NextResponse.redirect(new URL("/portal/login", req.url));

  response.cookies.set(accessTokenCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });

  response.cookies.set(refreshTokenCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });

  return response;
}
