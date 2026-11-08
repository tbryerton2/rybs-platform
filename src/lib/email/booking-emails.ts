import { buildAdminNewBookingEmail } from "@/lib/email/templates/admin-new-booking";
import { buildCustomerBookingConfirmationEmail } from "@/lib/email/templates/customer-booking-confirmation";
import { sendEmail as defaultSendEmail } from "@/lib/email/ses";
import { resolveTenantEmailSender, tenantSenderSendEmailOptions } from "@/lib/email/tenant-sender";
import { getTenantCommunicationSettings } from "@/lib/tenant/communications";
import type { TenantRecord } from "@/lib/tenant/server";

type BookingEmailInput = {
  tenant: TenantRecord;
  requestContext?: {
    host?: string | null;
    protocol?: string | null;
  };
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

type BookingEmailDependencies = {
  getCommunicationSettings?: typeof getTenantCommunicationSettings;
  resolveSender?: typeof resolveTenantEmailSender;
  sendEmail?: typeof defaultSendEmail;
};

export async function sendBookingEmails(input: BookingEmailInput, deps: BookingEmailDependencies = {}) {
  const getCommunicationSettings = deps.getCommunicationSettings ?? getTenantCommunicationSettings;
  const resolveSender = deps.resolveSender ?? resolveTenantEmailSender;
  const sendEmail = deps.sendEmail ?? defaultSendEmail;
  const communication = await getCommunicationSettings(input.tenant, input.requestContext);
  const sender = await resolveSender({
    tenant: input.tenant,
    businessName: communication.businessName,
    supportEmail: communication.supportEmail,
  });
  const senderOptions = tenantSenderSendEmailOptions(sender);
  const adminBookingUrl =
    input.adminBookingUrl ??
    (communication.publicBaseUrl ? `${communication.publicBaseUrl}/admin/bookings` : null);

  const emailJobs: Promise<unknown>[] = [];
  const templateInput = {
    ...input,
    businessName: communication.businessName,
    supportEmail: senderOptions.replyTo,
    supportPhone: communication.supportPhone,
    adminBookingUrl,
  };

  if (input.customerEmail) {
    const customerEmail = buildCustomerBookingConfirmationEmail(templateInput);

    emailJobs.push(
      sendEmail({
        to: input.customerEmail,
        subject: customerEmail.subject,
        text: customerEmail.text,
        html: customerEmail.html,
        ...senderOptions,
      }),
    );
  }

  if (communication.bookingNotificationRecipients.length === 0) {
    console.warn("[booking-emails] skipped internal booking notification: no tenant recipient configured", {
      businessId: input.tenant.id,
      tenantSlug: input.tenant.slug,
      bookingId: input.bookingId,
    });
  } else {
    const adminNotification = buildAdminNewBookingEmail(templateInput);

    emailJobs.push(
      sendEmail({
        to: communication.bookingNotificationRecipients,
        subject: adminNotification.subject,
        text: adminNotification.text,
        html: adminNotification.html,
        ...senderOptions,
      }),
    );
  }

  await Promise.all(emailJobs);
}
