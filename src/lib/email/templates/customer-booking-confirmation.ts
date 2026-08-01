import { formatEmailUsdFromCents } from "../currency.ts";

type CustomerBookingConfirmationEmailInput = {
  customerName: string;
  bookingId: string;
  dumpsterSize?: string | null;
  deliveryDate?: string | null;
  pickupDate?: string | null;
  serviceAddress: string;
  totalPriceCents?: number | null;
};

export function buildCustomerBookingConfirmationEmail({
  customerName,
  bookingId,
  dumpsterSize,
  deliveryDate,
  pickupDate,
  serviceAddress,
  totalPriceCents,
}: CustomerBookingConfirmationEmailInput) {
  const subject = "Your Tan Can Man booking is confirmed";

  const text = `
Hi ${customerName},

Thanks for booking with Tan Can Man. Your dumpster rental has been confirmed.

Booking ID: ${bookingId}
Dumpster: ${dumpsterSize ?? "Dumpster rental"}
Delivery date: ${deliveryDate ?? "Not selected"}
Pickup date: ${pickupDate ?? "Not selected"}
Service address: ${serviceAddress}
Total: ${formatEmailUsdFromCents(totalPriceCents)}

If you have any questions, reply to this email and we’ll help.

Thank you,
Tan Can Man
`.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h1 style="margin-bottom: 16px;">Your booking is confirmed</h1>

      <p>Hi ${customerName},</p>

      <p>Thanks for booking with Tan Can Man. Your dumpster rental has been confirmed.</p>

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

      <p style="margin-top: 20px;">If you have any questions, reply to this email and we’ll help.</p>

      <p>Thank you,<br />Tan Can Man</p>
    </div>
  `.trim();

  return {
    subject,
    text,
    html,
  };
}
