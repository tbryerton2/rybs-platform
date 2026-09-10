import { NextResponse } from "next/server";
import { requireAdminOwner } from "@/lib/admin/auth";
import { consumeSquareOAuthStateCookie } from "@/lib/payments/square-oauth-state";
import {
  exchangeSquareOAuthCode,
  listSquareLocationsForAccessToken,
  persistSquareOAuthConnectionForBusiness,
  TenantPaymentProviderConnectionError,
} from "@/lib/payments/tenant-payment-provider-connections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectToSettings(req: Request, params: Record<string, string>) {
  const url = new URL("/admin/settings/payments", req.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

function toErrorCode(error: unknown) {
  if (error instanceof TenantPaymentProviderConnectionError) return error.code;
  return "SQUARE_CONNECTION_ERROR";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const squareError = url.searchParams.get("error");

  if (squareError) {
    return redirectToSettings(req, { error: "SQUARE_OAUTH_DENIED" });
  }

  if (!code || !state) {
    return redirectToSettings(req, { error: "SQUARE_OAUTH_CALLBACK_INVALID" });
  }

  try {
    const adminSession = await requireAdminOwner();
    const validState = await consumeSquareOAuthStateCookie({
      state,
      businessId: adminSession.businessId,
      userId: adminSession.userId,
    });

    if (!validState) {
      return redirectToSettings(req, { error: "SQUARE_OAUTH_STATE_INVALID" });
    }

    const token = await exchangeSquareOAuthCode({ code });
    const locations = await listSquareLocationsForAccessToken({
      accessToken: token.accessToken,
      environment: token.environment,
    });
    const activeLocations = locations.filter((location) => location.isActive);
    const selectedLocation =
      activeLocations.length === 1 ? activeLocations[0] : locations.length === 1 ? locations[0] : null;

    await persistSquareOAuthConnectionForBusiness({
      businessId: adminSession.businessId,
      connectedBy: adminSession.userId,
      token,
      selectedLocation,
    });

    return redirectToSettings(req, {
      success: selectedLocation ? "square-connected" : "square-connected-select-location",
    });
  } catch (error) {
    return redirectToSettings(req, { error: toErrorCode(error) });
  }
}
