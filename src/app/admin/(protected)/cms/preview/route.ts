import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectPath = (url.searchParams.get("redirect") || "/").trim() || "/";
  const mode = (url.searchParams.get("mode") || "enter").trim();
  const redirectUrl = new URL(redirectPath, url.origin);

  if (mode === "exit") {
    redirectUrl.searchParams.delete("preview");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set("cms_preview", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  redirectUrl.searchParams.set("preview", "1");
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set("cms_preview", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });

  return response;
}
