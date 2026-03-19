import { getDefaultRentalDays } from "@/lib/config";

export type PickupStatus = "scheduled" | "requested" | "not_scheduled";
export type AvailabilityRisk = "none" | "caution" | "at_risk" | "high_risk";

export type PickupPlanningModel = {
  pickupStatus: PickupStatus;
  pickupStatusLabel: string;
  scheduledPickupDate: string | null;
  expectedAvailableDate: string | null;
  expectedAvailabilityHelper: string | null;
  risk: AvailabilityRisk;
  riskLabel: string | null;
  riskMessage: string | null;
  nextDeliveryDate: string | null;
};

function isYmd(value: string | null | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").trim());
}

function addDaysYmd(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function compareYmd(a: string, b: string) {
  return a.localeCompare(b);
}

export function getAvailabilityRiskClasses(risk: AvailabilityRisk) {
  switch (risk) {
    case "high_risk":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "at_risk":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "caution":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

// Inventory is still planned from a pooled fleet, not assigned dumpster units.
// We use the nearest upcoming delivery as a practical v1 dependency heuristic.
export function buildPickupPlanningModel(input: {
  deliveryDate?: string | null;
  pickupDate?: string | null;
  pickupMode?: string | null;
  futureDeliveryDates?: string[];
  defaultRentalDays?: number;
}): PickupPlanningModel {
  const deliveryDate = isYmd(input.deliveryDate) ? String(input.deliveryDate) : null;
  const pickupDate = isYmd(input.pickupDate) ? String(input.pickupDate) : null;
  const futureDeliveryDates = (input.futureDeliveryDates ?? [])
    .filter(isYmd)
    .sort(compareYmd)
    .filter((date) => (deliveryDate ? compareYmd(date, deliveryDate) > 0 : true));
  const defaultRentalDays = input.defaultRentalDays ?? getDefaultRentalDays();
  const scheduledPickupDate = input.pickupMode === "schedule" ? pickupDate : null;

  const pickupStatus: PickupStatus =
    input.pickupMode === "schedule" && scheduledPickupDate
      ? "scheduled"
      : input.pickupMode === "request"
        ? "requested"
        : "not_scheduled";

  const expectedAvailableDate =
    !scheduledPickupDate
      ? pickupDate ?? (deliveryDate ? addDaysYmd(deliveryDate, defaultRentalDays) : null)
      : null;

  const nextDeliveryDate = futureDeliveryDates[0] ?? null;

  let risk: AvailabilityRisk = "none";
  let riskLabel: string | null = null;
  let riskMessage: string | null = null;

  if (!scheduledPickupDate) {
    risk = "caution";
    riskLabel = "Caution";
    riskMessage =
      pickupStatus === "requested"
        ? "Pickup has been requested but not confirmed. Availability is still forecasted from the standard rental window."
        : "No pickup is scheduled yet. Availability is still forecasted from the standard rental window.";

    if (expectedAvailableDate && nextDeliveryDate) {
      const oneDayAfterExpected = addDaysYmd(expectedAvailableDate, 1);

      if (compareYmd(nextDeliveryDate, expectedAvailableDate) <= 0) {
        risk = "high_risk";
        riskLabel = "High risk";
        riskMessage = "An upcoming delivery overlaps or leaves no confirmed return before this dumpster is expected back.";
      } else if (compareYmd(nextDeliveryDate, oneDayAfterExpected) <= 0) {
        risk = "at_risk";
        riskLabel = "At risk";
        riskMessage = "Another upcoming delivery may depend on this dumpster before pickup is confirmed.";
      }
    }
  }

  return {
    pickupStatus,
    pickupStatusLabel:
      pickupStatus === "scheduled"
        ? "Scheduled"
        : pickupStatus === "requested"
          ? "Requested, not scheduled"
          : "Awaiting customer request",
    scheduledPickupDate,
    expectedAvailableDate,
    expectedAvailabilityHelper: expectedAvailableDate
      ? `Based on the standard ${defaultRentalDays}-day rental assumption`
      : null,
    risk,
    riskLabel,
    riskMessage,
    nextDeliveryDate,
  };
}
