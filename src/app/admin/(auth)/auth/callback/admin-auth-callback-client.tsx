"use client";

import { createClient } from "@supabase/supabase-js";
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

function createBrowserAdminAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}

function getCallbackDiagnostics(input: {
  tokenHash: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  type: string | null;
  hash: string;
}) {
  return {
    hasTokenHash: Boolean(input.tokenHash),
    hasAccessToken: Boolean(input.accessToken),
    hasRefreshToken: Boolean(input.refreshToken),
    hasCode: Boolean(input.code),
    hasType: Boolean(input.type),
    hasHash: input.hash.length > 1,
    type: input.type,
  };
}

export function AdminAuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CallbackState>({ status: "processing" });

  useEffect(() => {
    let cancelled = false;

    async function completeAdminSignIn() {
      const hashParams = parseHashParams(window.location.hash);
      const tokenHash = searchParams.get("token_hash");
      const code = searchParams.get("code") ?? hashParams.get("code");
      const type = searchParams.get("type") ?? hashParams.get("type");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const errorCode = searchParams.get("error") ?? hashParams.get("error");
      const errorDescription =
        searchParams.get("error_description") ?? hashParams.get("error_description");

      if (errorCode) {
        setState({
          status: "error",
          message: errorDescription || "Your admin sign-in link could not be verified.",
        });
        return;
      }

      const diagnostics = getCallbackDiagnostics({
        tokenHash,
        accessToken,
        refreshToken,
        code,
        type,
        hash: window.location.hash,
      });

      if (process.env.NODE_ENV === "development") {
        console.info("[admin-auth]", {
          event: "callback_client_received",
          ...diagnostics,
        });
      }

      let payload:
        | { tokenHash: string; type: string }
        | { accessToken: string; refreshToken: string | null; type: string | null }
        | { code: string; type: string | null }
        | null =
        tokenHash && type
          ? { tokenHash, type }
          : accessToken
            ? { accessToken, refreshToken, type }
            : code
              ? { code, type }
              : null;

      if (code && !accessToken) {
        try {
          const authClient = createBrowserAdminAuthClient();
          const { data, error } = await authClient.auth.exchangeCodeForSession(code);

          if (error || !data.session) {
            if (process.env.NODE_ENV === "development") {
              console.info("[admin-auth]", {
                event: "callback_client_code_exchange_failed",
                message: error?.message ?? "No session returned.",
                status: error?.status ?? null,
                code: error?.code ?? null,
              });
            }
          } else {
            payload = {
              accessToken: data.session.access_token,
              refreshToken: data.session.refresh_token,
              type,
            };
          }
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.info("[admin-auth]", {
              event: "callback_client_code_exchange_threw",
              message: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      }

      if (!payload) {
        setState({
          status: "error",
          message:
            "This admin sign-in link is missing session data. Request a new link and make sure the full URL opens in this browser.",
        });
        return;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 15000);
      let response: Response;

      try {
        response = await fetch("/admin/auth/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, diagnostics }),
          signal: controller.signal,
        });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof DOMException && error.name === "AbortError"
                ? "Admin sign-in took too long to finish. Request a new link and try again."
                : "We could not reach the admin session endpoint. Check your connection and request a new link.",
          });
        }
        return;
      } finally {
        window.clearTimeout(timeoutId);
      }

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

      router.replace(result.redirectTo);
      router.refresh();
    }

    void completeAdminSignIn();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="w-full rounded-[20px] border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
        Admin access
      </div>

      {state.status === "processing" ? (
        <>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            Finishing admin sign-in
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            We are validating your secure link and setting up your admin session.
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
              href="/admin/login"
              className="admin-btn admin-btn-primary"
            >
              Back to admin sign-in
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
