export type CustomerNameInput = {
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerName?: string | null;
};

export type CustomerNameParts = {
  customerFirstName: string | null;
  customerLastName: string | null;
};

export function cleanCustomerNamePart(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export function combineCustomerNameParts(
  customerFirstName: string | null | undefined,
  customerLastName: string | null | undefined,
) {
  const fullName = [cleanCustomerNamePart(customerFirstName), cleanCustomerNamePart(customerLastName)]
    .filter(Boolean)
    .join(" ");

  return fullName || null;
}

export function formatCustomerName(
  customerFirstName: string | null | undefined,
  customerLastName: string | null | undefined,
  fallback = "—",
) {
  return combineCustomerNameParts(customerFirstName, customerLastName) ?? fallback;
}

export function splitCustomerName(customerName: string | null | undefined): CustomerNameParts {
  const fullName = cleanCustomerNamePart(customerName);
  if (!fullName) return { customerFirstName: null, customerLastName: null };

  const [firstName, ...lastNameParts] = fullName.split(/\s+/);

  return {
    customerFirstName: firstName || null,
    customerLastName: lastNameParts.join(" ") || null,
  };
}

export function resolveCustomerName(input: CustomerNameInput) {
  const explicitFirstName = cleanCustomerNamePart(input.customerFirstName);
  const explicitLastName = cleanCustomerNamePart(input.customerLastName);

  if (explicitFirstName || explicitLastName) {
    return {
      customerFirstName: explicitFirstName,
      customerLastName: explicitLastName,
      customerFullName: combineCustomerNameParts(explicitFirstName, explicitLastName),
    };
  }

  const fallbackFullName = cleanCustomerNamePart(input.customerName);
  const fallbackParts = splitCustomerName(fallbackFullName);

  return {
    ...fallbackParts,
    customerFullName:
      combineCustomerNameParts(fallbackParts.customerFirstName, fallbackParts.customerLastName) ?? fallbackFullName,
  };
}
