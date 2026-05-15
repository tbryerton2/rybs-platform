import type { DumpsterServiceDateRecord, DumpsterServiceWarning } from "@/lib/admin/equipment";

function parseYmd(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day, 12);
}

export function getServiceWarningState(
  serviceDates: DumpsterServiceDateRecord[],
  todayYmd: string,
): DumpsterServiceWarning | null {
  const todayUtc = parseYmd(todayYmd);
  if (!todayUtc) return null;

  const nearestUpcoming = serviceDates
    .map((record) => record.serviceDate)
    .filter((value) => value >= todayYmd)
    .sort((left, right) => left.localeCompare(right))[0];

  if (!nearestUpcoming) return null;

  const dueUtc = parseYmd(nearestUpcoming);
  if (!dueUtc) return null;

  const daysUntil = Math.floor((dueUtc - todayUtc) / 86400000);
  if (daysUntil <= 7) {
    return {
      label: "Service due soon",
      tone: "urgent",
    };
  }

  if (daysUntil <= 30) {
    return {
      label: "Service date soon",
      tone: "soon",
    };
  }

  return null;
}
