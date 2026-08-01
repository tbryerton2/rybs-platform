import { formatEmailUsdFromCents } from "../currency.ts";

type AdminNewBookingEmailInput = {
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  bookingId: string;
  dumpsterSize?: string | null;
  deliveryDate?: string | null;
  pickupDate?: string | null;
  serviceAddress: string;
  totalPriceCents?: number | null;
  adminBookingUrl?: string | null;
};

export function buildAdminNewBookingEmail({
  customerName,
  customerEmail,
  customerPhone,
  bookingId,
  dumpsterSize,
  deliveryDate,
  pickupDate,
  serviceAddress,
  totalPriceCents,
  adminBookingUrl,
}: AdminNewBookingEmailInput) {
  const subject = `New Tan Can Man booking: ${customerName}`;

  const text = `
New Tan Can Man booking received.

Customer: ${customerName}
Email: ${customerEmail ?? "Not provided"}
Phone: ${customerPhone ?? "Not provided"}

Booking ID: ${bookingId}
Dumpster: ${dumpsterSize ?? "Dumpster rental"}
Delivery date: ${deliveryDate ?? "Not selected"}
Pickup date: ${pickupDate ?? "Not selected"}
Service address: ${serviceAddress}
Total: ${formatEmailUsdFromCents(totalPriceCents)}

${adminBookingUrl ? `View booking: ${adminBookingUrl}` : ""}
`.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h1 style="margin-bottom: 16px;">New Tan Can Man booking</h1>

      <h2 style="font-size: 18px; margin-top: 20px;">Customer</h2>
      <table style="border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Name:</td>
          <td style="padding: 6px 0;">${customerName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Email:</td>
          <td style="padding: 6px 0;">${customerEmail ?? "Not provided"}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Phone:</td>
          <td style="padding: 6px 0;">${customerPhone ?? "Not provided"}</td>
        </tr>
      </table>

      <h2 style="font-size: 18px; margin-top: 20px;">Booking</h2>
      <table style="border-collapse: collapse;">
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

      ${
        adminBookingUrl
          ? `<p style="margin-top: 20px;"><a href="${adminBookingUrl}">View booking in admin</a></p>`
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
