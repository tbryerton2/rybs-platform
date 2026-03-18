export function isPortalSchemaError(errorLike: { message?: string | null } | string | null | undefined) {
  const message =
    typeof errorLike === "string" ? errorLike : typeof errorLike?.message === "string" ? errorLike.message : "";
  const normalized = message.toLowerCase();

  return (
    normalized.includes("does not exist") ||
    normalized.includes("schema cache") ||
    normalized.includes("could not find the") ||
    normalized.includes("has no column") ||
    normalized.includes("of relation") ||
    (normalized.includes("column") && normalized.includes("not found"))
  );
}
