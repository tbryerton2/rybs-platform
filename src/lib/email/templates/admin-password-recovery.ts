type AdminPasswordRecoveryEmailInput = {
  businessName: string;
  resetUrl: string;
  supportEmail?: string | null;
  supportPhone?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildAdminPasswordRecoveryEmail({
  businessName,
  resetUrl,
  supportEmail,
  supportPhone,
}: AdminPasswordRecoveryEmailInput) {
  const subject = `Reset your ${businessName} admin password`;
  const supportLine = supportEmail
    ? `If you did not request this reset, you can ignore this email or contact us at ${supportEmail}.`
    : supportPhone
      ? `If you did not request this reset, you can ignore this email or contact us at ${supportPhone}.`
      : "If you did not request this reset, you can ignore this email.";
  const escapedBusinessName = escapeHtml(businessName);
  const escapedResetUrl = escapeHtml(resetUrl);
  const escapedSupportLine = escapeHtml(supportLine);

  const text = `
Use this secure link to reset your ${businessName} admin password:

${resetUrl}

This link expires soon and can only be used once.

${supportLine}
`.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h1 style="margin-bottom: 16px;">Reset your ${escapedBusinessName} admin password</h1>
      <p>Use this secure link to choose a new admin password.</p>
      <p style="margin: 24px 0;">
        <a href="${escapedResetUrl}" style="display: inline-block; border-radius: 8px; background: #111827; color: #ffffff; padding: 12px 18px; text-decoration: none; font-weight: bold;">
          Reset password
        </a>
      </p>
      <p>This link expires soon and can only be used once.</p>
      <p>${escapedSupportLine}</p>
    </div>
  `.trim();

  return {
    subject,
    text,
    html,
  };
}
