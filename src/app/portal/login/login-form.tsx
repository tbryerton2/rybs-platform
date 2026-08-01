"use client";

import { useEffect, useMemo, useState } from "react";
import { getTenantStorageKey, TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";

function getCooldownStorageKey() {
  return getTenantStorageKey(TENANT_STORAGE_KEYS.portalLoginCooldownUntil);
}

function readStoredCooldown() {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(getCooldownStorageKey());
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

function persistCooldown(until: number) {
  if (typeof window === "undefined") return;
  if (until > Date.now()) {
    window.localStorage.setItem(getCooldownStorageKey(), String(until));
    return;
  }
  window.localStorage.removeItem(getCooldownStorageKey());
}

export function PortalLoginForm({
  action,
  initialEmail,
  initialCooldownSeconds,
  blocked,
  mode = "default",
}: {
  action: (formData: FormData) => void | Promise<void>;
  initialEmail?: string;
  initialCooldownSeconds?: number;
  blocked?: boolean;
  mode?: "default" | "resend";
}) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [cooldownUntil] = useState(() => {
    const fromStorage = readStoredCooldown();
    const fromServer =
      initialCooldownSeconds && initialCooldownSeconds > 0
        ? Date.now() + initialCooldownSeconds * 1000
        : 0;

    const next = Math.max(fromStorage, fromServer);
    persistCooldown(next);
    return next;
  });
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)),
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      const nextRemaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setSecondsRemaining(nextRemaining);

      if (nextRemaining === 0) {
        persistCooldown(0);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

  const inCooldown = secondsRemaining > 0;
  const isDisabled = blocked || inCooldown;
  const isResend = mode === "resend";
  const helperText = useMemo(() => {
    if (blocked) {
      return "Portal access is disabled for this account, so a secure access link cannot be sent.";
    }

    if (isResend) {
      return inCooldown
        ? `You can request another link in ${secondsRemaining} seconds.`
        : "You can request another link now.";
    }

    if (!inCooldown) {
      return "Use the same email you booked with. We will send a one-tap magic link for portal access.";
    }

    return `To prevent spam and Supabase rate-limit issues, you can request another link in ${secondsRemaining}s.`;
  }, [blocked, inCooldown, isResend, secondsRemaining]);

  if (isResend) {
    return (
      <form action={action} className="mt-8">
        <input name="email" type="hidden" value={email} />
        <p className="text-xs leading-5 text-slate-500">{helperText}</p>

        {!inCooldown ? (
          <button
            type="submit"
            disabled={blocked}
            className={[
              "mt-4 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition",
              blocked
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "border border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50",
            ].join(" ")}
          >
            {blocked ? "Portal access disabled" : "Send another link"}
          </button>
        ) : null}
      </form>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
        />
        <p className="mt-2 text-xs leading-5 text-slate-500">{helperText}</p>
      </div>

      <button
        type="submit"
        disabled={isDisabled}
        className={[
          "inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white transition",
          isDisabled
            ? "cursor-not-allowed bg-slate-300"
            : "bg-[#F97316] hover:bg-orange-600",
        ].join(" ")}
      >
        {blocked ? "Portal access disabled" : inCooldown ? `Try again in ${secondsRemaining}s` : "Send secure sign-in link"}
      </button>
    </form>
  );
}
