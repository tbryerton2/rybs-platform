import { NextResponse, type NextRequest } from "next/server";
import { getCanonicalAdminRedirectUrl } from "@/lib/admin/app-url";

export function proxy(request: NextRequest) {
  const canonicalUrl = getCanonicalAdminRedirectUrl({
    requestUrl: request.url,
    adminAppUrl: process.env.ADMIN_APP_URL,
  });

  if (canonicalUrl) {
    return NextResponse.redirect(canonicalUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-current-pathname", request.nextUrl.pathname);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/platform-admin", "/platform-admin/:path*"],
};
