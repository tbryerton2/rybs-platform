"use client";

import { createClient, type Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { parseAdminInviteBrowserLocation } from "@/lib/admin/invite-acceptance";

type InviteState =
  | { status: "checking" }
  | { status: "ready"; session: Session }
  | { status: "error"; message: string };

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

async function finishAdminSession(session: Session, intendedBusinessId: string | null, firstName: string, lastName: string) {
  const response = await fetch("/admin/auth/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      type: "invite",
      intendedBusinessId,
      firstName,
      lastName,
    }),
  });

  const result = (await response.json().catch(() => null)) as
    | { ok: true; redirectTo: string }
    | { ok: false; error?: string }
    | null;

  if (!response.ok || !result || !("ok" in result) || !result.ok) {
    throw new Error(
      result && "error" in result && result.error
        ? result.error
        : "We could not finish setting up your admin session.",
    );
  }

  return result.redirectTo;
}

export function AdminAcceptInviteClient({
  businessName,
}: {
  businessName?: string | null;
}) {
  const router = useRouter();
  const authClient = useMemo(() => createBrowserAdminAuthClient(), []);
  const [state, setState] = useState<InviteState>({ status: "checking" });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inviteProcessingRef = useRef<Promise<void> | null>(null);

  useLayoutEffect(() => {
    async function loadInviteSession() {
      const invite = parseAdminInviteBrowserLocation({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      });

      window.history.replaceState(window.history.state, "", invite.cleanUrl);

      if (invite.errorCode) {
        setState({
          status: "error",
          message: invite.errorDescription || "This invitation link is invalid or expired.",
        });
        return;
      }

      const { tokenHash, type, code, accessToken, refreshToken } = invite;

      try {
        let session: Session | null = null;

        if (tokenHash && (type === "invite" || type === "magiclink")) {
          const { data, error } = await authClient.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });

          if (error || !data.session) {
            throw new Error(error?.message || "This invitation link is invalid or expired.");
          }

          session = data.session;
        } else if (code) {
          const { data, error } = await authClient.auth.exchangeCodeForSession(code);

          if (error || !data.session) {
            throw new Error(error?.message || "This invitation link is invalid or expired.");
          }

          session = data.session;
        } else if (accessToken && refreshToken) {
          const { data, error } = await authClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error || !data.session) {
            throw new Error(error?.message || "This invitation link is invalid or expired.");
          }

          session = data.session;
        }

        if (!session) {
          throw new Error("This invitation link is missing session data.");
        }

        setFirstName(session.user.user_metadata?.first_name || "");
        setLastName(session.user.user_metadata?.last_name || "");
        setState({ status: "ready", session });
      } catch (error) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "This invitation link could not be verified.",
        });
      }
    }

    inviteProcessingRef.current ??= loadInviteSession();
  }, [authClient, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (state.status !== "ready") {
      setSubmitError("Your invitation session is not ready yet.");
      return;
    }

    if (!firstName.trim() || firstName.trim().length > 120 || !lastName.trim() || lastName.trim().length > 120) {
      setSubmitError("Enter first and last names, each between 1 and 120 characters.");
      return;
    }

    if (password.length < 8) {
      setSubmitError("Use at least 8 characters for the password.");
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError("The password confirmation does not match.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await authClient.auth.updateUser({ password });

    if (error) {
      setIsSubmitting(false);
      setSubmitError(error.message || "We could not set your password.");
      return;
    }

    try {
      const invite = parseAdminInviteBrowserLocation({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: "",
      });
      const redirectTo = await finishAdminSession(state.session, invite.intendedBusinessId, firstName.trim(), lastName.trim());
      router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      setIsSubmitting(false);
      setSubmitError(
        error instanceof Error ? error.message : "We could not finish setting up your admin session.",
      );
    }
  }

  if (state.status === "checking") {
    return (
      <div className="w-full rounded-[20px] border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          Admin invitation
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
          Verifying invite
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Please wait while we check your secure invitation.
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="w-full rounded-[20px] border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          Admin invitation
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
          Invite unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{state.message}</p>
        <div className="mt-6">
          <Link href="/admin/login" className="admin-btn admin-btn-primary">
            Back to admin login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-[20px] border border-slate-200 bg-white px-6 py-10 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:px-8">
      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
        Admin invitation
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
        Set your password
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Choose a password for your {businessName ? `${businessName} ` : ""}business-admin account.
      </p>

      {submitError ? (
        <div className="mt-6 rounded-[14px] bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
          {submitError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-7 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="admin-invite-firstName" className="text-sm font-medium text-slate-700">First name</label>
          <input id="admin-invite-firstName" autoComplete="given-name" required maxLength={120} value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="mt-2 w-full rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400" /></div><div><label htmlFor="admin-invite-lastName" className="text-sm font-medium text-slate-700">Last name</label>
          <input id="admin-invite-lastName" autoComplete="family-name" required maxLength={120} value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="mt-2 w-full rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400" /></div></div>
        <div>
          <label htmlFor="admin-invite-password" className="text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="admin-invite-password"
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
          <label htmlFor="admin-invite-confirm-password" className="text-sm font-medium text-slate-700">
            Confirm password
          </label>
          <input
            id="admin-invite-confirm-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-2 w-full rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="admin-btn admin-btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Opening admin..." : "Set password and enter admin"}
        </button>
      </form>
    </div>
  );
}
