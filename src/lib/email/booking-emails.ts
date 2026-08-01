import { buildAdminNewBookingEmail } from "@/lib/email/templates/admin-new-booking";
import { buildCustomerBookingConfirmationEmail } from "@/lib/email/templates/customer-booking-confirmation";
import { sendEmail } from "@/lib/email/ses";

type BookingEmailInput = {
  bookingId: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  dumpsterSize?: string | null;
  deliveryDate?: string | null;
  pickupDate?: string | null;
  serviceAddress: string;
  totalPriceCents?: number | null;
  adminBookingUrl?: string | null;
};

export async function sendBookingEmails(input: BookingEmailInput) {
  const adminEmail = process.env.ADMIN_BOOKING_EMAIL;

  if (!adminEmail) {
    throw new Error("Missing ADMIN_BOOKING_EMAIL environment variable.");
  }

  const emailJobs: Promise<unknown>[] = [];

  if (input.customerEmail) {
    const customerEmail = buildCustomerBookingConfirmationEmail(input);

    emailJobs.push(
      sendEmail({
        to: input.customerEmail,
        subject: customerEmail.subject,
        text: customerEmail.text,
        html: customerEmail.html,
      }),
    );
  }

  const adminNotification = buildAdminNewBookingEmail(input);

  emailJobs.push(
    sendEmail({
      to: adminEmail,
      subject: adminNotification.subject,
      text: adminNotification.text,
      html: adminNotification.html,
    }),
  );

  await Promise.all(emailJobs);
}