import { createHmac, timingSafeEqual } from "node:crypto";

export const CMS_PREVIEW_COOKIE = "cms_preview";
export const CMS_PREVIEW_TOKEN_TTL_SECONDS = 60;

const ALLOWED_PREVIEW_PATHS = new Set(["/", "/pricing", "/confirm"]);

type CmsPreviewTokenPayload = {
  tenantId: string;
  redirectPath: string;
  expiresAt: number;
};

function getPreviewSigningSecret() {
  const secret = process.env.CMS_PREVIEW_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new Error("CMS_PREVIEW_SECRET or SUPABASE_SERVICE_ROLE_KEY is required for CMS preview.");
  }
  return secret;
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getPreviewSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function normalizeCmsPreviewRedirectPath(value: string | null | undefined) {
  const rawValue = value?.trim() || "/";

  if (!rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return "/";
  }

  let url: URL;
  try {
    url = new URL(rawValue, "https://preview.local");
  } catch {
    return "/";
  }

  if (url.origin !== "https://preview.local" || !ALLOWED_PREVIEW_PATHS.has(url.pathname)) {
    return "/";
  }

  return `${url.pathname}${url.search}`;
}

export function createCmsPreviewToken(input: {
  tenantId: string;
  redirectPath: string;
  now?: number;
}) {
  const payload: CmsPreviewTokenPayload = {
    tenantId: input.tenantId,
    redirectPath: normalizeCmsPreviewRedirectPath(input.redirectPath),
    expiresAt: Math.floor((input.now ?? Date.now()) / 1000) + CMS_PREVIEW_TOKEN_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyCmsPreviewToken(token: string | null | undefined, now = Date.now()) {
  const [encodedPayload, signature, extra] = token?.split(".") ?? [];
  if (!encodedPayload || !signature || extra) return null;

  const expectedSignature = signPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return null;
  }

  let payload: CmsPreviewTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as CmsPreviewTokenPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.tenantId !== "string" ||
    !payload.tenantId.trim() ||
    typeof payload.redirectPath !== "string" ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt < Math.floor(now / 1000)
  ) {
    return null;
  }

  return {
    tenantId: payload.tenantId,
    redirectPath: normalizeCmsPreviewRedirectPath(payload.redirectPath),
  };
}
