const BUSINESS_TIME_ZONE = "America/New_York";

export function formatDateET(value: string | Date | null | undefined) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: "medium",
  }).format(date);
}

export function formatTimeET(value: string | Date | null | undefined) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    timeStyle: "short",
  }).format(date);
}

export function formatDateTimeET(value: string | Date | null | undefined) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDateTimeLabelET(value: string | Date | null | undefined) {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);

  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  const month = lookup.get("month") ?? "";
  const day = lookup.get("day") ?? "";
  const year = lookup.get("year") ?? "";
  const hour = lookup.get("hour") ?? "";
  const minute = lookup.get("minute") ?? "";
  const dayPeriod = lookup.get("dayPeriod") ?? "";

  return `${month} ${day}, ${year}, ${hour}:${minute} ${dayPeriod}`.trim();
}

export function formatShortDateET(value: string | Date | null | undefined) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatInputDateET(value: string | Date | null | undefined) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getBusinessTimeZone() {
  return BUSINESS_TIME_ZONE;
}
