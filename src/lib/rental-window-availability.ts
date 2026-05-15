export const RENTAL_WINDOW_BLOCKING_RULE =
  "A delivery date is bookable only when one compatible dumpster can stay free from delivery through scheduled pickup, inclusive.";

export type RentalWindowDumpster = {
  id: string;
  label: string;
};

export type RentalWindowBlocker = {
  id: string;
  type: "booking" | "hold";
  status: string | null;
  deliveryDate: string;
  effectivePickupDate: string;
  assignedDumpsterId: string | null;
  dumpsterSize: string | null;
  dumpsterProductId: string | null;
};

export type RentalWindowDayDebug = {
  date: string;
  fixedAssignedElsewhere: number;
  unassignedBlockers: number;
  totalRequiredOnOtherDumpsters: number;
  remainingCapacityOnOtherDumpsters: number;
  feasible: boolean;
};

export type RentalWindowDumpsterDebug = {
  dumpsterId: string;
  dumpsterLabel: string;
  availableForEntireWindow: boolean;
  assignedBlockingBlockerIds: string[];
  dayChecks: RentalWindowDayDebug[];
};

export type RentalWindowAvailabilityResult = {
  requestedDeliveryDate: string;
  requestedPickupDate: string;
  totalCompatibleDumpsters: number;
  availableDumpsterIds: string[];
  availableCount: number;
  blockingRule: string;
  compatibleDumpstersConsidered: RentalWindowDumpster[];
  blockersConsidered: RentalWindowBlocker[];
  dumpsters: RentalWindowDumpsterDebug[];
};

type EvaluateRentalWindowAvailabilityInput = {
  requestedDeliveryDate: string;
  requestedPickupDate: string;
  dumpsters: RentalWindowDumpster[];
  blockers: RentalWindowBlocker[];
  excludeBlockerIds?: string[];
};

function isYmd(value: string | null | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").trim());
}

function parseYmdUtc(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function addDaysYmd(value: string, days: number) {
  const date = parseYmdUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function windowsOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA <= endB && endA >= startB;
}

function buildWindowDays(start: string, end: string) {
  const days: string[] = [];
  for (let day = start; day <= end; day = addDaysYmd(day, 1)) {
    days.push(day);
  }
  return days;
}

export function evaluateRentalWindowAvailability(
  input: EvaluateRentalWindowAvailabilityInput,
): RentalWindowAvailabilityResult {
  if (!isYmd(input.requestedDeliveryDate) || !isYmd(input.requestedPickupDate)) {
    throw new Error("Requested delivery and pickup dates must use YYYY-MM-DD.");
  }

  if (input.requestedPickupDate < input.requestedDeliveryDate) {
    throw new Error("Requested pickup date must be on or after requested delivery date.");
  }

  const excludedBlockerIds = new Set(input.excludeBlockerIds ?? []);
  const blockersConsidered = input.blockers.filter(
    (blocker) =>
      !excludedBlockerIds.has(blocker.id) &&
      isYmd(blocker.deliveryDate) &&
      isYmd(blocker.effectivePickupDate) &&
      windowsOverlap(
        blocker.deliveryDate,
        blocker.effectivePickupDate,
        input.requestedDeliveryDate,
        input.requestedPickupDate,
      ),
  );

  const windowDays = buildWindowDays(input.requestedDeliveryDate, input.requestedPickupDate);
  const compatibleDumpstersConsidered = input.dumpsters.slice();

  const dumpsters = compatibleDumpstersConsidered.map((dumpster) => {
    const assignedBlockingBlockerIds = blockersConsidered
      .filter((blocker) => blocker.assignedDumpsterId === dumpster.id)
      .map((blocker) => blocker.id);

    const dayChecks = windowDays.map((date) => {
      const blockersOnDate = blockersConsidered.filter((blocker) =>
        windowsOverlap(blocker.deliveryDate, blocker.effectivePickupDate, date, date),
      );
      const fixedAssignedElsewhere = blockersOnDate.filter(
        (blocker) => blocker.assignedDumpsterId && blocker.assignedDumpsterId !== dumpster.id,
      ).length;
      const unassignedBlockers = blockersOnDate.filter((blocker) => !blocker.assignedDumpsterId).length;
      const totalRequiredOnOtherDumpsters = fixedAssignedElsewhere + unassignedBlockers;
      const remainingCapacityOnOtherDumpsters = Math.max(
        compatibleDumpstersConsidered.length - 1 - fixedAssignedElsewhere,
        0,
      );

      return {
        date,
        fixedAssignedElsewhere,
        unassignedBlockers,
        totalRequiredOnOtherDumpsters,
        remainingCapacityOnOtherDumpsters,
        feasible: totalRequiredOnOtherDumpsters <= compatibleDumpstersConsidered.length - 1,
      };
    });

    const availableForEntireWindow =
      assignedBlockingBlockerIds.length === 0 && dayChecks.every((check) => check.feasible);

    return {
      dumpsterId: dumpster.id,
      dumpsterLabel: dumpster.label,
      availableForEntireWindow,
      assignedBlockingBlockerIds,
      dayChecks,
    };
  });

  const availableDumpsterIds = dumpsters
    .filter((dumpster) => dumpster.availableForEntireWindow)
    .map((dumpster) => dumpster.dumpsterId);

  return {
    requestedDeliveryDate: input.requestedDeliveryDate,
    requestedPickupDate: input.requestedPickupDate,
    totalCompatibleDumpsters: compatibleDumpstersConsidered.length,
    availableDumpsterIds,
    availableCount: availableDumpsterIds.length,
    blockingRule: RENTAL_WINDOW_BLOCKING_RULE,
    compatibleDumpstersConsidered,
    blockersConsidered,
    dumpsters,
  };
}
