/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  reorderSourceBookingId?: string;
  reorderSourceBookingRef?: string | null;
};

type ZipStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "valid"; county: string; town: string }
  | { state: "invalid"; message: string };

function formatPhoneUS(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function digitsOnly(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function inputClass() {
  return "h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/15";
}

export default function AddressStepPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [zipBeforeEdit, setZipBeforeEdit] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [isEditingZip, setIsEditingZip] = useState(false);
  const [zipStatus, setZipStatus] = useState<ZipStatus>({ state: "idle" });
  const [reorderNotice, setReorderNotice] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const zipSectionRef = useRef<HTMLDivElement | null>(null);
  const reorderFromQuery = useMemo(() => (searchParams.get("reorderFrom") || "").trim(), [searchParams]);

  const zipFromQuery = useMemo(() => {
    const value = (searchParams.get("zip") || "").replace(/\D/g, "").slice(0, 5);
    return value.length === 5 ? value : "";
  }, [searchParams]);

  useEffect(() => {
    if (isEditingZip) {
      zipSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isEditingZip]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("tcm.booking");
      const existing: BookingDraft = raw ? JSON.parse(raw) : {};
      const existingReorderSource = String(existing.reorderSourceBookingId ?? "").trim();
      const shouldBootstrapReorder = !!reorderFromQuery && existingReorderSource !== reorderFromQuery;

      const queryZip = zipFromQuery;
      const storedZip = ((existing.zip || existing.customerZip || "") + "").replace(/\D/g, "").slice(0, 5);
      const urlZipIsDifferent = queryZip && storedZip && storedZip !== queryZip;
      const urlZipExistsButStoredMissing = queryZip && !storedZip;

      if (shouldBootstrapReorder) {
        setName("");
        setEmail("");
        setPhone("");
        setStreet("");
        setCity("");
        setZip("");
        setZipStatus({ state: "idle" });
        setIsEditingZip(false);
        setZipBeforeEdit("");
        return;
      }

      if (urlZipIsDifferent || urlZipExistsButStoredMissing) {
        sessionStorage.removeItem("tcm.booking");
        setName("");
        setEmail("");
        setPhone("");
        setStreet("");
        setCity("");
        setZip(queryZip);
        setZipStatus({ state: "idle" });
        setIsEditingZip(false);
        setZipBeforeEdit("");
        return;
      }

      if (queryZip) setZip(queryZip);
      else if (storedZip) setZip(storedZip);

      if (existing.customerName) setName(existing.customerName);
      if (existing.customerEmail) setEmail(existing.customerEmail);
      if (existing.customerPhone) setPhone(formatPhoneUS(existing.customerPhone));
      if (existing.customerStreet) setStreet(existing.customerStreet);
      if (existing.customerCity) setCity(existing.customerCity);
      if (existing.reorderSourceBookingRef) {
        setReorderNotice(getReorderNotice(existing.reorderSourceBookingRef));
      }

      if (existing.reorderSourceBookingId) {
        setZipStatus({ state: "idle" });
      } else if (existing.town && existing.county) {
        setZipStatus({ state: "valid", town: existing.town, county: existing.county });
      }
    } catch {
      // ignore
    }
  }, [reorderFromQuery, zipFromQuery]);

  useEffect(() => {
    if (!reorderFromQuery) return;

    try {
      const raw = sessionStorage.getItem("tcm.booking");
      const existing: BookingDraft = raw ? JSON.parse(raw) : {};

      if (existing.reorderSourceBookingId === reorderFromQuery) {
        setReorderError(null);
        setReorderNotice(getReorderNotice(existing.reorderSourceBookingRef));
        return;
      }
    } catch {
      // ignore
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/portal/reorder-source?bookingId=${encodeURIComponent(reorderFromQuery)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!res.ok || !json?.ok || !json?.draft) {
          setReorderError(
            json?.error || "We couldn’t reuse that past rental. You can still book manually.",
          );
          setReorderNotice(null);
          return;
        }

        const nextDraft = json.draft as BookingDraft;
        sessionStorage.setItem("tcm.booking", JSON.stringify(nextDraft));

        setName(nextDraft.customerName ?? "");
        setEmail(nextDraft.customerEmail ?? "");
        setPhone(formatPhoneUS(nextDraft.customerPhone ?? ""));
        setStreet(nextDraft.customerStreet ?? "");
        setCity(nextDraft.customerCity ?? "");

        const nextZip = ((nextDraft.customerZip || nextDraft.zip || "") + "").replace(/\D/g, "").slice(0, 5);
        setZip(nextZip);
        setZipStatus({ state: "idle" });
        setReorderError(null);
        setReorderNotice(getReorderNotice(nextDraft.reorderSourceBookingRef));
      } catch {
        if (cancelled) return;
        setReorderError("We couldn’t reuse that past rental. You can still book manually.");
        setReorderNotice(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reorderFromQuery]);

  function persistDraft(extra?: Partial<BookingDraft>) {
    const raw = sessionStorage.getItem("tcm.booking");
    const existing: BookingDraft = raw ? JSON.parse(raw) : {};
    const sanitizedZip = zip.replace(/\D/g, "").slice(0, 5);

    sessionStorage.setItem(
      "tcm.booking",
      JSON.stringify({
        ...existing,
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: digitsOnly(phone),
        customerStreet: street.trim(),
        customerCity: city.trim(),
        customerZip: sanitizedZip,
        zip: existing.zip ?? sanitizedZip,
        ...extra,
      }),
    );
  }

  async function handleZipCheck(): Promise<boolean> {
    const z = zip.replace(/[^\d]/g, "").slice(0, 5);

    if (!/^\d{5}$/.test(z)) {
      setZipStatus({ state: "invalid", message: "Enter a valid 5-digit ZIP code." });
      return false;
    }

    setZipStatus({ state: "checking" });

    const res = await fetch(`/api/zip-check?zip=${encodeURIComponent(z)}`);
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setZipStatus({ state: "invalid", message: json?.error || "ZIP check failed." });
      return false;
    }

    if (!json?.serviced) {
      setZipStatus({
        state: "invalid",
        message:
          "We don’t currently offer online booking for that ZIP. Please enter a supported ZIP to continue.",
      });
      return false;
    }

    persistDraft({
      customerZip: z,
      zip: z,
      county: json.county,
      town: json.town,
    });

    setZipStatus({ state: "valid", county: json.county, town: json.town });
    return true;
  }

  async function handleSaveZip() {
    const ok = await handleZipCheck();

    if (!ok) {
      zipSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setIsEditingZip(false);
  }

  async function handleContinue() {
    if (zipStatus.state !== "valid") {
      const ok = await handleZipCheck();
      if (!ok) return;
    }

    persistDraft();
    router.push("/book/placement");
  }

  const normalizedZip = zip.replace(/[^\d]/g, "").slice(0, 5);
  const canContinue =
    !isEditingZip &&
    !!name.trim() &&
    !!email.trim() &&
    !!phone.trim() &&
    !!street.trim() &&
    !!city.trim() &&
    /^\d{5}$/.test(normalizedZip);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-[#EEF2F7] text-[#0F172A]">
      <div className="mx-auto max-w-2xl px-6 pb-16 pt-10">
        <div className="rounded-[32px] bg-white px-10 pb-12 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-12 sm:pb-12 sm:pt-8">
          <div className="space-y-3">
            <div className="mx-auto mb-4 w-full max-w-2xl">
              <div className="flex flex-col gap-2">
                <div className="inline-flex w-fit items-center rounded-full bg-[#F97316]/10 px-4 py-1 text-xs font-semibold text-[#F97316]">
                  Step 2 of 6
                </div>

                <div className="h-2 w-full rounded-full bg-slate-200/60">
                  <div className="h-2 w-[33.333%] rounded-full bg-[#F97316]" />
                </div>
              </div>
            </div>

            <h1 className="mt-6 text-3xl font-semibold text-[#0F172A]">Delivery Address</h1>
            <p className="text-[#475569]">Add your contact info and service address to get started.</p>
          </div>

          <section className="mt-8 space-y-6">
            {reorderNotice ? (
              <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-4 text-sm leading-6 text-slate-700">
                <div className="font-semibold text-slate-900">Booking from a previous rental</div>
                <div className="mt-1">{reorderNotice}</div>
              </div>
            ) : null}

            {reorderError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
                {reorderError}
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-600">
                We currently service <span className="font-semibold text-slate-900">Onondaga</span> and{" "}
                <span className="font-semibold text-slate-900">Madison</span> Counties, NY.
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-slate-900">Contact & address</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  This is where we will deliver the dumpster and how we will contact you about the job.
                </p>
              </div>

              <div className="grid gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Name</label>
                  <input
                    className={inputClass()}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., John Doe"
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <input
                    className={inputClass()}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g., you@email.com"
                    type="email"
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Phone</label>
                  <input
                    className={inputClass()}
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneUS(digitsOnly(e.target.value)))}
                    placeholder="e.g., (315) 555-1234"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Street address</label>
                  <input
                    className={inputClass()}
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="e.g., 123 Main St"
                    autoComplete="street-address"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">City</label>
                  <input
                    className={inputClass()}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g., Chittenango"
                    autoComplete="address-level2"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">ZIP code</label>

                  <div ref={zipSectionRef} className="space-y-3">
                    {!isEditingZip ? (
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="text-sm text-slate-700">
                          <span className="text-slate-500">ZIP:</span>{" "}
                          <span className="font-semibold text-slate-900">{zip || "—"}</span>
                        </div>

                        <button
                          type="button"
                          className="text-sm font-semibold text-[#F97316] hover:underline"
                          onClick={() => {
                            setZipBeforeEdit(zip);
                            setIsEditingZip(true);
                            setZipStatus({ state: "idle" });
                          }}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 rounded-2xl border border-[#FDBA74] bg-[#FFF7ED] p-4 shadow-sm ring-2 ring-[#FDBA74]/40">
                        <input
                          value={zip}
                          onChange={(e) => {
                            setZip(e.target.value);
                            setZipStatus({ state: "idle" });
                          }}
                          className={inputClass()}
                          placeholder="e.g., 13202"
                          inputMode="numeric"
                          autoComplete="postal-code"
                        />

                        <div className="flex items-center gap-4 text-sm">
                          <button
                            type="button"
                            className="text-slate-600 hover:text-slate-900 hover:underline"
                            onClick={() => {
                              setZip(zipBeforeEdit);
                              setIsEditingZip(false);
                              setZipStatus({ state: "idle" });
                            }}
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            className="font-semibold text-[#F97316] hover:underline"
                            onClick={handleSaveZip}
                            disabled={zipStatus.state === "checking"}
                          >
                            {zipStatus.state === "checking" ? "Checking..." : "Save ZIP"}
                          </button>
                        </div>

                        {zipStatus.state === "idle" ? (
                          <div className="text-sm text-slate-600">
                            Enter a ZIP, then tap <span className="font-semibold text-slate-900">Save ZIP</span>.
                          </div>
                        ) : null}

                        {zipStatus.state === "valid" ? (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                            Service available in <span className="font-semibold">{zipStatus.town}</span>,{" "}
                            {zipStatus.county} County.
                          </div>
                        ) : null}

                        {zipStatus.state === "invalid" ? (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                            {zipStatus.message}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {!isEditingZip && zipStatus.state === "valid" ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                        Service available in <span className="font-semibold">{zipStatus.town}</span>,{" "}
                        {zipStatus.county} County.
                      </div>
                    ) : null}

                    {!isEditingZip && zipStatus.state === "invalid" ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                        {zipStatus.message}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <button
                type="button"
                disabled={!canContinue}
                onClick={handleContinue}
                className="group h-14 w-full rounded-2xl bg-[#F97316] text-base font-semibold text-white shadow-md transition-all duration-200 ease-out hover:bg-[#EA6A10] hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex items-center justify-center gap-2">
                  Continue
                  <span className="text-white/90 transition-transform group-hover:translate-x-1">→</span>
                </span>
              </button>
            </div>

            <a href="/book" className="text-sm text-slate-600 transition-colors hover:text-slate-900">
              ← Back
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
