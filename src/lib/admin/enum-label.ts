const DEFAULT_ENUM_LABELS: Record<string, string> = {
  active: "Active",
  cancelled: "Cancelled",
  confirmed: "Confirmed",
  deactivated: "Deactivated",
  delivered: "Delivered",
  inactive: "Inactive",
  invited: "Invited",
  maintenance: "Maintenance",
  paid: "Paid",
  picked_up: "Picked up",
  retired: "Retired",
  scheduled: "Scheduled",
};

type FormatEnumLabelOptions = {
  fallback?: string;
  labels?: Record<string, string>;
};

function normalizeEnumKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function titleCaseEnumKey(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatEnumLabel(
  value: string | null | undefined,
  options: FormatEnumLabelOptions = {},
) {
  const normalized = value ? normalizeEnumKey(value) : "";
  if (!normalized) return options.fallback ?? "Unknown";

  return options.labels?.[normalized] ?? DEFAULT_ENUM_LABELS[normalized] ?? titleCaseEnumKey(normalized);
}
