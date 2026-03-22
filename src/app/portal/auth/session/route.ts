import { NextResponse } from "next/server";
import { ensureCustomerForEmail, PORTAL_ACCESS_DEACTIVATED_ERROR } from "@/lib/customers";
import {
  createPortalAuthClient,
  devPortalLog,
  PORTAL_ACCESS_TOKEN_COOKIE,
  PORTAL_REFRESH_TOKEN_COOKIE,
} from "@/lib/portal/auth";
import { isPortalSchemaError } from "@/lib/portal/schema";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SessionPayload = {
  tokenHash?: string;
  type?: string | null;
  accessToken?: string;
  refreshToken?: string | null;
};

function badRequest(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as SessionPayload | null;

    if (!body) {
      return badRequest("Portal callback payload was missing.");
    }

    const authClient = createPortalAuthClient();

    let accessToken = body.accessToken?.trim() || "";
    let refreshToken = body.refreshToken?.trim() || "";
    let userEmail = "";
    let userId = "";

    if (body.tokenHash && body.type) {
      devPortalLog("callback_verify_otp_attempt", {
        type: body.type,
        hasTokenHash: true,
      });
      const { data, error } = await authClient.auth.verifyOtp({
        token_hash: body.tokenHash,
        type: body.type as "email" | "magiclink" | "signup" | "recovery" | "invite",
      });

      const verifiedUser = data.user;

      if (error || !data.session || !verifiedUser?.email) {
        return badRequest("This sign-in link is invalid or expired.", 401);
      }

      accessToken = data.session.access_token;
      refreshToken = data.session.refresh_token;
      userEmail = verifiedUser.email;
      userId = verifiedUser.id;
    } else if (accessToken) {
      devPortalLog("callback_access_token_attempt", {
        hasAccessToken: true,
        hasRefreshToken: !!refreshToken,
        type: body.type ?? null,
      });
      const { data, error } = await authClient.auth.getUser(accessToken);

      const authUser = data.user;

      if (error || !authUser?.email) {
        return badRequest("We could not validate your portal session token.", 401);
      }

      userEmail = authUser.email;
      userId = authUser.id;
    } else {
      return badRequest("Portal callback did not include usable session data.");
    }

    let customerId: string | null = null;
    try {
      customerId = await ensureCustomerForEmail(userEmail);
    } catch (error) {
      if (error instanceof Error && error.message === PORTAL_ACCESS_DEACTIVATED_ERROR) {
        return badRequest("Portal access for this account is currently disabled. Please contact support if you need help.", 403);
      }
      throw error;
    }
    if (!customerId) {
      devPortalLog("callback_customer_not_found", {
        email: userEmail,
      });
      return badRequest("We could not match this email to a portal-enabled customer.", 404);
    }

    devPortalLog("callback_customer_matched", {
      email: userEmail,
      customerId,
      authUserId: userId,
    });

    const { error: updateError } = await supabaseAdmin
      .from("customers")
      .update({
        auth_user_id: userId,
        portal_status: "active",
        last_login_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    if (updateError && !isPortalSchemaError(updateError)) {
      return badRequest(`Portal customer session could not be attached: ${updateError.message}`, 500);
    }

    if (updateError) {
      devPortalLog("callback_customer_attach_degraded", {
        email: userEmail,
        customerId,
        message: updateError.message,
      });
    }

    devPortalLog("callback_session_established", {
      email: userEmail,
      customerId,
      hasRefreshToken: !!refreshToken,
    });

    const response = NextResponse.json({ ok: true, redirectTo: "/portal" });

    response.cookies.set(PORTAL_ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    if (refreshToken) {
      response.cookies.set(PORTAL_REFRESH_TOKEN_COOKIE, refreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Portal session setup failed.";
    devPortalLog("callback_session_failed", {
      message,
    });
    return badRequest(message, 500);
  }
}
