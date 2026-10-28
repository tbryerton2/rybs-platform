export type FinancialRangePreset = "7d" | "30d" | "month" | "all" | "custom";

export function isValidFinancialDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function customDateRangeError(start: string, end: string): string | null {
  if (!isValidFinancialDate(start) || !isValidFinancialDate(end)) {
    return "Choose valid From and To dates.";
  }
  return end < start ? "To date must be on or after From date." : null;
}

export function resolveFinancialDateRange(
  requestedPreset: string | undefined,
  start: string | undefined,
  end: string | undefined,
  today: string,
): { preset: FinancialRangePreset; start: string; end: string } {
  if (start || end) {
    if (start && end && !customDateRangeError(start, end)) {
      return { preset: "custom", start, end };
    }
    // Invalid or incomplete URLs must not broaden the report to all time.
    return { preset: "month", start: `${today.slice(0, 7)}-01`, end: today };
  }
  if (requestedPreset === "all") return { preset: "all", start: "", end: "" };
  if (requestedPreset === "7d" || requestedPreset === "30d") {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (requestedPreset === "7d" ? 6 : 29));
    return { preset: requestedPreset, start: date.toISOString().slice(0, 10), end: today };
  }
  return { preset: "month", start: `${today.slice(0, 7)}-01`, end: today };
}
