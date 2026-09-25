type AdminUserInviteEmailInput = {
  businessName: string;
  inviteUrl: string;
  roleLabel: string;
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

export function buildAdminUserInviteEmail({
  businessName,
  inviteUrl,
  roleLabel,
  supportEmail,
  supportPhone,
}: AdminUserInviteEmailInput) {
  const subject = `You're invited to ${businessName} admin`;
  const supportLine = supportEmail
    ? `If you were not expecting this invitation, contact ${supportEmail}.`
    : supportPhone
      ? `If you were not expecting this invitation, contact ${supportPhone}.`
      : "If you were not expecting this invitation, you can ignore this email.";
  const escapedBusinessName = escapeHtml(businessName);
  const escapedInviteUrl = escapeHtml(inviteUrl);
  const escapedRoleLabel = escapeHtml(roleLabel);
  const escapedSupportLine = escapeHtml(supportLine);

  const text = `
You've been invited to ${businessName} admin as ${roleLabel}.

Accept the invitation:
${inviteUrl}

This secure link expires soon and can only be used once.

${supportLine}
`.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h1 style="margin-bottom: 16px;">You're invited to ${escapedBusinessName} admin</h1>
      <p>You've been invited as <strong>${escapedRoleLabel}</strong>.</p>
      <p style="margin: 24px 0;">
        <a href="${escapedInviteUrl}" style="display: inline-block; border-radius: 8px; background: #111827; color: #ffffff; padding: 12px 18px; text-decoration: none; font-weight: bold;">
          Accept invitation
        </a>
      </p>
      <p>This secure link expires soon and can only be used once.</p>
      <p>${escapedSupportLine}</p>
    </div>
  `.trim();

  return {
    subject,
    text,
    html,
  };
}
