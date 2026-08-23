import { formatEmailUsdFromCents } from "../currency.ts";

type CustomerBookingConfirmationEmailInput = {
  businessName: string;
  supportEmail?: string | null;
  supportPhone?: string | null;
  customerName: string;
  bookingId: string;
  dumpsterSize?: string | null;
  deliveryDate?: string | null;
  pickupDate?: string | null;
  serviceAddress: string;
  totalPriceCents?: number | null;
};

export function buildCustomerBookingConfirmationEmail({
  businessName,
  supportEmail,
  supportPhone,
  customerName,
  bookingId,
  dumpsterSize,
  deliveryDate,
  pickupDate,
  serviceAddress,
  totalPriceCents,
}: CustomerBookingConfirmationEmailInput) {
  const subject = `Your ${businessName} booking is confirmed`;
  const supportLine = supportEmail
    ? `If you have any questions, reply to this email or contact us at ${supportEmail}.`
    : supportPhone
      ? `If you have any questions, call or text us at ${supportPhone}.`
      : "If you have any questions, reply to this email and we’ll help.";

  const text = `
Hi ${customerName},

Thanks for booking with ${businessName}. Your dumpster rental has been confirmed.

Booking ID: ${bookingId}
Dumpster: ${dumpsterSize ?? "Dumpster rental"}
Delivery date: ${deliveryDate ?? "Not selected"}
Pickup date: ${pickupDate ?? "Not selected"}
Service address: ${serviceAddress}
Total: ${formatEmailUsdFromCents(totalPriceCents)}

${supportLine}

Thank you,
${businessName}
`.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h1 style="margin-bottom: 16px;">Your booking is confirmed</h1>

      <p>Hi ${customerName},</p>

      <p>Thanks for booking with ${businessName}. Your dumpster rental has been confirmed.</p>

      <table style="border-collapse: collapse; margin-top: 16px;">
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Booking ID:</td>
          <td style="padding: 6px 0;">${bookingId}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Dumpster:</td>
          <td style="padding: 6px 0;">${dumpsterSize ?? "Dumpster rental"}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Delivery date:</td>
          <td style="padding: 6px 0;">${deliveryDate ?? "Not selected"}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Pickup date:</td>
          <td style="padding: 6px 0;">${pickupDate ?? "Not selected"}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Service address:</td>
          <td style="padding: 6px 0;">${serviceAddress}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Total:</td>
          <td style="padding: 6px 0;">${formatEmailUsdFromCents(totalPriceCents)}</td>
        </tr>
      </table>

      <p style="margin-top: 20px;">${supportLine}</p>

      <p>Thank you,<br />${businessName}</p>
    </div>
  `.trim();

  return {
    subject,
    text,
    html,
  };
}
