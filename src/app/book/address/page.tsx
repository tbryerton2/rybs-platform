// src/app/book/address/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StepHeader } from "@/components/StepHeader";

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
};

type ZipStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "valid"; county: string; town: string }
  | { state: "invalid"; message: string };

function formatPhoneUS(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6)
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function digitsOnly(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 10);
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

  const zipSectionRef = useRef<HTMLDivElement | null>(null);

  const zipFromQuery = useMemo(() => {
    const z = (searchParams.get("zip") || "").replace(/\D/g, "").slice(0, 5);
    return z.length === 5 ? z : "";
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

      const queryZip = zipFromQuery; // 5 digits or ""
      const storedZip = ((existing.zip || existing.customerZip || "") + "")
        .replace(/\D/g, "")
        .slice(0, 5);

      // If we have a zip in the URL, treat this page load as "fresh start"
      // unless it matches the stored zip.
      const urlZipIsDifferent = queryZip && storedZip && storedZip !== queryZip;
      const urlZipExistsButStoredMissing = queryZip && !storedZip;

      if (urlZipIsDifferent || urlZipExistsButStoredMissing) {
        // Fresh session: wipe draft so old fields don't carry over
        sessionStorage.removeItem("tcm.booking");

        setName("");
        setEmail("");
        setStreet("");
        setCity("");
        setZip(queryZip);

        setZipStatus({ state: "idle" });
        setIsEditingZip(false);
        setZipBeforeEdit("");
        return;
      }

      // Otherwise: continuing same flow (or no URL zip)
      if (queryZip) setZip(queryZip);
      else if (storedZip) setZip(storedZip);

      if (existing.customerName) setName(existing.customerName);
      if (existing.customerEmail) setEmail(existing.customerEmail);
      if (existing.customerPhone)
        setPhone(formatPhoneUS(existing.customerPhone));
      if (existing.customerStreet) setStreet(existing.customerStreet);
      if (existing.customerCity) setCity(existing.customerCity);

      if (existing.town && existing.county) {
        setZipStatus({ state: "valid", town: existing.town, county: existing.county });
      }
    } catch {
      // ignore
    }
  }, [zipFromQuery]);


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
        message: "We don’t currently offer online booking for that ZIP. Please enter a supported ZIP to continue.",
      });
      return false;
    }

    // ✅ Merge into booking draft (don’t overwrite other steps)
    const raw = sessionStorage.getItem("tcm.booking");
    const existing: BookingDraft = raw ? JSON.parse(raw) : {};

    sessionStorage.setItem(
      "tcm.booking",
      JSON.stringify({
        ...existing,
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: digitsOnly(phone),
        customerStreet: street.trim(),
        customerCity: city.trim(),
        customerZip: z,
        zip: existing.zip ?? z,
      })
    );

    setZipStatus({ state: "valid", county: json.county, town: json.town });

    return true;
  }

  async function handleSaveZip() {
    const ok = await handleZipCheck();

    if (!ok) {
      // 👇 scroll the focused ZIP panel into view if invalid
      zipSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    // valid → exit edit mode
    setIsEditingZip(false);
  }

  async function handleContinue() {
    // If ZIP not validated yet, validate it now
    if (zipStatus.state !== "valid") {
      const ok = await handleZipCheck();
      if (!ok) return; // show error + stay on page
    }

    const z = zip.replace(/[^\d]/g, "").slice(0, 5);

    const raw = sessionStorage.getItem("tcm.booking");
    const existing: BookingDraft = raw ? JSON.parse(raw) : {};

    sessionStorage.setItem(
      "tcm.booking",
      JSON.stringify({
        ...existing,
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: digitsOnly(phone),
        customerStreet: street.trim(),
        customerCity: city.trim(),
        customerZip: z,
        zip: existing.zip ?? z,
      })
    );

    router.push("/book/date");
  }

  const z = zip.replace(/[^\d]/g, "").slice(0, 5);

  const canContinue =
    !isEditingZip &&
    !!name.trim() &&
    !!email.trim() &&
    !!phone.trim() &&
    !!street.trim() &&
    !!city.trim() &&
    /^\d{5}$/.test(z);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-[#EEF2F7] text-[#0F172A]">
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-16">
        <div className="rounded-[32px] bg-white px-10 pb-12 pt-5 sm:px-12 sm:pb-12 sm:pt-8 shadow-xl ring-1 ring-slate-200/70">
        <div className="space-y-3">
          {/* Step + progress (match input width) */}
          <div className="mx-auto w-full max-w-2xl mb-4">
            <div className="flex flex-col gap-2">
              <div className="inline-flex w-fit items-center rounded-full bg-[#F97316]/10 px-4 py-1 text-xs font-semibold text-[#F97316]">
                Step 1 of 4
              </div>

              <div className="h-2 w-full rounded-full bg-slate-200/60">
                <div className="h-2 w-1/4 rounded-full bg-[#F97316]" />
              </div>
            </div>
          </div>

          <h1 className="mt-6 text-3xl font-semibold text-[#0F172A]">
            Delivery Address
          </h1>

          <p className="text-[#475569]">
            Where should we drop off your dumpster?
          </p>
        </div>

        <section className="mt-8 space-y-6">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="text-sm text-slate-600">
              We currently service <span className="font-semibold text-slate-900">Onondaga</span> and{" "}
              <span className="font-semibold text-slate-900">Madison</span> Counties, NY.
            </div>
          </div>

          <div className="grid gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/15 transition"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., John Doe"
                autoComplete="name"
              />
            </div>

            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/15 transition"
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
                className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/15 transition"
                value={phone}
                onChange={(e) => {
                  const digits = digitsOnly(e.target.value);
                  setPhone(formatPhoneUS(digits));
                }}
                placeholder="e.g., (315) 555-1234"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>

            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Street address
              </label>
              <input
                className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/15 transition"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="e.g., 123 Main St"
                autoComplete="street-address"
              />
            </div>


            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                City
              </label>
              <input
                className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/15 transition"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g., Chittenango"
                autoComplete="address-level2"
              />
            </div>




            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                ZIP code
              </label>

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
                  <div className="rounded-2xl border border-[#FDBA74] bg-[#FFF7ED] p-4 shadow-sm ring-2 ring-[#FDBA74]/40 space-y-3">
                    <input
                      value={zip}
                      onChange={(e) => {
                        setZip(e.target.value);
                        setZipStatus({ state: "idle" });
                      }}
                      className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/15 transition"
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

                    {zipStatus.state === "idle" && (
                      <div className="text-sm text-slate-600">
                        Enter a ZIP, then tap{" "}
                        <span className="font-semibold text-slate-900">Save ZIP</span>.
                      </div>
                    )}

                    {zipStatus.state === "valid" && (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-900">
                        ✅ Service available in{" "}
                        <span className="font-semibold">{zipStatus.town}</span>,{" "}
                        {zipStatus.county} County.
                      </div>
                    )}

                    {zipStatus.state === "invalid" && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                        ❌ We don’t currently offer online booking for that ZIP. Please enter a supported ZIP to continue.
                      </div>
                    )}
                  </div>
                )}

                {!isEditingZip && zipStatus.state === "valid" && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    ✅ Service available in{" "}
                    <span className="font-semibold">{zipStatus.town}</span>,{" "}
                    {zipStatus.county} County.
                  </div>
                )}

                {!isEditingZip && zipStatus.state === "invalid" && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    ❌ We don’t currently offer online booking for that ZIP. Please enter a supported ZIP to continue.
                  </div>
                )}
              </div>
            </div>

            

          

            <div className="grid gap-2">
              <button
                type="button"
                disabled={!canContinue}
                onClick={handleContinue}
                className="group w-full h-14 rounded-2xl bg-[#F97316] text-white font-semibold text-base shadow-md transition-all duration-200 ease-out hover:bg-[#EA6A10] hover:shadow-lg active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  Continue
                  <span className="transition-transform group-hover:translate-x-1 text-white/90">
                    →
                  </span>
                </span>
              </button>

            </div>
          </div>

          <a
            href="/book"
            className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            ← Back
          </a>

        </section>
      </div>
      </div>
    </main>
  );
}