type DetailValue = string | number | boolean | null | undefined;

type AdminPortalRequestEmailInput = {
  requestType: string;
  customerName?: string | null;
  customerEmail?: string | null;
  bookingId: string;
  priority?: string | null;
  serviceAddress?: string | null;
  details: Record<string, DetailValue>;
  adminUrl?: string | null;
};

function formatLabel(value?: string | null) {
  if (!value) return "Not provided";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatValue(value: DetailValue) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value === null || value === undefined || value === "") return "Not provided";

  return String(value);
}

function buildDetailsText(details: Record<string, DetailValue>) {
  return Object.entries(details)
    .map(([key, value]) => `${formatLabel(key)}: ${formatValue(value)}`)
    .join("\n");
}

function buildDetailsHtml(details: Record<string, DetailValue>) {
  return Object.entries(details)
    .map(
      ([key, value]) => `
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">${formatLabel(key)}:</td>
          <td style="padding: 6px 0; white-space: pre-wrap;">${formatValue(value)}</td>
        </tr>
      `,
    )
    .join("");
}

export function buildAdminPortalRequestEmail({
  requestType,
  customerName,
  customerEmail,
  bookingId,
  priority,
  serviceAddress,
  details,
  adminUrl,
}: AdminPortalRequestEmailInput) {
  const requestTypeLabel = formatLabel(requestType);
  const priorityLabel = formatLabel(priority);
  const subject = `New portal request: ${requestTypeLabel}`;

  const text = `
A customer submitted a portal request.

Request type: ${requestTypeLabel}
Priority: ${priorityLabel}

Customer: ${customerName ?? "Not provided"}
Email: ${customerEmail ?? "Not provided"}
Booking ID: ${bookingId}
Service address: ${serviceAddress ?? "Not provided"}

Details:
${buildDetailsText(details)}

${adminUrl ? `Review in admin: ${adminUrl}` : ""}
`.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h1 style="margin-bottom: 16px;">New portal request</h1>

      <p>A customer submitted a portal request.</p>

      <h2 style="font-size: 18px; margin-top: 20px;">Request</h2>
      <table style="border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Type:</td>
          <td style="padding: 6px 0;">${requestTypeLabel}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Priority:</td>
          <td style="padding: 6px 0;">${priorityLabel}</td>
        </tr>
      </table>

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

      <h2 style="font-size: 18px; margin-top: 20px;">Details</h2>
      <table style="border-collapse: collapse;">
        ${buildDetailsHtml(details)}
      </table>

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