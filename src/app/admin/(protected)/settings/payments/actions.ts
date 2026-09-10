"use server";

import { redirect } from "next/navigation";
import { requireAdminOwner } from "@/lib/admin/auth";
import {
  buildSquareOAuthAuthorizationUrl,
  revokeTenantSquareConnectionForAdmin,
  selectTenantSquareLocationForAdmin,
  TenantPaymentProviderConnectionError,
} from "@/lib/payments/tenant-payment-provider-connections";
import { createSquareOAuthStateCookie } from "@/lib/payments/square-oauth-state";

function redirectWithError(code: string) {
  redirect(`/admin/settings/payments?error=${encodeURIComponent(code)}`);
}

function redirectWithSuccess(code: string) {
  redirect(`/admin/settings/payments?success=${encodeURIComponent(code)}`);
}

function getRequiredFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function toPaymentSettingsError(error: unknown) {
  if (error instanceof TenantPaymentProviderConnectionError) return error.code;
  return "SQUARE_CONNECTION_ERROR";
}

export async function startSquareOAuthAction() {
  const adminSession = await requireAdminOwner();
  let authorizationUrl: string | null = null;

  try {
    const state = await createSquareOAuthStateCookie({
      businessId: adminSession.businessId,
      userId: adminSession.userId,
    });
    authorizationUrl = buildSquareOAuthAuthorizationUrl({ state });
  } catch (error) {
    redirectWithError(toPaymentSettingsError(error));
  }

  if (!authorizationUrl) {
    redirectWithError("SQUARE_OAUTH_CONFIGURATION_MISSING");
  }

  redirect(authorizationUrl as string);
}

export async function selectSquareLocationAction(formData: FormData) {
  const adminSession = await requireAdminOwner();
  const connectionId = getRequiredFormString(formData, "connectionId");
  const locationId = getRequiredFormString(formData, "locationId");

  if (!connectionId || !locationId) {
    redirectWithError("SQUARE_LOCATION_SELECTION_REQUIRED");
  }

  try {
    await selectTenantSquareLocationForAdmin({
      businessId: adminSession.businessId,
      connectionId,
      locationId,
    });
  } catch (error) {
    redirectWithError(toPaymentSettingsError(error));
  }

  redirectWithSuccess("square-location-selected");
}

export async function revokeSquareConnectionAction(formData: FormData) {
  const adminSession = await requireAdminOwner();
  const connectionId = getRequiredFormString(formData, "connectionId");
  const confirmed = getRequiredFormString(formData, "confirmRevoke") === "revoke";

  if (!connectionId || !confirmed) {
    redirectWithError("SQUARE_REVOKE_CONFIRMATION_REQUIRED");
  }

  try {
    await revokeTenantSquareConnectionForAdmin({
      businessId: adminSession.businessId,
      connectionId,
    });
  } catch (error) {
    redirectWithError(toPaymentSettingsError(error));
  }

  redirectWithSuccess("square-revoked");
}
