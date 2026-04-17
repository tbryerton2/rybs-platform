export const RECENTLY_CREATED_DATE_PRESET = "last_7_days";

const LAST_7_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function getRecentlyCreatedWindow(now = new Date()) {
  return {
    start: new Date(now.getTime() - LAST_7_DAYS_MS),
    end: now,
  };
}

export function isRecentlyCreated(createdAt: string | null | undefined, now = new Date()) {
  if (!createdAt) return false;

  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  const { start, end } = getRecentlyCreatedWindow(now);
  return created.getTime() >= start.getTime() && created.getTime() <= end.getTime();
}
