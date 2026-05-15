export const DEFAULT_DUMPSTER_SIZE = "14 yard";
export const DEFAULT_DUMPSTER_PRODUCT_ID = "default";

export function getDumpsterSizeCapacity(value: string | number | null | undefined) {
  const match = String(value ?? "").trim().match(/^(\d+)/);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function formatDumpsterSizeFromCapacity(value: string | number | null | undefined) {
  const capacity = getDumpsterSizeCapacity(value);
  return capacity ? `${capacity} yard` : null;
}

function normalizeText(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

export function resolveSelectedDumpster(input?: {
  dumpsterSize?: string | null;
  dumpsterProductId?: string | null;
}) {
  return {
    dumpsterSize: normalizeText(input?.dumpsterSize) ?? DEFAULT_DUMPSTER_SIZE,
    dumpsterProductId:
      normalizeText(input?.dumpsterProductId) ?? DEFAULT_DUMPSTER_PRODUCT_ID,
  };
}
