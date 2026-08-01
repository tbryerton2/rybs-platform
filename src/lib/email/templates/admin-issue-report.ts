type AdminIssueReportEmailInput = {
  customerName?: string | null;
  customerEmail?: string | null;
  bookingId: string;
  issueCategory?: string | null;
  urgency?: string | null;
  description: string;
  preferredContactMethod?: string | null;
  serviceAddress?: string | null;
  adminUrl?: string | null;
};

function formatLabel(value?: string | null) {
  if (!value) return "Not provided";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function buildAdminIssueReportEmail({
  customerName,
  customerEmail,
  bookingId,
  issueCategory,
  urgency,
  description,
  preferredContactMethod,
  serviceAddress,
  adminUrl,
}: AdminIssueReportEmailInput) {
  const urgencyLabel = formatLabel(urgency);
  const subject = `Customer issue reported: ${urgencyLabel}`;

  const text = `
A customer submitted an issue report from the Tan Can Man portal.

Customer: ${customerName ?? "Not provided"}
Email: ${customerEmail ?? "Not provided"}
Booking ID: ${bookingId}
Service address: ${serviceAddress ?? "Not provided"}

Issue type: ${formatLabel(issueCategory)}
Urgency: ${urgencyLabel}
Preferred contact method: ${formatLabel(preferredContactMethod)}

Description:
${description}

${adminUrl ? `Review in admin: ${adminUrl}` : ""}
`.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h1 style="margin-bottom: 16px;">Customer issue reported</h1>

      <p>A customer submitted an issue report from the Tan Can Man portal.</p>

      <h2 style="font-size: 18px; margin-top: 20px;">Customer</h2>
      <table style="border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Name:</td>
          <td style="padding: 6px 0;">${customerName ?? "Not provided"}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Email:</td>
          <td style="padding: 6px 0;">${customerEmail ?? "Not provided"}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Booking ID:</td>
          <td style="padding: 6px 0;">${bookingId}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Service address:</td>
          <td style="padding: 6px 0;">${serviceAddress ?? "Not provided"}</td>
        </tr>
      </table>

      <h2 style="font-size: 18px; margin-top: 20px;">Issue</h2>
      <table style="border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Issue type:</td>
          <td style="padding: 6px 0;">${formatLabel(issueCategory)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Urgency:</td>
          <td style="padding: 6px 0;">${urgencyLabel}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Preferred contact:</td>
          <td style="padding: 6px 0;">${formatLabel(preferredContactMethod)}</td>
        </tr>
      </table>

      <h2 style="font-size: 18px; margin-top: 20px;">Description</h2>
      <p style="white-space: pre-wrap;">${description}</p>

      ${
        adminUrl
          ? `<p style="margin-top: 20px;"><a href="${adminUrl}">Review portal requests in admin</a></p>`
          : ""
      }
    </div>
  `.trim();

  return {
    subject,
    text,
    html,
  };
}