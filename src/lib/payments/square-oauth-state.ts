import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const SQUARE_OAUTH_STATE_COOKIE = "rybs_square_oauth_state";
const STATE_TTL_SECONDS = 10 * 60;

type SquareOAuthStateCookie = {
  state: string;
  businessId: string;
  userId: string;
  expiresAt: number;
};

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/admin",
};

function encodeStateCookie(value: SquareOAuthStateCookie) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeStateCookie(value: string | undefined) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<SquareOAuthStateCookie>;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.businessId !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }

    return parsed as SquareOAuthStateCookie;
  } catch {
    return null;
  }
}

export async function createSquareOAuthStateCookie(input: {
  businessId: string;
  userId: string;
}) {
  const state = randomBytes(32).toString("base64url");
  const cookieStore = await cookies();

  cookieStore.set(
    SQUARE_OAUTH_STATE_COOKIE,
    encodeStateCookie({
      state,
      businessId: input.businessId,
      userId: input.userId,
      expiresAt: Date.now() + STATE_TTL_SECONDS * 1000,
    }),
    {
      ...cookieOptions,
      maxAge: STATE_TTL_SECONDS,
    },
  );

  return state;
}

export async function consumeSquareOAuthStateCookie(input: {
  state: string | null;
  businessId: string;
  userId: string;
}) {
  const cookieStore = await cookies();
  const stored = decodeStateCookie(cookieStore.get(SQUARE_OAUTH_STATE_COOKIE)?.value);

  cookieStore.set(SQUARE_OAUTH_STATE_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });

  return Boolean(
    stored &&
      stored.expiresAt >= Date.now() &&
      stored.state === input.state &&
      stored.businessId === input.businessId &&
      stored.userId === input.userId,
  );
}
