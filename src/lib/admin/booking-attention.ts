import type { PickupPlanningModel } from "@/lib/pickup-planning";

export type BookingAttentionTone = "none" | "caution" | "at_risk" | "high_risk";

export type BookingAttentionState = {
  rowAlertTone: BookingAttentionTone;
  rowAlertLabel: string | null;
  rowAlertSummary: string | null;
  needsAttention: boolean;
  daysOnSite: number | null;
  isOverdueConfirmed: boolean;
  isOverduePickup: boolean;
};

function parseYmd(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function evaluateBookingAttention(input: {
  status: string | null | undefined;
  deliveryDate: string | null | undefined;
  pickupPlanning: PickupPlanningModel;
  todayYmd: string;
}) : BookingAttentionState {
  const status = (input.status ?? "").toLowerCase();
  const isCompleted = status === "picked_up";
  const isCancelled = status === "cancelled";
  const overdueDelivery = Boolean(
    input.deliveryDate && input.deliveryDate < input.todayYmd && ["confirmed", "paid", "scheduled"].includes(status),
  );
  const missingDelivery = !input.deliveryDate && ["confirmed", "paid", "scheduled"].includes(status);

  let rowAlertTone: BookingAttentionTone = "none";
  let rowAlertLabel: string | null = null;
  let rowAlertSummary: string | null = null;

  if (!isCompleted && !isCancelled) {
    if (overdueDelivery) {
      rowAlertTone = "high_risk";
      rowAlertLabel = "High risk";
      rowAlertSummary = "delivery date has passed without completion";
    } else if (missingDelivery) {
      rowAlertTone = "at_risk";
      rowAlertLabel = "Needs review";
      rowAlertSummary = "delivery date is missing";
    } else if (input.pickupPlanning.risk === "high_risk") {
      rowAlertTone = "high_risk";
      rowAlertLabel = "High risk";
      rowAlertSummary = "no confirmed return before expected availability";
    } else if (input.pickupPlanning.risk === "at_risk") {
      rowAlertTone = "at_risk";
      rowAlertLabel = "At risk";
      rowAlertSummary = "upcoming delivery depends on return timing";
    } else if (
      input.pickupPlanning.risk === "caution" &&
      (status === "delivered" || input.pickupPlanning.pickupStatus === "requested")
    ) {
      rowAlertTone = "caution";
      rowAlertLabel = "Caution";
      rowAlertSummary =
        input.pickupPlanning.pickupStatus === "requested"
          ? "awaiting pickup confirmation"
          : "pickup not scheduled yet";
    }
  }

  const pickupDueDate =
    input.pickupPlanning.pickupStatus === "scheduled"
      ? input.pickupPlanning.scheduledPickupDate
      : input.pickupPlanning.expectedAvailableDate;
  const isOverduePickup = Boolean(status === "delivered" && pickupDueDate && pickupDueDate < input.todayYmd);
  const isOverdueConfirmed = Boolean(
    input.deliveryDate && input.deliveryDate < input.todayYmd && ["confirmed", "scheduled"].includes(status),
  );
  const daysOnSite =
    status === "delivered" && input.deliveryDate
      ? Math.max(
          0,
          Math.floor((parseYmd(input.todayYmd).getTime() - parseYmd(input.deliveryDate).getTime()) / 86400000),
        )
      : null;
  const unresolvedPickupRequest = input.pickupPlanning.pickupStatus === "requested" && status === "delivered";
  const needsAttention =
    rowAlertTone !== "none" ||
    isOverdueConfirmed ||
    isOverduePickup ||
    (unresolvedPickupRequest && daysOnSite !== null && daysOnSite >= 3);

  return {
    rowAlertTone,
    rowAlertLabel,
    rowAlertSummary,
    needsAttention,
    daysOnSite,
    isOverdueConfirmed,
    isOverduePickup,
  };
}
