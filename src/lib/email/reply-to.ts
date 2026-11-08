/** Explicit customer contact configuration; syntax checks do not verify inbox ownership. */
export function isSuitableTenantReplyToEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase();
  if (!email || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)) {
    return null;
  }

  const [localPart, domain] = email.split("@");
  if (
    localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..") ||
    /^(?:no[._-]?reply|do[._-]?not[._-]?reply)(?:\+.*)?$/.test(localPart) ||
    ["example.com", "example.net", "example.org", "test.com"].includes(domain) ||
    /\.(?:example|invalid|local|test)$/.test(domain)
  ) return null;

  return email;
}

export function resolveTenantReplyToEmail(input: {
  identityReplyToEmail?: string | null;
  supportEmail?: string | null;
}) {
  return isSuitableTenantReplyToEmail(input.identityReplyToEmail) ??
    isSuitableTenantReplyToEmail(input.supportEmail);
}

export function requireTenantReplyToEmail(value: string | null | undefined) {
  const email = isSuitableTenantReplyToEmail(value);
  if (!email) {
    throw new Error("Customer email delivery paused: configure a valid tenant Reply-To or support email.");
  }
  return email;
}
