const ADMIN_SURFACE_PATHS = ["/admin", "/platform-admin"] as const;

function isHttpProtocol(protocol: string) {
  return protocol === "http:" || protocol === "https:";
}

export function normalizeAdminAppOrigin(value: string | null | undefined) {
  const configuredValue = value?.trim();
  if (!configuredValue) return null;

  let url: URL;
  try {
    url = new URL(configuredValue);
  } catch {
    throw new Error("ADMIN_APP_URL must be a valid absolute URL.");
  }

  if (!isHttpProtocol(url.protocol) || url.username || url.password) {
    throw new Error("ADMIN_APP_URL must use http or https and cannot include credentials.");
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("ADMIN_APP_URL must contain only an origin, without a path, query, or hash.");
  }

  return url.origin;
}

export function isAdminSurfacePath(pathname: string) {
  return ADMIN_SURFACE_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getCanonicalAdminRedirectUrl(input: {
  requestUrl: string | URL;
  adminAppUrl?: string | null;
}) {
  const adminOrigin = normalizeAdminAppOrigin(input.adminAppUrl);
  if (!adminOrigin) return null;

  const requestUrl = new URL(input.requestUrl);
  if (!isAdminSurfacePath(requestUrl.pathname) || requestUrl.origin === adminOrigin) {
    return null;
  }

  return new URL(`${requestUrl.pathname}${requestUrl.search}`, adminOrigin);
}
