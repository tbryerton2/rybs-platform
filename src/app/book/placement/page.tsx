/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACCESS_ISSUES,
  DELIVERY_PRESENCE_OPTIONS,
  PLACEMENT_PREFERENCES,
  accessIssueLabel,
  placementPreferenceLabel,
  sanitizePlacementDetails,
  validatePlacementDetails,
  type AccessIssue,
  type DeliveryPresence,
  type PlacementPreference,
} from "@/lib/placement";

type BookingDraft = {
  customerPhone?: string;
  customerStreet?: string;
  customerCity?: string;
  customerZip?: string;
  reorderSourceBookingId?: string;
  reorderSourceBookingRef?: string | null;
  placementPreference?: PlacementPreference | null;
  placementDetails?: string | null;
  accessIssues?: AccessIssue[];
  gateInstructions?: string | null;
  deliveryPresence?: DeliveryPresence | null;
  alternateContactName?: string | null;
  alternateContactPhone?: string | null;
  placementPhotoUrl?: string | null;
  specialDeliveryInstructions?: string | null;
};

function readDraft(): BookingDraft {
  if (typeof window === "undefined") return {};

  try {
    const raw = sessionStorage.getItem("tcm.booking");
    return raw ? (JSON.parse(raw) as BookingDraft) : {};
  } catch {
    return {};
  }
}

function formatPhoneUS(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);

  if (!digits) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function digitsOnly(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function cardInputClass(multiline = false) {
  return [
    "w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none transition",
    "focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/15",
    multiline ? "min-h-[96px] py-3" : "h-12",
  ].join(" ");
}

function OptionalRow({
  title,
  summary,
  actionLabel,
  isOpen,
  onToggle,
}: {
  title: string;
  summary: string;
  actionLabel: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
    >
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-sm leading-6 text-slate-500">{summary}</div>
      </div>
      <span className="shrink-0 text-sm font-semibold text-[#F97316]">
        {isOpen ? "Hide" : actionLabel}
      </span>
    </button>
  );
}

export default function PlacementStepPage() {
  const router = useRouter();

  const initialDraft = useMemo(() => readDraft(), []);
  const addressSummary = [initialDraft.customerStreet, initialDraft.customerCity, initialDraft.customerZip]
    .filter(Boolean)
    .join(", ");

  const [placementPreference, setPlacementPreference] = useState<PlacementPreference | "">(
    initialDraft.placementPreference ?? "",
  );
  const [placementDetails, setPlacementDetails] = useState(initialDraft.placementDetails ?? "");
  const [accessIssues, setAccessIssues] = useState<AccessIssue[]>(initialDraft.accessIssues ?? []);
  const [gateInstructions, setGateInstructions] = useState(initialDraft.gateInstructions ?? "");
  const [deliveryPresence, setDeliveryPresence] = useState<DeliveryPresence | "">(
    initialDraft.deliveryPresence ?? "",
  );
  const [alternateContactName, setAlternateContactName] = useState(initialDraft.alternateContactName ?? "");
  const [alternateContactPhone, setAlternateContactPhone] = useState(
    formatPhoneUS(initialDraft.alternateContactPhone ?? ""),
  );
  const [placementPhotoUrl, setPlacementPhotoUrl] = useState(initialDraft.placementPhotoUrl ?? "");
  const [specialDeliveryInstructions, setSpecialDeliveryInstructions] = useState(
    initialDraft.specialDeliveryInstructions ?? "",
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showAccessDetails, setShowAccessDetails] = useState(
    (initialDraft.accessIssues?.length ?? 0) > 0 || !!initialDraft.gateInstructions,
  );
  const [showAlternateContact, setShowAlternateContact] = useState(
    !!initialDraft.alternateContactName || !!initialDraft.alternateContactPhone,
  );
  const [showPhotoUpload, setShowPhotoUpload] = useState(!!initialDraft.placementPhotoUrl);
  const [showSpecialInstructions, setShowSpecialInstructions] = useState(
    !!initialDraft.specialDeliveryInstructions,
  );
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    if (!addressSummary) {
      router.replace("/book/address");
    }
  }, [addressSummary, router]);

  const sanitizedPlacement = useMemo(
    () =>
      sanitizePlacementDetails({
        placementPreference: placementPreference || null,
        placementDetails,
        accessIssues: showAccessDetails ? accessIssues : [],
        gateInstructions: showAccessDetails ? gateInstructions : null,
        deliveryPresence: deliveryPresence || null,
        alternateContactName: showAlternateContact ? alternateContactName : null,
        alternateContactPhone: showAlternateContact ? alternateContactPhone : null,
        placementPhotoUrl: showPhotoUpload ? placementPhotoUrl : null,
        specialDeliveryInstructions: showSpecialInstructions ? specialDeliveryInstructions : null,
      }),
    [
      accessIssues,
      alternateContactName,
      alternateContactPhone,
      deliveryPresence,
      gateInstructions,
      placementDetails,
      placementPhotoUrl,
      placementPreference,
      showAccessDetails,
      showAlternateContact,
      showPhotoUpload,
      showSpecialInstructions,
      specialDeliveryInstructions,
    ],
  );

  const validationError = validatePlacementDetails(sanitizedPlacement);
  const gateFieldVisible = showAccessDetails && accessIssues.includes("gated_property");
  const streetPermitNoteVisible = placementPreference === "street_curb";
  const defaultContactSummary = formatPhoneUS(initialDraft.customerPhone ?? "") || "Use main booking phone";
  const alternateContactSummary =
    showAlternateContact && (alternateContactName || alternateContactPhone)
      ? [alternateContactName, formatPhoneUS(alternateContactPhone)]
          .filter(Boolean)
          .join(" • ")
      : defaultContactSummary;
  const photoSummary = placementPhotoUrl ? "Photo added" : "Add a photo of the drop area";
  const notesSummary = specialDeliveryInstructions
    ? "Special instructions added"
    : "Add any extra notes for dispatch or the driver";

  if (!addressSummary) return null;

  function persistDraft() {
    const existing = readDraft();

    sessionStorage.setItem(
      "tcm.booking",
      JSON.stringify({
        ...existing,
        placementPreference: sanitizedPlacement.placementPreference,
        placementDetails: sanitizedPlacement.placementDetails,
        accessIssues: sanitizedPlacement.accessIssues,
        gateInstructions: sanitizedPlacement.gateInstructions,
        deliveryPresence: sanitizedPlacement.deliveryPresence,
        alternateContactName: sanitizedPlacement.alternateContactName,
        alternateContactPhone: sanitizedPlacement.alternateContactPhone,
        placementPhotoUrl: sanitizedPlacement.placementPhotoUrl,
        specialDeliveryInstructions: sanitizedPlacement.specialDeliveryInstructions,
      }),
    );
  }

  async function handlePhotoUpload(file: File) {
    setUploadError(null);
    setIsUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/placement-photo", {
        method: "POST",
        body: formData,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok || !json?.url) {
        setUploadError(json?.error || "Photo upload failed. Please try again.");
        return;
      }

      setPlacementPhotoUrl(json.url);
      setShowPhotoUpload(true);

      const existing = readDraft();
      sessionStorage.setItem(
        "tcm.booking",
        JSON.stringify({
          ...existing,
          placementPhotoUrl: json.url,
        }),
      );
    } catch {
      setUploadError("Photo upload failed. Please try again.");
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  function handleContinue() {
    if (validationError) return;
    persistDraft();
    router.push("/book/date");
  }

  const canContinue = !validationError && !isUploadingPhoto;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-[#EEF2F7] text-[#0F172A]">
      <div className="mx-auto max-w-2xl px-6 pb-16 pt-10">
        <div className="rounded-[32px] bg-white px-10 pb-12 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-12 sm:pb-12 sm:pt-8">
          <div className="space-y-3">
            <div className="mx-auto mb-4 w-full max-w-2xl">
              <div className="flex flex-col gap-2">
                <div className="inline-flex w-fit items-center rounded-full bg-[#F97316]/10 px-4 py-1 text-xs font-semibold text-[#F97316]">
                  Step 3 of 6
                </div>

                <div className="h-2 w-full rounded-full bg-slate-200/60">
                  <div className="h-2 w-1/2 rounded-full bg-[#F97316]" />
                </div>
              </div>
            </div>

            <h1 className="mt-6 text-3xl font-semibold text-[#0F172A]">Placement & access</h1>
            <p className="text-[#475569]">
              Tell us where to place the dumpster. We will only ask for extra details if needed.
            </p>
          </div>

          <section className="mt-8 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm text-slate-600">
                Delivery address: <span className="font-semibold text-slate-900">{addressSummary}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-slate-600">
                <span className="font-semibold text-slate-900">Delivery tips:</span>
                <span>Clear cars, watch low branches/wires, choose a flat accessible area.</span>
                <button
                  type="button"
                  onClick={() => setShowTips((current) => !current)}
                  className="font-semibold text-[#F97316] hover:underline"
                >
                  {showTips ? "Hide" : "Read more"}
                </button>
              </div>
              {showTips ? (
                <div className="mt-3 border-t border-slate-200 pt-3 text-sm leading-6 text-slate-600">
                  Street placement may require a permit in some municipalities. If you will not be
                  home, be specific and add a photo if it helps show the driver exactly where to
                  place the dumpster.
                </div>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Placement preference</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PLACEMENT_PREFERENCES.map((option) => (
                      <label
                        key={option}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                          placementPreference === option
                            ? "border-[#F97316]/40 bg-[#FFF7ED] text-slate-900"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="placement_preference"
                          className="mt-0.5"
                          checked={placementPreference === option}
                          onChange={() => setPlacementPreference(option)}
                        />
                        <span className="font-medium">{placementPreferenceLabel[option]}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {streetPermitNoteVisible ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                    Street placement may require a local permit depending on your municipality.
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Exact placement details</label>
                  <textarea
                    className={cardInputClass(true)}
                    value={placementDetails}
                    onChange={(e) => setPlacementDetails(e.target.value)}
                    placeholder="Example: right side of driveway near the garage."
                  />
                  <p className="text-xs text-slate-500">
                    Example: right side of driveway near the garage.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Delivery presence</label>
                  <div className="grid gap-2">
                    {DELIVERY_PRESENCE_OPTIONS.map((option) => (
                      <label
                        key={option}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                          deliveryPresence === option
                            ? "border-[#F97316]/40 bg-[#FFF7ED] text-slate-900"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="delivery_presence"
                          className="mt-0.5"
                          checked={deliveryPresence === option}
                          onChange={() => setDeliveryPresence(option)}
                        />
                        <span className="font-medium">
                          {option === "customer_present"
                            ? "I'll be there"
                            : option === "deliver_without_customer"
                            ? "You can deliver without me"
                            : "Call me if there's an issue"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-6">
                  <div className="text-base font-semibold text-slate-900">Optional details</div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Only add these if they help us deliver more accurately.
                  </p>

                  <div className="mt-4 space-y-3">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                        <div className="text-sm font-semibold text-slate-900">
                          Anything that could make delivery tricky?
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <label
                            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                              !showAccessDetails
                                ? "border-[#F97316]/40 bg-white text-slate-900"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <input
                              type="radio"
                              name="access_details_toggle"
                              className="mt-0.5"
                              checked={!showAccessDetails}
                              onChange={() => {
                                setShowAccessDetails(false);
                                setAccessIssues([]);
                                setGateInstructions("");
                              }}
                            />
                            <span className="font-medium">No, access is straightforward</span>
                          </label>
                          <label
                            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                              showAccessDetails
                                ? "border-[#F97316]/40 bg-white text-slate-900"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <input
                              type="radio"
                              name="access_details_toggle"
                              className="mt-0.5"
                              checked={showAccessDetails}
                              onChange={() => setShowAccessDetails(true)}
                            />
                            <span className="font-medium">Yes, there are a few details</span>
                          </label>
                        </div>
                      </div>

                      {showAccessDetails ? (
                        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {ACCESS_ISSUES.map((issue) => {
                              const checked = accessIssues.includes(issue);

                              return (
                                <label
                                  key={issue}
                                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                                    checked
                                      ? "border-slate-300 bg-white text-slate-900"
                                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={checked}
                                    onChange={() =>
                                      setAccessIssues((current) =>
                                        checked ? current.filter((value) => value !== issue) : [...current, issue],
                                      )
                                    }
                                  />
                                  <span>{accessIssueLabel[issue]}</span>
                                </label>
                              );
                            })}
                          </div>

                          {gateFieldVisible ? (
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-700">
                                Gate / access instructions
                              </label>
                              <textarea
                                className={cardInputClass(true)}
                                value={gateInstructions}
                                onChange={(e) => setGateInstructions(e.target.value)}
                                placeholder="Gate code, call box instructions, or lock notes"
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <OptionalRow
                        title="Delivery contact"
                        summary={alternateContactSummary}
                        actionLabel="Use different contact"
                        isOpen={showAlternateContact}
                        onToggle={() => {
                          if (showAlternateContact) {
                            setShowAlternateContact(false);
                            setAlternateContactName("");
                            setAlternateContactPhone("");
                          } else {
                            setShowAlternateContact(true);
                          }
                        }}
                      />

                      {showAlternateContact ? (
                        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Alternate contact name</label>
                            <input
                              className={cardInputClass()}
                              value={alternateContactName}
                              onChange={(e) => setAlternateContactName(e.target.value)}
                              placeholder="Optional"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Alternate contact phone</label>
                            <input
                              className={cardInputClass()}
                              value={alternateContactPhone}
                              onChange={(e) => setAlternateContactPhone(formatPhoneUS(digitsOnly(e.target.value)))}
                              placeholder="Optional"
                              inputMode="tel"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <OptionalRow
                        title="Delivery photo"
                        summary={photoSummary}
                        actionLabel="Add delivery photo"
                        isOpen={showPhotoUpload}
                        onToggle={() => setShowPhotoUpload((current) => !current)}
                      />

                      {showPhotoUpload ? (
                        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void handlePhotoUpload(file);
                            }}
                            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-slate-900 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
                          />
                          {isUploadingPhoto ? <div className="text-sm text-slate-500">Uploading photo...</div> : null}
                          {uploadError ? (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                              {uploadError}
                            </div>
                          ) : null}
                          {placementPhotoUrl ? (
                            <div className="space-y-3">
                              <img
                                src={placementPhotoUrl}
                                alt="Placement preview"
                                className="h-40 w-full rounded-2xl border border-slate-200 object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setPlacementPhotoUrl("");
                                  const existing = readDraft();
                                  sessionStorage.setItem(
                                    "tcm.booking",
                                    JSON.stringify({
                                      ...existing,
                                      placementPhotoUrl: null,
                                    }),
                                  );
                                }}
                                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                              >
                                Remove photo
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <OptionalRow
                        title="Special instructions"
                        summary={notesSummary}
                        actionLabel="Add special instructions"
                        isOpen={showSpecialInstructions}
                        onToggle={() => {
                          if (showSpecialInstructions) {
                            setShowSpecialInstructions(false);
                            setSpecialDeliveryInstructions("");
                          } else {
                            setShowSpecialInstructions(true);
                          }
                        }}
                      />

                      {showSpecialInstructions ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                          <textarea
                            className={cardInputClass(true)}
                            value={specialDeliveryInstructions}
                            onChange={(e) => setSpecialDeliveryInstructions(e.target.value)}
                            placeholder="Anything else the driver should know?"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {validationError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    {validationError}
                  </div>
                ) : null}
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

            <a href="/book/address" className="text-sm text-slate-600 transition-colors hover:text-slate-900">
              ← Back
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
