import { NextResponse } from "next/server";
import {
  createPlatformAdminAuthClient,
  setPlatformAdminSessionCookies,
} from "@/lib/platform-admin/auth";

type SessionPayload = {
  tokenHash?: string;
  type?: string | null;
  accessToken?: string;
  refreshToken?: string | null;
  code?: string;
  diagnostics?: Record<string, unknown>;
};

function badRequest(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function logPlatformAdminAuthSessionError(event: string, details: Record<string, unknown>) {
  console.error("[platform-admin-auth-session]", {
    event,
    ...details,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as SessionPayload | null;

    if (!body) {
      logPlatformAdminAuthSessionError("missing_payload", {});
      return badRequest("Platform admin callback payload was missing.");
    }

    const payloadShape = {
      hasTokenHash: Boolean(body.tokenHash),
      hasAccessToken: Boolean(body.accessToken),
      hasRefreshToken: Boolean(body.refreshToken),
      hasCode: Boolean(body.code),
      hasType: Boolean(body.type),
      diagnostics: body.diagnostics ?? null,
    };

    const authClient = createPlatformAdminAuthClient();
    let accessToken = body.accessToken?.trim() || "";
    let refreshToken = body.refreshToken?.trim() || "";

    if (body.tokenHash && body.type) {
      const { data, error } = await authClient.auth.verifyOtp({
        token_hash: body.tokenHash,
        type: body.type as "email" | "magiclink" | "signup" | "recovery" | "invite",
      });

      if (error || !data.session || !data.user) {
        logPlatformAdminAuthSessionError("verify_otp_failed", {
          ...payloadShape,
          message: error?.message ?? "No session or user returned.",
          status: error?.status ?? null,
          code: error?.code ?? null,
        });
        return badRequest("This platform admin sign-in link is invalid or expired.", 401);
      }

      accessToken = data.session.access_token;
      refreshToken = data.session.refresh_token;
    } else if (body.code) {
      const { data, error } = await authClient.auth.exchangeCodeForSession(body.code);

      if (error || !data.session || !data.user) {
        logPlatformAdminAuthSessionError("code_exchange_failed", {
          ...payloadShape,
          message: error?.message ?? "No session or user returned.",
          status: error?.status ?? null,
          code: error?.code ?? null,
        });
        return badRequest("This platform admin sign-in code is invalid or expired. Request a new link and try again.", 401);
      }

      accessToken = data.session.access_token;
      refreshToken = data.session.refresh_token;
    } else if (accessToken) {
      const { data, error } = await authClient.auth.getUser(accessToken);

      if (error || !data.user) {
        logPlatformAdminAuthSessionError("access_token_validation_failed", {
          ...payloadShape,
          message: error?.message ?? "No user returned.",
          status: error?.status ?? null,
          code: error?.code ?? null,
        });
        return badRequest("We could not validate your platform admin session token.", 401);
      }
    } else {
      logPlatformAdminAuthSessionError("unusable_payload", payloadShape);
      return badRequest("Platform admin callback did not include usable session data.");
    }

    const response = NextResponse.json({ ok: true, redirectTo: "/platform-admin" });
    setPlatformAdminSessionCookies(response, { accessToken, refreshToken });

    return response;
  } catch (error) {
    logPlatformAdminAuthSessionError("unexpected_error", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : null,
    });
    return badRequest("Platform admin session setup failed.", 500);
  }
}
