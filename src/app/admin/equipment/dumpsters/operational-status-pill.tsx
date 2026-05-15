import type {
  DumpsterDerivedOperationalStatus,
  DumpsterServiceWarning,
} from "@/lib/admin/equipment";

type PillSize = "default" | "header";

function pillSizeClasses(size: PillSize) {
  return size === "header"
    ? "px-4 py-1.5 text-sm"
    : "px-2.5 py-1 text-xs";
}

function statusClasses(status: DumpsterDerivedOperationalStatus) {
  switch (status) {
    case "Available":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "Scheduled":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "On rent":
      return "bg-sky-50 text-sky-700 ring-sky-200";
    case "Maintenance / unavailable":
      return "bg-rose-50 text-rose-700 ring-rose-200";
  }
}

function serviceWarningClasses(tone: DumpsterServiceWarning["tone"]) {
  return tone === "urgent"
    ? "bg-rose-50 text-rose-700 ring-rose-200"
    : "bg-amber-50 text-amber-700 ring-amber-200";
}

export function OperationalStatusPill({
  status,
  size = "default",
}: {
  status: DumpsterDerivedOperationalStatus;
  size?: PillSize;
}) {
  return (
    <span
      className={[
        "inline-flex rounded-full font-semibold ring-1 ring-inset",
        pillSizeClasses(size),
        statusClasses(status),
      ].join(" ")}
    >
      {status}
    </span>
  );
}

export function ServiceWarningPill({
  warning,
  size = "default",
}: {
  warning: DumpsterServiceWarning;
  size?: PillSize;
}) {
  return (
    <span
      className={[
        "inline-flex rounded-full font-semibold ring-1 ring-inset",
        pillSizeClasses(size),
        serviceWarningClasses(warning.tone),
      ].join(" ")}
    >
      {warning.label}
    </span>
  );
}
