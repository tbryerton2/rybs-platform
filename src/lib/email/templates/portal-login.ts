type PortalLoginEmailInput = {
  businessName: string;
  loginUrl: string;
  supportEmail?: string | null;
  supportPhone?: string | null;
};

export function buildPortalLoginEmail({
  businessName,
  loginUrl,
  supportEmail,
  supportPhone,
}: PortalLoginEmailInput) {
  const subject = `Sign in to your ${businessName} portal`;
  const supportLine = supportEmail
    ? `If you did not request this link, you can ignore this email or contact us at ${supportEmail}.`
    : supportPhone
      ? `If you did not request this link, you can ignore this email or contact us at ${supportPhone}.`
      : "If you did not request this link, you can ignore this email.";

  const text = `
Use this secure link to sign in to your ${businessName} customer portal:

${loginUrl}

This link expires soon and can only be used once.

${supportLine}
`.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h1 style="margin-bottom: 16px;">Sign in to your ${businessName} portal</h1>
      <p>Use this secure link to access your customer portal.</p>
      <p style="margin: 24px 0;">
        <a href="${loginUrl}" style="display: inline-block; border-radius: 8px; background: #111827; color: #ffffff; padding: 12px 18px; text-decoration: none; font-weight: bold;">
          Open customer portal
        </a>
      </p>
      <p>This link expires soon and can only be used once.</p>
      <p>${supportLine}</p>
    </div>
  `.trim();

  return {
    subject,
    text,
    html,
  };
}
