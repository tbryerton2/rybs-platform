export type PortalStage =
  | "booked"
  | "confirmed"
  | "scheduled"
  | "out_for_delivery"
  | "delivered"
  | "pickup_requested"
  | "pickup_scheduled"
  | "picked_up"
  | "completed"
  | "cancelled";

export type PortalRental = {
  status: string | null;
  pickup_mode?: string | null;
  pickup_date?: string | null;
  hasOpenPickupRequest?: boolean;
  hasScheduledPickupRequest?: boolean;
};

export function getPortalStage(booking: PortalRental): PortalStage {
  const status = (booking.status ?? "").trim().toLowerCase();

  if (status === "cancelled") return "cancelled";
  if (status === "picked_up") return "completed";

  if (status === "delivered") {
    if (booking.hasScheduledPickupRequest) return "pickup_scheduled";
    if (booking.hasOpenPickupRequest) return "pickup_requested";
    if (booking.pickup_mode === "request") return "pickup_requested";
    if (booking.pickup_date) return "pickup_scheduled";
    return "delivered";
  }

  if (status === "scheduled") return "scheduled";
  if (status === "confirmed") return "confirmed";

  return "booked";
}

export function getPortalStageLabel(stage: PortalStage) {
  switch (stage) {
    case "booked":
      return "Booked";
    case "confirmed":
      return "Confirmed";
    case "scheduled":
      return "Scheduled";
    case "out_for_delivery":
      return "Out for delivery";
    case "delivered":
      return "Delivered";
    case "pickup_requested":
      return "Pickup requested";
    case "pickup_scheduled":
      return "Pickup scheduled";
    case "picked_up":
      return "Picked up";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

export function getPortalStageTone(stage: PortalStage) {
  switch (stage) {
    case "completed":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "pickup_requested":
    case "pickup_scheduled":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "delivered":
    case "scheduled":
    case "confirmed":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "cancelled":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

const orderedStages: PortalStage[] = [
  "booked",
  "confirmed",
  "scheduled",
  "delivered",
  "pickup_requested",
  "pickup_scheduled",
  "completed",
];

export function getTimelineStages(currentStage: PortalStage) {
  if (currentStage === "cancelled") {
    return [
      { key: "booked" as PortalStage, label: getPortalStageLabel("booked"), state: "complete" as const },
      { key: "cancelled" as PortalStage, label: getPortalStageLabel("cancelled"), state: "current" as const },
    ];
  }

  const currentIndex = orderedStages.indexOf(currentStage);
  const resolvedIndex = currentIndex === -1 ? 0 : currentIndex;

  return orderedStages.map((stage, index) => ({
    key: stage,
    label: getPortalStageLabel(stage),
    state:
      index < resolvedIndex ? ("complete" as const) : index === resolvedIndex ? ("current" as const) : ("upcoming" as const),
  }));
}

export function getNextPortalAction(stage: PortalStage) {
  switch (stage) {
    case "booked":
    case "confirmed":
      return "We are preparing your delivery details.";
    case "scheduled":
      return "Your rental is scheduled. We will confirm delivery timing next.";
    case "delivered":
      return "When you're done, request pickup from this rental page.";
    case "pickup_requested":
      return "We received your pickup request and will confirm the schedule.";
    case "pickup_scheduled":
      return "Your pickup is scheduled. Keep the driveway accessible.";
    case "completed":
      return "This rental is complete. You can review past jobs anytime.";
    case "cancelled":
      return "This rental was cancelled. Contact support if you need help rebooking.";
    default:
      return "Check your rental details for the latest update.";
  }
}
