/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { BookingPriceQuote } from "@/lib/booking-pricing";
import { getReorderNotice } from "@/lib/reorder";
import { getTenantStorageKey, TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";
import type { SavedServiceLocation } from "@/lib/service-locations";

type BookingDraft = {
  zip?: string;
  county?: string;
  town?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerStreet?: string;
  customerCity?: string;
  customerState?: string;
  customerZip?: string;
  priceQuote?: BookingPriceQuote | null;
  reorderSourceBookingId?: string;
  reorderSourceBookingRef?: string | null;
  selectedServiceLocationId?: string | null;
};

type ZipStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "valid"; county: string; town: string }
  | { state: "invalid"; message: string };

type PortalCustomerSnapshot = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  primaryStreet?: string | null;
  primaryCity?: string | null;
  primaryState?: string | null;
  primaryZip?: string | null;
};

function formatPhoneUS(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function digitsOnly(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function formatSummaryValue(value: string, fallback = "Not provided yet") {
  const trimmed = value.trim();
  return trimmed || fallback;
}

function inputClass() {
  return "h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/15";
}

function getBookingStorageKey() {
  return getTenantStorageKey(TENANT_STORAGE_KEYS.booking);
}

type AddressStepPageClientProps = {
  content: {
    title: string;
    description: string;
    serviceAreaNotice: string;
    savedLocationsTitle: string;
    savedLocationsDescription: string;
    savedLocationsManageLabel: string;
    bookingDetailsTitle: string;
    bookingDetailsDescription: string;
    savedLocationIntro: string;
    savedLocationFootnote: string;
    zipIdleHelper: string;
    zipValidTemplate: string;
    unsupportedZipMessage: string;
  };
};

function formatTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, value),
    template,
  );
}

export default function AddressStepPageClient({ content }: AddressStepPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [zipBeforeEdit, setZipBeforeEdit] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [zip, setZip] = useState("");
  const [isEditingZip, setIsEditingZip] = useState(false);
  const [zipStatus, setZipStatus] = useState<ZipStatus>({ state: "idle" });
  const [reorderNotice, setReorderNotice] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [savedLocations, setSavedLocations] = useState<SavedServiceLocation[]>([]);
  const [savedLocationsReady, setSavedLocationsReady] = useState(false);
  const [savedLocationsError, setSavedLocationsError] = useState<string | null>(null);
  const [selectedSavedLocationId, setSelectedSavedLocationId] = useState<string | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
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
      const raw = sessionStorage.getItem(getBookingStorageKey());
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
        setStateCode("");
        setZip("");
        setZipStatus({ state: "idle" });
        setIsEditingZip(false);
        setZipBeforeEdit("");
        setSelectedSavedLocationId(null);
        return;
      }

      if (urlZipIsDifferent || urlZipExistsButStoredMissing) {
        sessionStorage.removeItem(getBookingStorageKey());
        setName("");
        setEmail("");
        setPhone("");
        setStreet("");
        setCity("");
        setStateCode("");
        setZip(queryZip);
        setZipStatus({ state: "idle" });
        setIsEditingZip(false);
        setZipBeforeEdit("");
        setSelectedSavedLocationId(null);
        return;
      }

      if (queryZip) setZip(queryZip);
      else if (storedZip) setZip(storedZip);

      if (existing.customerName) setName(existing.customerName);
      if (existing.customerEmail) setEmail(existing.customerEmail);
      if (existing.customerPhone) setPhone(formatPhoneUS(existing.customerPhone));
      if (existing.customerStreet) setStreet(existing.customerStreet);
      if (existing.customerCity) setCity(existing.customerCity);
      if (existing.customerState) setStateCode(existing.customerState);
      if (existing.selectedServiceLocationId) setSelectedSavedLocationId(existing.selectedServiceLocationId);
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
      const raw = sessionStorage.getItem(getBookingStorageKey());
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
        sessionStorage.setItem(getBookingStorageKey(), JSON.stringify(nextDraft));

        setName(nextDraft.customerName ?? "");
        setEmail(nextDraft.customerEmail ?? "");
        setPhone(formatPhoneUS(nextDraft.customerPhone ?? ""));
        setStreet(nextDraft.customerStreet ?? "");
        setCity(nextDraft.customerCity ?? "");
        setStateCode(nextDraft.customerState ?? "");
        setSelectedSavedLocationId(nextDraft.selectedServiceLocationId ?? null);

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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/portal/locations", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (res.status === 401) {
          setSavedLocations([]);
          setSavedLocationsError(null);
          setSavedLocationsReady(true);
          return;
        }

        if (!res.ok || !json?.ok) {
          setSavedLocations([]);
          setSavedLocationsError(json?.error || "Saved locations are unavailable right now.");
          setSavedLocationsReady(true);
          return;
        }

        setSavedLocations((json.locations ?? []) as SavedServiceLocation[]);
        setSavedLocationsError(null);
        setSavedLocationsReady(true);
      } catch {
        if (cancelled) return;
        setSavedLocations([]);
        setSavedLocationsError("Saved locations are unavailable right now.");
        setSavedLocationsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/portal/me", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));

        if (cancelled || !res.ok || !json?.ok || !json?.customer) {
          return;
        }

        const customer = json.customer as PortalCustomerSnapshot;

        setName((current) => current || (customer.name?.trim() ?? ""));
        setEmail((current) => current || (customer.email?.trim() ?? ""));
        setPhone((current) => current || formatPhoneUS(customer.phone ?? ""));
        setStreet((current) => current || (customer.primaryStreet?.trim() ?? ""));
        setCity((current) => current || (customer.primaryCity?.trim() ?? ""));
        setStateCode((current) => current || (customer.primaryState?.trim().toUpperCase() ?? ""));
        setZip((current) => current || ((customer.primaryZip ?? "").replace(/\D/g, "").slice(0, 5) || ""));
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function persistDraft(extra?: Partial<BookingDraft>) {
    const raw = sessionStorage.getItem(getBookingStorageKey());
    const existing: BookingDraft = raw ? JSON.parse(raw) : {};
    const sanitizedZip = zip.replace(/\D/g, "").slice(0, 5);

    sessionStorage.setItem(
      getBookingStorageKey(),
      JSON.stringify({
        ...existing,
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: digitsOnly(phone),
        customerStreet: street.trim(),
        customerCity: city.trim(),
        customerState: stateCode.trim().toUpperCase(),
        customerZip: sanitizedZip,
        selectedServiceLocationId: selectedSavedLocationId,
        zip: sanitizedZip,
        ...extra,
      }),
    );
  }

  async function handleZipCheck(zipOverride?: string): Promise<boolean> {
    const z = (zipOverride ?? zip).replace(/[^\d]/g, "").slice(0, 5);

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
          content.unsupportedZipMessage,
      });
      return false;
    }

    persistDraft({
      customerZip: z,
      zip: z,
      county: json.county,
      town: json.town,
      priceQuote: json.priceQuote ?? null,
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

  async function handleUseSavedLocation(location: SavedServiceLocation) {
    setStreet(location.street);
    setCity(location.city);
    setStateCode(location.state);
    setZip(location.zip);
    setSelectedSavedLocationId(location.id);
    setIsEditingDetails(false);
    setZipBeforeEdit(location.zip);
    setIsEditingZip(false);

    const ok = await handleZipCheck(location.zip);
    if (!ok) {
      zipSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    persistDraft({
      customerStreet: location.street,
      customerCity: location.city,
      customerState: location.state,
      customerZip: location.zip,
      selectedServiceLocationId: location.id,
    });
  }

  const normalizedZip = zip.replace(/[^\d]/g, "").slice(0, 5);
  const selectedSavedLocation =
    savedLocations.find((location) => location.id === selectedSavedLocationId) ?? null;
  const showSavedLocationSummary = !!selectedSavedLocation && !isEditingDetails;
  const canContinue =
    !isEditingZip &&
    !!name.trim() &&
    !!email.trim() &&
    !!phone.trim() &&
    !!street.trim() &&
    !!city.trim() &&
    /^[A-Z]{2}$/.test(stateCode.trim().toUpperCase()) &&
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

            <h1 className="mt-6 text-3xl font-semibold text-[#0F172A]">{content.title}</h1>
            <p className="text-[#475569]">{content.description}</p>
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
                {content.serviceAreaNotice}
              </div>
            </div>

            {savedLocationsReady && savedLocations.length > 0 ? (
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{content.savedLocationsTitle}</h2>
                  </div>
                  <a
                    href="/portal/locations"
                    className="inline-flex items-center justify-center rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 hover:text-slate-900"
                  >
                    {content.savedLocationsManageLabel}
                  </a>
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {content.savedLocationsDescription}
                </p>

                <div className="mt-5 grid gap-3">
                  {savedLocations.map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      onClick={() => handleUseSavedLocation(location)}
                      className={[
                        "rounded-[24px] border px-4 py-4 text-left transition",
                        selectedSavedLocationId === location.id
                          ? "border-[#FDBA74] bg-[#FFF7ED] ring-2 ring-[#FDBA74]/40"
                          : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{location.label}</span>
                            {location.is_default ? (
                              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                                Default
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-sm leading-6 text-slate-500">
                            {[location.street, [location.city, location.state].filter(Boolean).join(", "), location.zip]
                              .filter(Boolean)
                              .join(" ")}
                          </div>
                          {location.delivery_notes ? (
                            <div className="mt-2 text-sm leading-6 text-slate-600">{location.delivery_notes}</div>
                          ) : null}
                        </div>
                        <span className="text-sm font-semibold text-[#F97316]">
                          {selectedSavedLocationId === location.id ? "Selected" : "Use"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {!selectedSavedLocation ? (
                  <div className="mt-4 text-sm text-slate-500">Or enter a new address manually below.</div>
                ) : null}
              </section>
            ) : null}

            {savedLocationsReady && savedLocationsError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
                {savedLocationsError}
              </div>
            ) : null}

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {showSavedLocationSummary ? content.bookingDetailsTitle : "Contact & address"}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {showSavedLocationSummary
                      ? "Your saved location has already filled in this booking. Review what will be used, or open the form if anything should be different for this rental."
                      : content.bookingDetailsDescription}
                  </p>
                </div>

                {showSavedLocationSummary ? (
                  <div className="flex w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setIsEditingDetails(true)}
                      className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-2xl bg-slate-900 px-5 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Edit details
                    </button>
                  </div>
                ) : null}
              </div>

              {showSavedLocationSummary ? (
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-[#FDBA74] bg-[#FFF7ED] px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{selectedSavedLocation.label}</span>
                      {selectedSavedLocation.is_default ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                          Default saved location
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {content.savedLocationIntro}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Contact</div>
                      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Name</div>
                          <div className="mt-1 font-medium text-slate-900">{formatSummaryValue(name)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Email</div>
                          <div className="mt-1 font-medium text-slate-900">{formatSummaryValue(email)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Phone</div>
                          <div className="mt-1 font-medium text-slate-900">{formatSummaryValue(phone)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Delivery address
                      </div>
                      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Street</div>
                          <div className="mt-1 font-medium text-slate-900">{formatSummaryValue(street)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">City, state</div>
                          <div className="mt-1 font-medium text-slate-900">
                            {formatSummaryValue([city.trim(), stateCode.trim().toUpperCase()].filter(Boolean).join(", "))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ZIP code</div>
                          <div className="mt-1 font-medium text-slate-900">{formatSummaryValue(zip)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedSavedLocation.delivery_notes ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-600">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Placement notes</div>
                      <div className="mt-2 text-slate-900">{selectedSavedLocation.delivery_notes}</div>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-500">
                    {content.savedLocationFootnote}
                  </div>
                </div>
              ) : (
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
                  <label className="text-sm font-medium text-slate-700">State</label>
                  <input
                    className={inputClass()}
                    value={stateCode}
                    onChange={(e) => setStateCode(e.target.value.toUpperCase())}
                    placeholder="e.g., NY"
                    autoComplete="address-level1"
                    maxLength={2}
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
                            {content.zipIdleHelper}
                          </div>
                        ) : null}

                        {zipStatus.state === "valid" ? (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                            {formatTemplate(content.zipValidTemplate, {
                              town: zipStatus.town,
                              county: zipStatus.county,
                            })}
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
              )}

              {selectedSavedLocation && isEditingDetails ? (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-500">
                  You are editing this booking&apos;s snapshot details. Your saved location record will stay unchanged.
                </div>
              ) : null}
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
