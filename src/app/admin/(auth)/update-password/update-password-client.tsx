"use client";

import { createClient, type Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type RecoveryState =
  | { status: "checking" }
  | { status: "ready"; session: Session }
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

export function AdminUpdatePasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authClient = useMemo(() => createBrowserAdminAuthClient(), []);
  const [state, setState] = useState<RecoveryState>({ status: "checking" });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRecoverySession() {
      const hashParams = parseHashParams(window.location.hash);
      const errorCode = searchParams.get("error") ?? hashParams.get("error");
      const errorDescription =
        searchParams.get("error_description") ?? hashParams.get("error_description");

      if (errorCode) {
        setState({
          status: "error",
          message: errorDescription || "This password reset link is invalid or expired.",
        });
        return;
      }

      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") ?? hashParams.get("type");
      const code = searchParams.get("code") ?? hashParams.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      try {
        let session: Session | null = null;

        if (tokenHash && type === "recovery") {
          const { data, error } = await authClient.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });

          if (error || !data.session) {
            throw new Error(error?.message || "This password reset link is invalid or expired.");
          }

          session = data.session;
        } else if (code) {
          const { data, error } = await authClient.auth.exchangeCodeForSession(code);

          if (error || !data.session) {
            throw new Error(error?.message || "This password reset link is invalid or expired.");
          }

          session = data.session;
        } else if (accessToken && refreshToken) {
          const { data, error } = await authClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error || !data.session) {
            throw new Error(error?.message || "This password reset link is invalid or expired.");
          }

          session = data.session;
        }

        if (!session) {
          throw new Error("This password reset link is missing recovery session data.");
        }

        if (!cancelled) {
          setState({ status: "ready", session });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "This password reset link could not be verified.",
          });
        }
      }
    }

    void loadRecoverySession();

    return () => {
      cancelled = true;
    };
  }, [authClient, searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (state.status !== "ready") {
      setSubmitError("Your reset session is not ready yet.");
      return;
    }

    if (password.length < 8) {
      setSubmitError("Use at least 8 characters for the new password.");
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError("The password confirmation does not match.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await authClient.auth.updateUser({ password });
    setIsSubmitting(false);

    if (error) {
      setSubmitError(error.message || "We could not update your password.");
      return;
    }

    await authClient.auth.signOut().catch(() => undefined);
    router.replace("/admin/login?success=password-updated");
    router.refresh();
  }

  if (state.status === "checking") {
    return (
      <div className="w-full rounded-[20px] border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          Password recovery
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
          Verifying reset link
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Please wait while we check your secure recovery session.
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="w-full rounded-[20px] border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          Password recovery
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
          Reset link unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{state.message}</p>
        <div className="mt-6">
          <Link href="/admin/forgot-password" className="admin-btn admin-btn-primary">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-[20px] border border-slate-200 bg-white px-6 py-10 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:px-8">
      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
        Password recovery
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
        Set a new password
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Choose a new password for your business-admin account.
      </p>

      {submitError ? (
        <div className="mt-6 rounded-[14px] bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
          {submitError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-7 space-y-5">
        <div>
          <label htmlFor="admin-new-password" className="text-sm font-medium text-slate-700">
            New password
          </label>
          <input
            id="admin-new-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
          />
        </div>

        <div>
          <label htmlFor="admin-confirm-password" className="text-sm font-medium text-slate-700">
            Confirm new password
          </label>
          <input
            id="admin-confirm-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-2 w-full rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
          />
        </div>

        <button type="submit" disabled={isSubmitting} className="admin-btn admin-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
          {isSubmitting ? "Updating password..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
