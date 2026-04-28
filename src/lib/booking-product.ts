export const DEFAULT_DUMPSTER_SIZE = "14 yard";
export const DEFAULT_DUMPSTER_PRODUCT_ID = "default";

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
