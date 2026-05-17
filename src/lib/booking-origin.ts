export type BookingOrigin = "pricing" | "book";

export function normalizeBookingOrigin(value: string | null | undefined): BookingOrigin {
  return String(value ?? "").trim().toLowerCase() === "pricing" ? "pricing" : "book";
}

export function buildPricingBackHref(input: {
  zip?: string | null;
}) {
  const params = new URLSearchParams();
  const zip = String(input.zip ?? "").trim();

  if (zip) {
    params.set("zip", zip);
  }

  const query = params.toString();
  return query ? `/pricing?${query}` : "/pricing";
}

export function buildBookingOriginBackHref(input: {
  origin?: string | null;
  zip?: string | null;
  dumpsterSize?: string | null;
  dumpsterProductId?: string | null;
}) {
  const origin = normalizeBookingOrigin(input.origin);
  if (origin === "pricing") {
    return buildPricingBackHref(input);
  }

  const params = new URLSearchParams();
  const zip = String(input.zip ?? "").trim();
  const dumpsterSize = String(input.dumpsterSize ?? "").trim();
  const dumpsterProductId = String(input.dumpsterProductId ?? "").trim();

  if (zip) {
    params.set("zip", zip);
  }
  params.set("editing", "dumpster");
  if (dumpsterSize) {
    params.set("dumpsterSize", dumpsterSize);
  }
  if (dumpsterProductId) {
    params.set("dumpsterProductId", dumpsterProductId);
  }
  params.set("origin", "book");

  return `/book?${params.toString()}`;
}
