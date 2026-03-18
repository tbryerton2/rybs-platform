import { NextResponse } from "next/server";
import { PORTAL_ACCESS_TOKEN_COOKIE, PORTAL_REFRESH_TOKEN_COOKIE } from "@/lib/portal/auth";

export async function GET(req: Request) {
  const response = NextResponse.redirect(new URL("/portal/login", req.url));

  response.cookies.set(PORTAL_ACCESS_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });

  response.cookies.set(PORTAL_REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });

  return response;
}
