type FormatUsdOptions = {
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
};

function buildUsdFormatter(options?: FormatUsdOptions) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    ...options,
  });
}

export function centsToDollars(valueInCents: number | null | undefined) {
  if (typeof valueInCents !== "number" || !Number.isFinite(valueInCents)) return null;
  return valueInCents / 100;
}

export function formatUsd(
  valueInDollars: number | null | undefined,
  options?: FormatUsdOptions,
) {
  if (typeof valueInDollars !== "number" || !Number.isFinite(valueInDollars)) return "—";
  return buildUsdFormatter(options).format(valueInDollars);
}

export function formatUsdFromCents(
  valueInCents: number | null | undefined,
  options?: FormatUsdOptions,
) {
  return formatUsd(centsToDollars(valueInCents), options);
}
