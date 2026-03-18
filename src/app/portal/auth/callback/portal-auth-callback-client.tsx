"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type CallbackState =
  | { status: "processing" }
  | { status: "error"; message: string };

function parseHashParams(hash: string) {
  const cleaned = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(cleaned);
}

export function PortalAuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CallbackState>({ status: "processing" });

  useEffect(() => {
    let cancelled = false;

    async function completePortalSignIn() {
      const hashParams = parseHashParams(window.location.hash);
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") ?? hashParams.get("type");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const errorCode = searchParams.get("error") ?? hashParams.get("error");
      const errorDescription =
        searchParams.get("error_description") ?? hashParams.get("error_description");

      if (errorCode) {
        setState({
          status: "error",
          message: errorDescription || "Your sign-in link could not be verified.",
        });
        return;
      }

      const payload =
        tokenHash && type
          ? { tokenHash, type }
          : accessToken
            ? { accessToken, refreshToken, type }
            : null;

      if (process.env.NODE_ENV === "development") {
        console.info("[portal-auth]", {
          event: "callback_client_received",
          hasTokenHash: !!tokenHash,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type: type ?? null,
          errorCode: errorCode ?? null,
        });
      }

      if (!payload) {
        setState({
          status: "error",
          message: "This sign-in link is missing required portal session data.",
        });
        return;
      }

      const response = await fetch("/portal/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as
        | { ok: true; redirectTo: string }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !result || !("ok" in result) || !result.ok) {
        const message =
          result && "error" in result && result.error
            ? result.error
            : "We could not finish signing you in.";

        if (!cancelled) {
          setState({ status: "error", message });
        }
        return;
      }

      if (process.env.NODE_ENV === "development") {
        console.info("[portal-auth]", {
          event: "callback_client_success",
          redirectTo: result.redirectTo,
        });
      }

      router.replace(result.redirectTo);
      router.refresh();
    }

    void completePortalSignIn();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="w-full rounded-[32px] border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
        Portal sign-in
      </div>

      {state.status === "processing" ? (
        <>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            Finishing sign-in
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            We are validating your secure link and setting up your portal session. If this is
            your first portal sign-in, we are also activating your access now.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            We could not complete sign-in
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">{state.message}</p>
          <div className="mt-6">
            <Link
              href="/portal/login"
              className="inline-flex items-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Back to portal login
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
