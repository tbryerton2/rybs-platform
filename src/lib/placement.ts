export const PLACEMENT_PREFERENCES = [
  "driveway",
  "left_side_of_driveway",
  "right_side_of_driveway",
  "street_curb",
  "parking_lot",
  "alley_side_access",
  "jobsite_custom_area",
  "other",
] as const;

export type PlacementPreference = (typeof PLACEMENT_PREFERENCES)[number];

export const ACCESS_ISSUES = [
  "gated_property",
  "narrow_driveway",
  "low_branches_wires",
  "parked_vehicles",
  "soft_ground_gravel",
  "sloped_area",
  "shared_driveway",
  "street_permit_required",
  "other_concern",
] as const;

export type AccessIssue = (typeof ACCESS_ISSUES)[number];

export const DELIVERY_PRESENCE_OPTIONS = [
  "customer_present",
  "deliver_without_customer",
] as const;

export type DeliveryPresence = (typeof DELIVERY_PRESENCE_OPTIONS)[number];

export const placementPreferenceLabel: Record<PlacementPreference, string> = {
  driveway: "Driveway",
  left_side_of_driveway: "Left side of driveway",
  right_side_of_driveway: "Right side of driveway",
  street_curb: "Street / curb",
  parking_lot: "Parking lot",
  alley_side_access: "Alley / side access",
  jobsite_custom_area: "Jobsite / custom area",
  other: "Other / specific instructions",
};

export const accessIssueLabel: Record<AccessIssue, string> = {
  gated_property: "Gated property",
  narrow_driveway: "Narrow driveway",
  low_branches_wires: "Low branches / wires",
  parked_vehicles: "Parked vehicles may block access",
  soft_ground_gravel: "Soft ground / gravel",
  sloped_area: "Sloped area",
  shared_driveway: "Shared driveway",
  street_permit_required: "Street placement may require permit",
  other_concern: "Other concern",
};

export const deliveryPresenceLabel: Record<DeliveryPresence, string> = {
  customer_present: "I'll be there for delivery",
  deliver_without_customer: "You can deliver without me",
};

export type PlacementDetails = {
  placementPreference: PlacementPreference | null;
  placementDetails: string | null;
  accessIssues: AccessIssue[];
  gateInstructions: string | null;
  deliveryPresence: DeliveryPresence | null;
  alternateContactName: string | null;
  alternateContactPhone: string | null;
  placementPhotoUrl: string | null;
  specialDeliveryInstructions: string | null;
};

export type PlacementSignalTone = "amber" | "blue" | "emerald" | "slate";

export type PlacementSignal = {
  key: string;
  label: string;
  tone: PlacementSignalTone;
};

export const PLACEMENT_DETAILS_MAX_LENGTH = 300;
export const GATE_INSTRUCTIONS_MAX_LENGTH = 300;
export const SPECIAL_DELIVERY_INSTRUCTIONS_MAX_LENGTH = 400;
export const ALTERNATE_CONTACT_NAME_MAX_LENGTH = 120;

function clean(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function normalizePhone(raw: string | null | undefined) {
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, 10);
  return digits || null;
}

export function sanitizeAccessIssues(input: unknown): AccessIssue[] {
  if (!Array.isArray(input)) return [];

  const normalized = input
    .map((item) => String(item ?? "").trim())
    .filter((item): item is AccessIssue =>
      (ACCESS_ISSUES as readonly string[]).includes(item),
    );

  return Array.from(new Set(normalized));
}

export function sanitizePlacementDetails(input: Partial<PlacementDetails> | Record<string, unknown>) {
  const placementPreference = (PLACEMENT_PREFERENCES as readonly string[]).includes(
    String(input.placementPreference ?? "").trim(),
  )
    ? (String(input.placementPreference).trim() as PlacementPreference)
    : null;

  const deliveryPresence = (DELIVERY_PRESENCE_OPTIONS as readonly string[]).includes(
    String(input.deliveryPresence ?? "").trim(),
  )
    ? (String(input.deliveryPresence).trim() as DeliveryPresence)
    : null;

  return {
    placementPreference,
    placementDetails: clean(input.placementDetails as string | null)?.slice(0, PLACEMENT_DETAILS_MAX_LENGTH) ?? null,
    accessIssues: sanitizeAccessIssues(input.accessIssues),
    gateInstructions: clean(input.gateInstructions as string | null)?.slice(0, GATE_INSTRUCTIONS_MAX_LENGTH) ?? null,
    deliveryPresence,
    alternateContactName:
      clean(input.alternateContactName as string | null)?.slice(0, ALTERNATE_CONTACT_NAME_MAX_LENGTH) ?? null,
    alternateContactPhone: normalizePhone(input.alternateContactPhone as string | null),
    placementPhotoUrl: clean(input.placementPhotoUrl as string | null),
    specialDeliveryInstructions:
      clean(input.specialDeliveryInstructions as string | null)?.slice(0, SPECIAL_DELIVERY_INSTRUCTIONS_MAX_LENGTH) ??
      null,
  } satisfies PlacementDetails;
}

export function validatePlacementDetails(details: PlacementDetails) {
  if (!details.placementPreference) {
    return "Choose where you want the dumpster placed.";
  }

  if (!details.deliveryPresence) {
    return "Choose your delivery presence preference.";
  }

  if (
    details.accessIssues.includes("gated_property") &&
    !details.gateInstructions
  ) {
    return "Add gate or access instructions for the driver.";
  }

  return null;
}

export function hasPlacementPhoto(details: PlacementDetails | null | undefined) {
  return !!details?.placementPhotoUrl;
}

export function hasCollectedPlacementDetails(details: PlacementDetails | null | undefined) {
  if (!details) return false;

  return Boolean(
    details.placementPreference ||
      details.placementDetails ||
      details.deliveryPresence ||
      details.accessIssues.length ||
      details.gateInstructions ||
      details.alternateContactName ||
      details.alternateContactPhone ||
      details.placementPhotoUrl ||
      details.specialDeliveryInstructions,
  );
}

export function getPlacementPreferenceLabel(value: PlacementPreference | null | undefined) {
  return value ? placementPreferenceLabel[value] : "Not provided";
}

export function getAccessIssueLabel(value: AccessIssue) {
  return accessIssueLabel[value];
}

export function getDeliveryPresenceLabel(value: DeliveryPresence | null | undefined) {
  return value ? deliveryPresenceLabel[value] : "Not provided";
}

export function getPlacementOperationalFlags(details: PlacementDetails | null | undefined) {
  return getPlacementOperationalSignals(details).map((signal) => signal.label);
}

export function getPlacementOperationalSignals(details: PlacementDetails | null | undefined) {
  if (!details) return [] as PlacementSignal[];

  const signals: PlacementSignal[] = [];

  if (details.placementPreference === "street_curb") {
    signals.push({
      key: "street-placement",
      label: "Street placement",
      tone: "amber",
    });
  }

  if (details.accessIssues.includes("street_permit_required")) {
    signals.push({
      key: "permit-risk",
      label: "Permit risk",
      tone: "amber",
    });
  }

  if (details.accessIssues.includes("gated_property")) {
    signals.push({
      key: details.gateInstructions ? "gate-code-provided" : "gate-code-needed",
      label: details.gateInstructions ? "Gate code provided" : "Gate code needed",
      tone: details.gateInstructions ? "blue" : "amber",
    });
  }

  if (details.accessIssues.includes("low_branches_wires")) {
    signals.push({
      key: "low-clearance",
      label: "Low clearance",
      tone: "amber",
    });
  }

  if (details.accessIssues.includes("soft_ground_gravel")) {
    signals.push({
      key: "soft-ground",
      label: "Soft ground",
      tone: "amber",
    });
  }

  if (details.accessIssues.includes("sloped_area")) {
    signals.push({
      key: "sloped-area",
      label: "Sloped area",
      tone: "amber",
    });
  }

  if (details.accessIssues.includes("shared_driveway")) {
    signals.push({
      key: "shared-driveway",
      label: "Shared driveway",
      tone: "blue",
    });
  }

  if (details.deliveryPresence === "customer_present") {
    signals.push({
      key: "customer-onsite",
      label: "Customer onsite",
      tone: "slate",
    });
  }

  if (details.placementPhotoUrl) {
    signals.push({
      key: "photo-provided",
      label: "Photo provided",
      tone: "emerald",
    });
  }

  if (details.placementPreference === "other" || details.accessIssues.includes("other_concern")) {
    signals.push({
      key: "custom-review",
      label: "Custom review",
      tone: "amber",
    });
  }

  return signals;
}

export function getPlacementCompactSignals(
  details: PlacementDetails | null | undefined,
  limit = 4,
) {
  return getPlacementOperationalSignals(details).slice(0, limit);
}

export function getPlacementDispatchSummary(details: PlacementDetails | null | undefined) {
  if (!hasCollectedPlacementDetails(details)) {
    return "No placement details collected";
  }

  const placementDetail = clean(details?.placementDetails) ?? getPlacementPreferenceLabel(details?.placementPreference);

  const accessSummary =
    details?.accessIssues.includes("gated_property") && details.gateInstructions
      ? "gate code provided"
      : details?.accessIssues.includes("gated_property")
        ? "gate details needed"
        : null;

  const presenceSummary =
    details?.deliveryPresence === "customer_present"
      ? "customer onsite"
      : details?.deliveryPresence === "deliver_without_customer"
        ? "no customer needed onsite"
        : null;

  return [placementDetail, accessSummary, presenceSummary].filter(Boolean).join(" • ");
}
