export function parseCustomerBulletPoints(value?: string | null) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function cleanProductDescription(value: string | null | undefined) {
  return value === "Draft defaults based on the current global pricing fallback." ? "" : value ?? "";
}
