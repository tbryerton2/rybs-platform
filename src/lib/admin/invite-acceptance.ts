export const ADMIN_INVITE_BUSINESS_PARAM = "business_id";

export type AdminInviteVerificationType = "invite" | "magiclink";

type AdminInviteBrowserLocation = {
  pathname: string;
  search: string;
  hash: string;
};

function paramsFrom(value: string, prefix: "?" | "#") {
  return new URLSearchParams(value.startsWith(prefix) ? value.slice(1) : value);
}

function verificationType(value: string | null): AdminInviteVerificationType | null {
  return value === "invite" || value === "magiclink" ? value : null;
}

export function buildAdminInviteAcceptanceUrl(input: {
  redirectTo: string;
  businessId: string;
  tokenHash: string;
  type: AdminInviteVerificationType;
}) {
  const url = new URL(input.redirectTo);
  url.search = "";
  url.hash = "";
  url.searchParams.set("token_hash", input.tokenHash);
  url.searchParams.set("type", input.type);
  url.searchParams.set(ADMIN_INVITE_BUSINESS_PARAM, input.businessId);
  return url.toString();
}

export function parseAdminInviteBrowserLocation(location: AdminInviteBrowserLocation) {
  const searchParams = paramsFrom(location.search, "?");
  const hashParams = paramsFrom(location.hash, "#");
  const intendedBusinessId = searchParams.get(ADMIN_INVITE_BUSINESS_PARAM)?.trim() || null;
  const cleanSearch = new URLSearchParams();

  if (intendedBusinessId) {
    cleanSearch.set(ADMIN_INVITE_BUSINESS_PARAM, intendedBusinessId);
  }

  const cleanQuery = cleanSearch.toString();

  return {
    tokenHash: searchParams.get("token_hash"),
    type: verificationType(searchParams.get("type") ?? hashParams.get("type")),
    code: searchParams.get("code") ?? hashParams.get("code"),
    accessToken: hashParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token"),
    errorCode: searchParams.get("error") ?? hashParams.get("error"),
    errorDescription:
      searchParams.get("error_description") ?? hashParams.get("error_description"),
    intendedBusinessId,
    cleanUrl: `${location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}`,
  };
}

export function findInvitedBusiness<T extends { id: string }>(
  businesses: readonly T[],
  intendedBusinessId: string | null | undefined,
) {
  const businessId = intendedBusinessId?.trim();
  if (!businessId) return null;
  return businesses.find((business) => business.id === businessId) ?? null;
}
