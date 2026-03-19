// src/app/confirm/page.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getDefaultRentalDays } from "@/lib/config";
import { getReorderNotice } from "@/lib/reorder";

type BookingDraft = {
  zip?: string;
  county?: string;
  town?: string;

  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerStreet?: string;
  customerCity?: string;
  customerZip?: string;
  placementPreference?: string | null;
  placementDetails?: string | null;
  accessIssues?: string[];
  gateInstructions?: string | null;
  deliveryPresence?: string | null;
  alternateContactName?: string | null;
  alternateContactPhone?: string | null;
  placementPhotoUrl?: string | null;
  specialDeliveryInstructions?: string | null;

  deliveryDate?: string;

  holdId?: string;
  holdDeliveryDate?: string;
  holdExpiresAt?: string;

  pickupMode?: "unspecified" | "date";
  pickupDate?: string; // YYYY-MM-DD

  // cap fields saved from /book/date
  maxPickupDate?: string; // YYYY-MM-DD
  maxDaysAllowed?: number; // integer
  limitedAck?: boolean; // checkbox on date page
  reorderSourceBookingId?: string;
  reorderSourceBookingShortId?: string;
};

function isYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test((s || "").trim());
}

function addDaysYMD(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatPhoneUS(raw: string) {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return (raw || "").trim() || "—";
}

async function fetchPickupCap(deliveryDate: string) {
  const res = await fetch(`/api/pickup-cap?deliveryDate=${encodeURIComponent(deliveryDate)}`, {
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

function formatDateLong(ymd: string) {
  if (!isYMD(ymd)) return ymd || "—";
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(dt);
}

function getResetPickupDate() {
  if (!isYMD(deliveryDate)) return "";

  // default pickup based on rental length
  const defaultDate = defaultPickupDate;

  // if capped, clamp to max
  if (maxPickupDate && defaultDate > maxPickupDate) {
    return maxPickupDate;
  }

  return defaultDate;
}

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function CardShell({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-300/80 bg-white shadow-md ring-1 ring-slate-200/60 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 bg-slate-50">
        {icon}
        <div className="text-sm font-semibold text-slate-900">{title}</div>
      </div>

      <div className="h-px w-full bg-slate-200/50" />

      <div className="px-5 py-4 bg-white">{children}</div>
    </div>
  );
}

function IconChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200/70">
      {children}
    </span>
  );
}

export default function ConfirmPage() {
  const router = useRouter();

  const [draft, setDraft] = useState<BookingDraft>({});
  const [pickupDate, setPickupDate] = useState<string>("");

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  // gate continue until cap is known (prevents race)
  const [capState, setCapState] = useState<"idle" | "loading" | "ready">("idle");
  const [capProblem, setCapProblem] = useState<string | null>(null);

  const deliveryDate = (draft.deliveryDate || "").trim();
  const deliveryYMD = useMemo(() => (draft.deliveryDate || "").trim(), [draft.deliveryDate]);

  function persist(patch: Partial<BookingDraft>) {
    const raw = sessionStorage.getItem("tcm.booking");
    const existing: BookingDraft = raw ? JSON.parse(raw) : {};
    const next = { ...existing, ...patch };
    sessionStorage.setItem("tcm.booking", JSON.stringify(next));
    setDraft(next);
  }

  // earliest pickup is day after delivery (24h notice)
  const minPickupDate = useMemo(() => {
    if (!isYMD(deliveryDate)) return "";
    return addDaysYMD(deliveryDate, 1);
  }, [deliveryDate]);

  // raw max from draft (cap)
  const maxPickupDateRaw = useMemo(() => {
    const max = (draft.maxPickupDate || "").trim();
    return isYMD(max) ? max : "";
  }, [draft.maxPickupDate]);

  // ✅ effective max only if it makes sense (must be >= min)
  const maxPickupDate = useMemo(() => {
    if (!maxPickupDateRaw) return "";
    if (minPickupDate && maxPickupDateRaw < minPickupDate) return "";
    return maxPickupDateRaw;
  }, [maxPickupDateRaw, minPickupDate]);

  // ✅ detect the “backwards window” scenario and treat it as a DELIVERY problem
  const capIsImpossible = useMemo(() => {
    return !!(maxPickupDateRaw && minPickupDate && maxPickupDateRaw < minPickupDate);
  }, [maxPickupDateRaw, minPickupDate]);

  const minPickupDateLabel = useMemo(() => {
    return minPickupDate ? formatDateLong(minPickupDate) : "—";
  }, [minPickupDate]);

  // initial hydration
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("tcm.booking");
      if (!raw) return;

      const d: BookingDraft = JSON.parse(raw);
      setDraft(d);
      setPickupDate((d.pickupDate || "").trim());

      const dy = (d.deliveryDate || "").trim();
      const hasDelivery = isYMD(dy);
      const hasCap = isYMD((d.maxPickupDate || "").trim());

      setCapState(!hasDelivery ? "ready" : hasCap ? "ready" : "loading");
    } catch {
      // ignore
    }
  }, []);

  // fetch cap if missing
  useEffect(() => {
    if (!isYMD(deliveryYMD)) {
      setCapState("ready");
      setCapProblem(null);
      return;
    }

    // already have some cap info stored (or it’s blank intentionally)
    if (capState === "ready" && (draft.maxPickupDate !== undefined || (draft.maxDaysAllowed ?? 0) !== 0)) {
      setCapProblem(null);
      return;
    }

    // if we already have a valid ymd cap stored, no fetch needed
    if (isYMD((draft.maxPickupDate || "").trim())) {
      setCapState("ready");
      setCapProblem(null);
      return;
    }

    let cancelled = false;
    setCapState("loading");
    setCapProblem(null);

    (async () => {
      try {
        const { res, json } = await fetchPickupCap(deliveryYMD);
        if (cancelled) return;

        if (res.ok && json?.ok && isYMD(json?.maxPickupDate)) {
          persist({
            maxPickupDate: json.maxPickupDate,
            maxDaysAllowed: typeof json.maxDaysAllowed === "number" ? json.maxDaysAllowed : undefined,
          });
        } else {
          persist({ maxPickupDate: undefined, maxDaysAllowed: undefined });
        }

        setCapState("ready");
      } catch {
        if (cancelled) return;
        setCapState("loading");
        setCapProblem("Could not verify availability limits. Please refresh and try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryYMD]);

  // tick timer every 1s
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const holdExpiresAtMs = useMemo(() => {
    const iso = (draft.holdExpiresAt || "").trim();
    if (!iso) return null;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : null;
  }, [draft.holdExpiresAt]);

  const secondsLeft = useMemo(() => {
    if (!holdExpiresAtMs) return null;
    return Math.floor((holdExpiresAtMs - nowMs) / 1000);
  }, [holdExpiresAtMs, nowMs]);

  const holdExpired = useMemo(() => {
    if (secondsLeft == null) return false;
    return secondsLeft <= 0;
  }, [secondsLeft]);

  const defaultRentalDays = useMemo(() => getDefaultRentalDays(), []);
  const defaultPickupDate = useMemo(() => {
    if (!isYMD(deliveryDate)) return "";
    return addDaysYMD(deliveryDate, defaultRentalDays);
  }, [deliveryDate, defaultRentalDays]);

  function savePickupDraft(v: string) {
    persist({
      pickupDate: v || undefined,
      pickupMode: v ? "date" : "unspecified",
    });
  }

  // ✅ pickup validation only uses *effective* max (never the impossible one)
  const pickupOk = useMemo(() => {
    if (capIsImpossible) return false; // delivery not viable
    const pd = (pickupDate || "").trim();
    if (!pd) return !maxPickupDate; // required only when effective max exists
    if (!isYMD(pd)) return false;
    if (minPickupDate && pd < minPickupDate) return false;
    if (maxPickupDate && pd > maxPickupDate) return false;
    return true;
  }, [pickupDate, minPickupDate, maxPickupDate, capIsImpossible]);

  // ✅ pickupError no longer shows the backwards cap message
  const pickupError = useMemo(() => {
    if (capIsImpossible) return null; // handled by capProblem banner below

    const pd = (pickupDate || "").trim();
    if (maxPickupDate && !pd) return "Pickup date is required for this delivery date.";

    if (!pd) return null;
    if (!isYMD(pd)) return "Please select a valid pickup date.";
    if (minPickupDate && pd < minPickupDate) {
      return `Pickup date must be on or after ${formatDateLong(minPickupDate)}.`;
    }
    if (maxPickupDate && pd > maxPickupDate) {
      return `Pickup date must be on or before ${formatDateLong(maxPickupDate)}.`;
    }
    return null;
  }, [pickupDate, minPickupDate, maxPickupDate, capIsImpossible]);

  // ✅ if cap is impossible, show a sane delivery-level error
  const deliveryCapError = useMemo(() => {
    if (!capIsImpossible) return null;
    return `This delivery date isn’t available: the latest allowed pickup (${formatDateLong(
      maxPickupDateRaw
    )}) is before the earliest possible pickup (${formatDateLong(minPickupDate)}). Please choose a different delivery date.`;
  }, [capIsImpossible, maxPickupDateRaw, minPickupDate]);

  function handleContinueToCheckout() {
    setError(null);

    if (!draft.holdId || !draft.holdExpiresAt || holdExpired) {
      setError("Your hold has expired. Please choose a new delivery date.");
      return;
    }

    if (capState !== "ready") {
      setError("Checking availability limits… please wait a moment and try again.");
      return;
    }

    if (capProblem) {
      setError(capProblem);
      return;
    }

    if (deliveryCapError) {
      setError(deliveryCapError);
      return;
    }

    if (!isYMD(deliveryDate)) {
      setError("Please choose a delivery date.");
      return;
    }

    const pd = (pickupDate || "").trim();
    if (maxPickupDate && !pd) {
      setError("Pickup date is required for this delivery date.");
      return;
    }

    if (pd) {
      if (!isYMD(pd)) {
        setError("Please select a valid pickup date.");
        return;
      }
      if (minPickupDate && pd < minPickupDate) {
        setError(`Pickup date must be on or after ${formatDateLong(minPickupDate)}.`);
        return;
      }
      if (maxPickupDate && pd > maxPickupDate) {
        setError(`Pickup date must be on or before ${formatDateLong(maxPickupDate)}.`);
        return;
      }
    }

    if (!pd) {
      persist({
        pickupMode: "unspecified",
        pickupDate: defaultPickupDate || undefined,
      });
    } else {
      persist({
        pickupMode: "date",
        pickupDate: pd,
      });
    }

    router.push("/checkout");
  }

  const ContactIcon = (
    <IconChip>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="7" r="4" />
        <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
      </svg>
    </IconChip>
  );

  const AddressIcon = (
    <IconChip>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    </IconChip>
  );

  const DeliveryIcon = (
    <IconChip>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" />
      </svg>
    </IconChip>
  );

  const PickupIcon = (
    <IconChip>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h11v10H3z" />
        <path d="M14 10h4l3 3v4h-7z" />
        <circle cx="7.5" cy="19" r="1.5" />
        <circle cx="17.5" cy="19" r="1.5" />
      </svg>
    </IconChip>
  );

  const canContinue =
    capState === "ready" &&
    !capProblem &&
    !deliveryCapError &&
    !!draft.holdId &&
    !!draft.holdExpiresAt &&
    !holdExpired &&
    isYMD(deliveryDate) &&
    pickupOk;

  return (
    <main className="bg-gradient-to-b from-[#F8FAFC] to-[#EEF2F7] text-[#0F172A]">
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-6 sm:pb-8">
        <div className="rounded-[32px] bg-white px-10 pb-12 pt-5 sm:px-12 sm:pb-12 sm:pt-8 shadow-xl ring-1 ring-slate-200/70">
          <div className="space-y-3">
            <div className="mx-auto w-full max-w-2xl mb-4">
              <div className="flex flex-col gap-2">
                <div className="inline-flex w-fit items-center rounded-full bg-[#F97316]/10 px-4 py-1 text-xs font-semibold text-[#F97316]">
                  Step 5 of 6
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200/60">
                  <div className="h-2 w-[83.333%] rounded-full bg-[#F97316]" />
                </div>
              </div>
            </div>

            <h1 className="mt-6 text-3xl font-semibold text-[#0F172A]">Confirm Your Booking</h1>
            <p className="text-[#475569]">Review your details. We’ll finalize everything on the next step.</p>
          </div>

          <section className="mt-8 space-y-6 mb-2">
            {draft.reorderSourceBookingId ? (
              <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm leading-6 text-slate-700">
                <div className="font-semibold text-slate-900">New booking based on a previous rental</div>
                <div className="mt-1">{getReorderNotice(draft.reorderSourceBookingShortId)}</div>
              </div>
            ) : null}

            {draft.holdExpiresAt && secondsLeft != null && !holdExpired && (
              <div className="rounded-xl border border-[#FDBA74] bg-[#FFF7ED] px-4 py-3 text-sm text-slate-900">
                <div className="font-semibold">Your delivery date is being held. Time left: {formatMMSS(secondsLeft)}</div>
                <div className="text-slate-700">
                  If this timer hits <span className="font-semibold">00:00</span>, you’ll need to choose a new date.
                </div>
              </div>
            )}

            {capState !== "ready" && isYMD(deliveryDate) && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Checking availability limits…
              </div>
            )}

            {deliveryCapError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                {deliveryCapError}
              </div>
            )}

            {capProblem && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                {capProblem}
              </div>
            )}

            {/* Contact */}
            <div className="space-y-6">
              <CardShell title="Contact" icon={ContactIcon}>
                <div className="grid gap-y-2.5 text-sm">
                  <div className="grid grid-cols-[72px_1fr] items-baseline gap-x-4">
                    <span className="text-slate-500">Name:</span>
                    <span className="font-medium text-slate-900">{(draft.customerName || "").trim() || "—"}</span>
                  </div>

                  <div className="grid grid-cols-[72px_1fr] items-baseline gap-x-4">
                    <span className="text-slate-500">Email:</span>
                    <span className="font-medium text-slate-900 break-all">{(draft.customerEmail || "").trim() || "—"}</span>
                  </div>

                  <div className="grid grid-cols-[72px_1fr] items-baseline gap-x-4">
                    <span className="text-slate-500">Phone:</span>
                    <span className="font-medium text-slate-900 tabular-nums">{formatPhoneUS((draft.customerPhone || "").trim())}</span>
                  </div>
                </div>
              </CardShell>

              <CardShell title="Address" icon={AddressIcon}>
                <div className="text-sm text-slate-700">
                  <div className="font-medium text-slate-900">{(draft.customerStreet || "").trim() || "—"}</div>
                  <div className="mt-1">
                    {(draft.customerCity || "").trim() || "—"}
                    {draft.customerZip ? `, NY ${draft.customerZip}` : ", NY"}
                  </div>
                </div>
              </CardShell>

              <CardShell title="Delivery date" icon={DeliveryIcon}>
                <div className="text-base font-semibold text-slate-900">{formatDateLong(deliveryDate)}</div>
                <div className="mt-1 text-xs text-slate-500">We’ll contact you with the exact delivery time.</div>
              </CardShell>

              <CardShell title={maxPickupDate ? "Pickup date (required)" : "Pickup date (optional)"} icon={PickupIcon}>
                <p className="text-sm text-slate-600">
                  {maxPickupDate ? (
                    <>
                      Pickup must be scheduled between{" "}
                      <span className="font-medium text-slate-700">
                        {formatDateLong(minPickupDate)}
                      </span>{" "}
                      and{" "}
                      <span className="font-medium text-slate-700">
                        {formatDateLong(maxPickupDate)}
                      </span>
                      . Dates outside this window are unavailable.
                    </>
                  ) : (
                    <>
                      You can schedule pickup now, or schedule it later from your confirmation link.{" "}
                      <span className="font-medium text-slate-700">24-hour notice required.</span>
                    </>
                  )}
                </p>

                <div className="mt-5 space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">When do you want pickup?</label>

                    <div className="space-y-2">
                      {!maxPickupDate && (
                        <button
                          type="button"
                          onClick={() => {
                            setPickupDate("");
                            savePickupDraft("");
                            setError(null);
                          }}
                          className={[
                            "w-full rounded-xl border px-4 py-3 text-left transition",
                            !pickupDate ? "border-[#F97316]/40 bg-white shadow-sm" : "border-slate-200 bg-white hover:border-slate-300",
                          ].join(" ")}
                        >
                          <div className="text-sm font-semibold text-slate-900">I’ll schedule pickup later</div>
                          <div className="text-sm text-slate-600">You’ll get a confirmation link where you can request pickup anytime.</div>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (!pickupDate && minPickupDate) {
                            setPickupDate(minPickupDate);
                            savePickupDraft(minPickupDate);
                          }
                          setError(null);
                        }}
                        className={[
                          "w-full rounded-xl border px-4 py-3 text-left transition",
                          !!pickupDate ? "border-[#F97316]/40 bg-white shadow-sm" : "border-slate-200 bg-white hover:border-slate-300",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold text-slate-900">Schedule a pickup date now</div>
                        <div className="text-sm text-slate-600">
                          Earliest pickup: <span className="font-medium text-slate-700">{minPickupDateLabel}</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="text-sm font-medium text-slate-700">Pickup date</label>

                    <div className="mt-2 self-start w-[520px] max-w-full">
                      <input
                        type="date"
                        value={pickupDate}
                        min={minPickupDate}
                        max={maxPickupDate || undefined}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPickupDate(v);
                          savePickupDraft(v);
                          setError(null);
                        }}
                        className={[
                          "block w-full sm:w-[520px] max-w-full",
                          "h-12 rounded-xl border bg-white px-4 text-slate-900 shadow-sm outline-none transition",
                          "leading-[48px] py-0",
                          pickupError
                            ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-200/60"
                            : "border-slate-300 focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/15",
                        ].join(" ")}
                      />

                      <button
                        type="button"
                        onClick={() => {
                          const resetDate = getResetPickupDate();
                          setPickupDate(resetDate);
                          savePickupDraft(resetDate);
                        }}
                        className="mt-2 text-xs text-slate-500 underline hover:text-slate-700"
                      >
                        Reset to recommended date
                      </button>
                    </div>

                    {(pickupDate || maxPickupDate) && (
                    <div className="mt-2 text-xs text-slate-500 space-y-1">
                      <div>
                        Earliest pickup:{" "}
                        <span className="font-medium text-slate-700">
                          {minPickupDateLabel}
                        </span>
                      </div>

                      {maxPickupDate && (
                        <div>
                          Latest allowed pickup:{" "}
                          <span className="font-medium text-slate-700">
                            {formatDateLong(maxPickupDate)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                    {pickupError && <div className="mt-2 text-sm text-red-700">{pickupError}</div>}
                  </div>
                </div>
              </CardShell>
            </div>

            <div className="grid gap-2">
              <button
                type="button"
                disabled={!canContinue}
                onClick={handleContinueToCheckout}
                className="group w-full h-14 rounded-2xl bg-[#F97316] shadow-lg hover:shadow-xl text-white font-semibold text-base shadow-md transition-all duration-200 ease-out hover:bg-[#EA6A10] hover:shadow-lg active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  {capState !== "ready" ? "Checking..." : "Continue to checkout"}
                  <span className="transition-transform group-hover:translate-x-1 text-white/90">→</span>
                </span>
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                {error}
              </div>
            )}

            <a href="/book/date" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              ← Back
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
