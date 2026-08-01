"use client";

import { useEffect, useMemo, useState } from "react";

function formatMMSS(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutesLabel = String(Math.floor(seconds / 60));
  const secondsLabel = String(seconds % 60).padStart(2, "0");
  return `${minutesLabel}:${secondsLabel}`;
}

const DEFAULT_HOLD_TITLE_TEMPLATE = "{time} left to complete your booking";
const DEFAULT_HOLD_BODY = "We're holding your dumpster while you finish your booking.";

export function useBookingHoldCountdown(holdExpiresAt?: string | null) {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const holdExpiresAtMs = useMemo(() => {
    const iso = (holdExpiresAt || "").trim();
    if (!iso) return null;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : null;
  }, [holdExpiresAt]);

  useEffect(() => {
    if (!holdExpiresAtMs) return;

    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [holdExpiresAtMs]);

  const secondsLeft = useMemo(() => {
    if (!holdExpiresAtMs) return null;
    return Math.floor((holdExpiresAtMs - nowMs) / 1000);
  }, [holdExpiresAtMs, nowMs]);

  return {
    secondsLeft,
    holdExpired: secondsLeft != null && secondsLeft <= 0,
    hasHoldExpiration: holdExpiresAtMs != null,
    formattedTime: secondsLeft == null ? null : formatMMSS(secondsLeft),
  };
}

export function HoldCountdownBanner({
  formattedTime,
  titleTemplate = DEFAULT_HOLD_TITLE_TEMPLATE,
  body = DEFAULT_HOLD_BODY,
}: {
  formattedTime?: string | null;
  titleTemplate?: string;
  body?: string;
}) {
  if (!formattedTime) return null;

  return (
    <div className="rounded-xl border border-[#FDBA74] bg-[#FFF7ED] px-4 py-3 text-sm text-slate-900">
      <div className="font-semibold">{titleTemplate.replace("{time}", formattedTime)}</div>
      <div className="text-slate-700">{body}</div>
    </div>
  );
}
