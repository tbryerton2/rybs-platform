import { formatUsdFromCents } from "../money.ts";

export function formatEmailUsdFromCents(cents?: number | null) {
  if (typeof cents !== "number" || !Number.isFinite(cents)) {
    return "Not available";
  }

  return formatUsdFromCents(cents);
}
