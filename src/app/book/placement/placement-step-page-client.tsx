/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpTrayIcon, CameraIcon, XMarkIcon } from "@heroicons/react/24/outline";
import {
  HoldCountdownBanner,
  useBookingHoldCountdown,
} from "@/components/booking/hold-countdown-banner";
import { getTenantStorageKey, TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";
import {
  ACCESS_ISSUES,
  DELIVERY_PRESENCE_OPTIONS,
  accessIssueLabel,
  deliveryPresenceLabel,
  placementPreferenceLabel,
  sanitizePlacementDetails,
  validatePlacementDetails,
  type AccessIssue,
  type DeliveryPresence,
  type PlacementPreference,
} from "@/lib/placement";

const PLACEMENT_PREFERENCE_DISPLAY_ORDER: readonly PlacementPreference[] = [
  "driveway",
  "street_curb",
  "left_side_of_driveway",
  "right_side_of_driveway",
  "parking_lot",
  "alley_side_access",
  "jobsite_custom_area",
  "other",
];

const ACCESS_ISSUE_DISPLAY_OPTIONS = ACCESS_ISSUES.filter(
  (issue) => issue !== "parked_vehicles" && issue !== "street_permit_required",
);
const PLACEMENT_PHOTO_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PLACEMENT_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
const PLACEMENT_PHOTO_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const PLACEMENT_PHOTO_HELPER_TEXT = "JPG, PNG, or WEBP, up to 5MB";

type BookingDraft = {
  zip?: string;
  serviceState?: string | null;
  dumpsterSize?: string;
  dumpsterProductId?: string | null;
  deliveryDate?: string;
  pickupDate?: string;
  priceQuote?: { effectivePickupDate?: string | null } | null;
  holdId?: string;
  holdExpiresAt?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerStreet?: string;
  customerCity?: string;
  customerState?: string;
  customerZip?: string;
  reorderSourceBookingId?: string;
  reorderSourceBookingRef?: string | null;
  placementPreference?: PlacementPreference | null;
  placementDetails?: string | null;
  accessIssues?: AccessIssue[];
  gateInstructions?: string | null;
  otherConcernDetails?: string | null;
  deliveryPresence?: DeliveryPresence | null;
  alternateContactName?: string | null;
  alternateContactPhone?: string | null;
  placementPhotoUrl?: string | null;
  specialDeliveryInstructions?: string | null;
};

function getBookingStorageKey() {
  return getTenantStorageKey(TENANT_STORAGE_KEYS.booking);
}

function getRetailPlacementPreferenceLabel(option: PlacementPreference) {
  return option === "other" ? "Other" : placementPreferenceLabel[option];
}

function readDraft(): BookingDraft {
  if (typeof window === "undefined") return {};

  try {
    const raw = sessionStorage.getItem(getBookingStorageKey());
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

function normalizeStateCode(value: string | null | undefined) {
  const state = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(state) ? state : "";
}

function getCustomerNames(draft: BookingDraft) {
  const firstName = (draft.customerFirstName ?? "").trim();
  const lastName = (draft.customerLastName ?? "").trim();

  if (firstName || lastName) return { firstName, lastName };

  const nameParts = (draft.customerName ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: nameParts[0] ?? "",
    lastName: nameParts.slice(1).join(" "),
  };
}

function getDraftStateCode(draft: BookingDraft) {
  return normalizeStateCode(draft.customerState) || normalizeStateCode(draft.serviceState);
}

function cardInputClass(multiline = false) {
  return [
    "w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none transition",
    "focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/15",
    multiline ? "min-h-[96px] py-3" : "h-12",
  ].join(" ");
}

function FormLabel({
  children,
  required = false,
  bold = false,
}: {
  children: ReactNode;
  required?: boolean;
  bold?: boolean;
}) {
  return (
    <label className={`text-sm text-slate-700 ${bold ? "font-bold" : "font-medium"}`}>
      {children}
      {required ? (
        <>
          <span aria-hidden="true" className="text-[#F97316]">
            {" "}
            *
          </span>
          <span className="sr-only"> required</span>
        </>
      ) : null}
    </label>
  );
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

type PlacementStepPageClientProps = {
  content: {
    title: string;
    description: string;
    addressSummaryPrefix: string;
    tipsLabel: string;
    tipsSummary: string;
    tipsExpanded: string;
    streetPermitNotice: string;
    placementExample: string;
    optionalDetailsTitle: string;
    optionalDetailsDescription: string;
    accessQuestion: string;
    accessSimpleOption: string;
    accessDetailedOption: string;
    photoUploadingLabel: string;
    photoFailedLabel: string;
  };
};

export default function PlacementStepPageClient({ content }: PlacementStepPageClientProps) {
  const router = useRouter();
  const photoInputId = useId();
  const photoErrorId = useId();

  const [hasHydratedDraft, setHasHydratedDraft] = useState(false);
  const hasEditedStateRef = useRef(false);
  const hasAttemptedStateAutofillRef = useRef(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const photoObjectUrlRef = useRef<string | null>(null);
  const [draft, setDraft] = useState<BookingDraft>({});
  const initialDraft = draft;
  const serviceZip = (initialDraft.zip || initialDraft.customerZip || "").replace(/\D/g, "").slice(0, 5);
  const hasDumpsterSelection = Boolean(
    (initialDraft.dumpsterSize || "").trim() || (initialDraft.dumpsterProductId || "").trim(),
  );
  const hasDeliveryDate = /^\d{4}-\d{2}-\d{2}$/.test((initialDraft.deliveryDate || "").trim());
  const hasPickupDate = /^\d{4}-\d{2}-\d{2}$/.test(
    (initialDraft.pickupDate || initialDraft.priceQuote?.effectivePickupDate || "").trim(),
  );
  const {
    formattedTime: holdFormattedTime,
    hasHoldExpiration,
    holdExpired,
  } = useBookingHoldCountdown(initialDraft.holdExpiresAt);
  const hasActiveHold =
    Boolean(initialDraft.holdId) &&
    hasHoldExpiration &&
    !holdExpired;
  const hasRequiredPriorSteps =
    /^\d{5}$/.test(serviceZip) && hasDumpsterSelection && hasDeliveryDate && hasPickupDate && hasActiveHold;

  const initialCustomerNames = getCustomerNames(initialDraft);
  const [firstName, setFirstName] = useState(initialCustomerNames.firstName);
  const [lastName, setLastName] = useState(initialCustomerNames.lastName);
  const [email, setEmail] = useState(initialDraft.customerEmail ?? "");
  const [phone, setPhone] = useState(formatPhoneUS(initialDraft.customerPhone ?? ""));
  const [street, setStreet] = useState(initialDraft.customerStreet ?? "");
  const [city, setCity] = useState(initialDraft.customerCity ?? "");
  const [stateCode, setStateCode] = useState(getDraftStateCode(initialDraft));
  const [placementPreference, setPlacementPreference] = useState<PlacementPreference | "">(
    initialDraft.placementPreference ?? "",
  );
  const [placementDetails, setPlacementDetails] = useState(initialDraft.placementDetails ?? "");
  const [accessIssues, setAccessIssues] = useState<AccessIssue[]>(initialDraft.accessIssues ?? []);
  const [gateInstructions, setGateInstructions] = useState(initialDraft.gateInstructions ?? "");
  const [otherConcernDetails, setOtherConcernDetails] = useState(initialDraft.otherConcernDetails ?? "");
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
  const [isPhotoDragActive, setIsPhotoDragActive] = useState(false);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const [selectedPhotoPreviewUrl, setSelectedPhotoPreviewUrl] = useState("");
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

  useEffect(() => {
    const nextDraft = readDraft();
    const nextCustomerNames = getCustomerNames(nextDraft);
    setDraft(nextDraft);
    setFirstName(nextCustomerNames.firstName);
    setLastName(nextCustomerNames.lastName);
    setEmail(nextDraft.customerEmail ?? "");
    setPhone(formatPhoneUS(nextDraft.customerPhone ?? ""));
    setStreet(nextDraft.customerStreet ?? "");
    setCity(nextDraft.customerCity ?? "");
    setStateCode(getDraftStateCode(nextDraft));
    setPlacementPreference(nextDraft.placementPreference ?? "");
    setPlacementDetails(nextDraft.placementDetails ?? "");
    setAccessIssues(nextDraft.accessIssues ?? []);
    setGateInstructions(nextDraft.gateInstructions ?? "");
    setOtherConcernDetails(nextDraft.otherConcernDetails ?? "");
    setDeliveryPresence(nextDraft.deliveryPresence ?? "");
    setAlternateContactName(nextDraft.alternateContactName ?? "");
    setAlternateContactPhone(formatPhoneUS(nextDraft.alternateContactPhone ?? ""));
    setPlacementPhotoUrl(nextDraft.placementPhotoUrl ?? "");
    setSpecialDeliveryInstructions(nextDraft.specialDeliveryInstructions ?? "");
    setShowAccessDetails((nextDraft.accessIssues?.length ?? 0) > 0 || !!nextDraft.gateInstructions);
    setShowAlternateContact(!!nextDraft.alternateContactName || !!nextDraft.alternateContactPhone);
    setShowPhotoUpload(!!nextDraft.placementPhotoUrl);
    setShowSpecialInstructions(!!nextDraft.specialDeliveryInstructions);
    setHasHydratedDraft(true);
  }, []);

  useEffect(() => {
    return () => {
      if (photoObjectUrlRef.current) {
        URL.revokeObjectURL(photoObjectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedDraft) return;

    if (!/^\d{5}$/.test(serviceZip)) {
      router.replace("/book/address");
      return;
    }

    if (!hasDumpsterSelection) {
      router.replace(`/book?zip=${encodeURIComponent(serviceZip)}`);
      return;
    }

    if (!hasDeliveryDate || !hasPickupDate || !hasActiveHold) {
      router.replace("/book/date");
    }
  }, [
    hasActiveHold,
    hasDeliveryDate,
    hasDumpsterSelection,
    hasHydratedDraft,
    hasPickupDate,
    router,
    serviceZip,
  ]);

  useEffect(() => {
    if (!hasHydratedDraft || hasAttemptedStateAutofillRef.current) return;

    hasAttemptedStateAutofillRef.current = true;

    if (stateCode.trim()) return;

    const savedServiceState = normalizeStateCode(draft.serviceState);
    if (savedServiceState) {
      setStateCode((current) =>
        current.trim() || hasEditedStateRef.current ? current : savedServiceState,
      );
      return;
    }

    if (!/^\d{5}$/.test(serviceZip)) return;

    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams({
          zip: serviceZip,
          dumpsterSize: initialDraft.dumpsterSize || "",
        });

        if (initialDraft.dumpsterProductId) {
          params.set("dumpsterProductId", initialDraft.dumpsterProductId);
        }

        const res = await fetch(`/api/zip-check?${params.toString()}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));

        if (cancelled || !res.ok || !json?.serviced) return;

        const nextState = normalizeStateCode(json.state);
        if (!nextState) return;

        setStateCode((current) =>
          current.trim() || hasEditedStateRef.current ? current : nextState,
        );

        const existing = readDraft();
        if (!normalizeStateCode(existing.serviceState)) {
          sessionStorage.setItem(
            getBookingStorageKey(),
            JSON.stringify({
              ...existing,
              serviceState: nextState,
            }),
          );
          setDraft((current) => ({ ...current, serviceState: nextState }));
        }
      } catch {
        // Leave state empty when service-area state cannot be found confidently.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    draft.serviceState,
    hasHydratedDraft,
    initialDraft.dumpsterProductId,
    initialDraft.dumpsterSize,
    serviceZip,
    stateCode,
  ]);

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

  const customerName = useMemo(
    () => `${firstName.trim()} ${lastName.trim()}`.trim(),
    [firstName, lastName],
  );
  const validationError = validatePlacementDetails(sanitizedPlacement);
  const gateFieldVisible = showAccessDetails && accessIssues.includes("gated_property");
  const otherConcernFieldVisible = showAccessDetails && accessIssues.includes("other_concern");
  const otherConcernError =
    otherConcernFieldVisible && !otherConcernDetails.trim() ? "Please describe the concern." : null;
  const placementValidationError = validationError || otherConcernError;
  const placementDetailsVisible = placementPreference === "other";
  const streetPermitNoteVisible = placementPreference === "street_curb";
  const defaultContactSummary = formatPhoneUS(phone) || "Use main booking phone";
  const alternateContactSummary =
    showAlternateContact && (alternateContactName || alternateContactPhone)
      ? [alternateContactName, formatPhoneUS(alternateContactPhone)]
          .filter(Boolean)
          .join(" • ")
      : defaultContactSummary;
  const photoSummary = placementPhotoUrl ? "Photo added" : "Add a photo of the drop area";
  const photoPreviewUrl = selectedPhotoPreviewUrl || placementPhotoUrl;
  const notesSummary = specialDeliveryInstructions
    ? "Special instructions added"
    : "Add any extra notes for dispatch or the driver";

  const contactError = useMemo(() => {
    if (!firstName.trim()) return "Enter your first name.";
    if (!lastName.trim()) return "Enter your last name.";
    if (!email.trim() || !isValidEmail(email)) return "Please enter a valid email address.";
    if (digitsOnly(phone).length !== 10) return "Enter a valid 10-digit phone number.";
    if (!street.trim()) return "Enter the delivery street address.";
    if (!city.trim()) return "Enter the delivery city.";
    if (!/^[A-Z]{2}$/.test(stateCode.trim().toUpperCase())) return "Enter a valid 2-letter state code.";
    if (!/^\d{5}$/.test(serviceZip)) return "Service ZIP is missing. Please check your service area again.";
    return null;
  }, [city, email, firstName, lastName, phone, serviceZip, stateCode, street]);

  function persistDraft() {
    const existing = readDraft();

    sessionStorage.setItem(
      getBookingStorageKey(),
      JSON.stringify({
        ...existing,
        customerFirstName: firstName.trim(),
        customerLastName: lastName.trim(),
        customerName,
        customerEmail: email.trim(),
        customerPhone: digitsOnly(phone),
        customerStreet: street.trim(),
        customerCity: city.trim(),
        customerState: stateCode.trim().toUpperCase(),
        customerZip: serviceZip,
        zip: serviceZip,
        placementPreference: sanitizedPlacement.placementPreference,
        placementDetails: sanitizedPlacement.placementDetails,
        accessIssues: sanitizedPlacement.accessIssues,
        gateInstructions: sanitizedPlacement.gateInstructions,
        otherConcernDetails: otherConcernDetails.trim(),
        deliveryPresence: sanitizedPlacement.deliveryPresence,
        alternateContactName: sanitizedPlacement.alternateContactName,
        alternateContactPhone: sanitizedPlacement.alternateContactPhone,
        placementPhotoUrl: sanitizedPlacement.placementPhotoUrl,
        specialDeliveryInstructions: sanitizedPlacement.specialDeliveryInstructions,
      }),
    );
  }

  function resetPhotoInput() {
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  }

  function clearSelectedPhotoPreview() {
    if (photoObjectUrlRef.current) {
      URL.revokeObjectURL(photoObjectUrlRef.current);
      photoObjectUrlRef.current = null;
    }
    setSelectedPhotoPreviewUrl("");
  }

  function showSelectedPhotoPreview(file: File) {
    clearSelectedPhotoPreview();
    const previewUrl = URL.createObjectURL(file);
    photoObjectUrlRef.current = previewUrl;
    setSelectedPhotoPreviewUrl(previewUrl);
  }

  function removePlacementPhoto() {
    setPlacementPhotoUrl("");
    setSelectedPhotoName("");
    setUploadError(null);
    clearSelectedPhotoPreview();
    resetPhotoInput();

    const existing = readDraft();
    sessionStorage.setItem(
      getBookingStorageKey(),
      JSON.stringify({
        ...existing,
        placementPhotoUrl: null,
      }),
    );
  }

  function getPlacementPhotoValidationError(file: File) {
    if (!PLACEMENT_PHOTO_ALLOWED_TYPES.has(file.type)) {
      return "Please upload a JPG, PNG, or WEBP image.";
    }

    if (file.size > PLACEMENT_PHOTO_MAX_SIZE_BYTES) {
      return "Photo must be 5MB or smaller.";
    }

    return null;
  }

  function acceptPlacementPhoto(file: File | null | undefined) {
    if (isUploadingPhoto) return;
    if (!file) return;

    const photoError = getPlacementPhotoValidationError(file);
    if (photoError) {
      setUploadError(photoError);
      setSelectedPhotoName("");
      clearSelectedPhotoPreview();
      resetPhotoInput();
      return;
    }

    setSelectedPhotoName(file.name);
    showSelectedPhotoPreview(file);
    void handlePhotoUpload(file);
    resetPhotoInput();
  }

  function handlePhotoDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsPhotoDragActive(false);
    acceptPlacementPhoto(event.dataTransfer.files?.[0]);
  }

  function handlePhotoDrag(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!isUploadingPhoto) {
      setIsPhotoDragActive(true);
    }
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
        setUploadError(json?.error || content.photoFailedLabel);
        setSelectedPhotoName("");
        clearSelectedPhotoPreview();
        return;
      }

      clearSelectedPhotoPreview();
      setPlacementPhotoUrl(json.url);
      setShowPhotoUpload(true);

      const existing = readDraft();
      sessionStorage.setItem(
        getBookingStorageKey(),
        JSON.stringify({
          ...existing,
          placementPhotoUrl: json.url,
        }),
      );
    } catch {
      setUploadError(content.photoFailedLabel);
      setSelectedPhotoName("");
      clearSelectedPhotoPreview();
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  function handleContinue() {
    if (contactError) return;
    if (placementValidationError) return;
    persistDraft();
    router.push("/confirm");
  }

  const canContinue = !contactError && !placementValidationError && !isUploadingPhoto;

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#0F172A]">
      <div className="mx-auto max-w-2xl px-6 pb-16 pt-10">
        <div className="rounded-[32px] bg-white px-10 pb-12 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-12 sm:pb-12 sm:pt-8">
          {!hasHydratedDraft || !hasRequiredPriorSteps ? (
            <div className="space-y-6">
              <div className="mx-auto mb-4 w-full max-w-2xl">
                <div className="flex flex-col gap-2">
                  <div className="inline-flex w-fit items-center rounded-full bg-[#F97316]/10 px-4 py-1 text-xs font-semibold text-[#F97316]">
                    Step 3 of 5
                  </div>

                  <div className="h-2 w-full rounded-full bg-slate-200/60">
                    <div className="h-2 w-3/5 rounded-full bg-[#F97316]" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="mt-6 text-3xl font-semibold text-[#0F172A]">Your details</h1>
                <p className="text-[#475569]">Checking your booking details...</p>
              </div>
            </div>
          ) : (
            <>
          <div className="space-y-3">
            <div className="mx-auto mb-4 w-full max-w-2xl">
              <div className="flex flex-col gap-2">
                <div className="inline-flex w-fit items-center rounded-full bg-[#F97316]/10 px-4 py-1 text-xs font-semibold text-[#F97316]">
                  Step 3 of 5
                </div>

                <div className="h-2 w-full rounded-full bg-slate-200/60">
                  <div className="h-2 w-3/5 rounded-full bg-[#F97316]" />
                </div>
              </div>
            </div>

            <h1 className="mt-6 text-3xl font-semibold text-[#0F172A]">Your details</h1>
            <p className="text-[#475569]">
              Tell us where to deliver and how to reach you.
            </p>
          </div>

          <section className="mt-8 space-y-5">
            <HoldCountdownBanner
              formattedTime={holdExpired ? null : holdFormattedTime}
            />

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-900">Contact & delivery address</h2>
              </div>

              <div className="mt-5 grid gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FormLabel required>First name</FormLabel>
                    <input
                      className={cardInputClass()}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g., John"
                      autoComplete="given-name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <FormLabel required>Last name</FormLabel>
                    <input
                      className={cardInputClass()}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g., Doe"
                      autoComplete="family-name"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <FormLabel required>Email</FormLabel>
                  <input
                    className={cardInputClass()}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g., you@email.com"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <FormLabel required>Phone</FormLabel>
                  <input
                    className={cardInputClass()}
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneUS(digitsOnly(e.target.value)))}
                    placeholder="e.g., (315) 555-1234"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>

                <div className="space-y-2">
                  <FormLabel required>Street address</FormLabel>
                  <input
                    className={cardInputClass()}
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="e.g., 123 Main St"
                    autoComplete="street-address"
                  />
                </div>

                <div className="space-y-2">
                  <FormLabel required>City</FormLabel>
                  <input
                    className={cardInputClass()}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g., Chittenango"
                    autoComplete="address-level2"
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-[1fr_120px]">
                  <div className="space-y-2">
                    <FormLabel required>State</FormLabel>
                    <input
                      className={cardInputClass()}
                      value={stateCode}
                      onChange={(e) => {
                        hasEditedStateRef.current = true;
                        setStateCode(e.target.value.toUpperCase());
                      }}
                      placeholder="e.g., NY"
                      autoComplete="address-level1"
                      maxLength={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <FormLabel required>ZIP</FormLabel>
                    <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900">
                      {serviceZip}
                    </div>
                  </div>
                </div>
              </div>

              {contactError ? (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                  {contactError}
                </div>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-6">
                <div className="space-y-2">
                  <FormLabel required bold>Placement preference</FormLabel>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PLACEMENT_PREFERENCE_DISPLAY_ORDER.map((option) => (
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
                        <span className="font-medium">{getRetailPlacementPreferenceLabel(option)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {streetPermitNoteVisible ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                    {content.streetPermitNotice}
                  </div>
                ) : null}

                {placementDetailsVisible ? (
                  <div className="space-y-2">
                    <FormLabel>Exact placement details</FormLabel>
                    <textarea
                      className={cardInputClass(true)}
                      value={placementDetails}
                      onChange={(e) => setPlacementDetails(e.target.value)}
                      placeholder={content.placementExample}
                    />
                    <p className="text-xs text-slate-500">
                      {content.placementExample}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <FormLabel required bold>Delivery presence</FormLabel>
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
                          {deliveryPresenceLabel[option]}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-6">
                  <div className="text-base font-semibold text-slate-900">{content.optionalDetailsTitle}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {content.optionalDetailsDescription}
                  </p>

                  <div className="mt-4 space-y-3">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                        <div className="text-sm font-semibold text-slate-900">
                          {content.accessQuestion}
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
                            <span className="font-medium">{content.accessSimpleOption}</span>
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
                            <span className="font-medium">{content.accessDetailedOption}</span>
                          </label>
                        </div>
                      </div>

                      {showAccessDetails ? (
                        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {ACCESS_ISSUE_DISPLAY_OPTIONS.map((issue) => {
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
                              <FormLabel required>Gate / access instructions</FormLabel>
                              <textarea
                                className={cardInputClass(true)}
                                value={gateInstructions}
                                onChange={(e) => setGateInstructions(e.target.value)}
                                placeholder="Gate code, call box instructions, or lock notes"
                              />
                            </div>
                          ) : null}

                          {otherConcernFieldVisible ? (
                            <div className="space-y-2">
                              <FormLabel required>Please describe the concern</FormLabel>
                              <textarea
                                className={cardInputClass(true)}
                                value={otherConcernDetails}
                                onChange={(e) => setOtherConcernDetails(e.target.value)}
                                placeholder="Example: low hanging wires near the driveway, tight turn, soft ground, etc."
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
                              placeholder="e.g., Jane Smith"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Alternate contact phone</label>
                            <input
                              className={cardInputClass()}
                              value={alternateContactPhone}
                              onChange={(e) => setAlternateContactPhone(formatPhoneUS(digitsOnly(e.target.value)))}
                              placeholder="e.g., (315) 555-0000"
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
                            id={photoInputId}
                            ref={photoInputRef}
                            type="file"
                            accept={PLACEMENT_PHOTO_ACCEPT}
                            disabled={isUploadingPhoto}
                            aria-describedby={uploadError ? photoErrorId : undefined}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              acceptPlacementPhoto(file);
                            }}
                            className="sr-only"
                          />
                          <div
                            onDragEnter={handlePhotoDrag}
                            onDragOver={handlePhotoDrag}
                            onDragLeave={(event) => {
                              event.preventDefault();
                              setIsPhotoDragActive(false);
                            }}
                            onDrop={handlePhotoDrop}
                            className={`rounded-xl border border-dashed px-5 py-5 text-center transition ${
                              isPhotoDragActive
                                ? "border-[#F97316] bg-[#FFF7ED] ring-4 ring-orange-100"
                                : "border-slate-300 bg-white hover:border-slate-400"
                            } ${isUploadingPhoto ? "cursor-wait opacity-75" : ""}`}
                          >
                            <CameraIcon className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
                            <div className="mt-3 text-sm font-medium text-slate-700">
                              Drag a photo here, or
                            </div>
                            <button
                              type="button"
                              disabled={isUploadingPhoto}
                              onClick={() => photoInputRef.current?.click()}
                              aria-label="Choose delivery photo"
                              className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <ArrowUpTrayIcon className="h-4 w-4" aria-hidden="true" />
                              Choose photo
                            </button>
                            <div className="mt-2 text-xs text-slate-500">{PLACEMENT_PHOTO_HELPER_TEXT}</div>
                          </div>
                          {isUploadingPhoto ? <div className="text-sm text-slate-500">{content.photoUploadingLabel}</div> : null}
                          {uploadError ? (
                            <div
                              id={photoErrorId}
                              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
                              role="alert"
                            >
                              {uploadError}
                            </div>
                          ) : null}
                          {photoPreviewUrl ? (
                            <div className="space-y-3">
                              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                <img
                                  src={photoPreviewUrl}
                                  alt="Selected delivery photo preview"
                                  className="h-40 w-full object-cover"
                                />
                                <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0 text-sm text-slate-600">
                                    {selectedPhotoName ? (
                                      <span className="block truncate">{selectedPhotoName}</span>
                                    ) : (
                                      <span>Delivery photo added</span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={removePlacementPhoto}
                                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
                                  >
                                    <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                                    Remove photo
                                  </button>
                                </div>
                              </div>
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

                {placementValidationError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    {placementValidationError}
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
                  Review booking
                  <span className="text-white/90 transition-transform group-hover:translate-x-1">→</span>
                </span>
              </button>
            </div>

            <a href="/book/date" className="text-sm text-slate-600 transition-colors hover:text-slate-900">
              ← Back
            </a>
          </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
