type QueuedBookingMessage = {
  id: string;
  business_id: string | null;
  booking_id: string;
  booking_charge_id: string | null;
  channel: string;
  to: string | null;
  subject: string | null;
  body: string | null;
  status: string;
  provider: string | null;
  provider_message_id: string | null;
  template: string | null;
};

type SupabaseError = {
  message: string;
};

type SelectQuery = PromiseLike<{
  data: QueuedBookingMessage[] | null;
  error: SupabaseError | null;
}> & {
  eq(column: string, value: unknown): SelectQuery;
  limit(count: number): SelectQuery;
};

type UpdateQuery = PromiseLike<{
  data: unknown;
  error: SupabaseError | null;
}> & {
  eq(column: string, value: unknown): UpdateQuery;
};

type SupabaseClient = {
  from(table: string): {
    select(columns: string): SelectQuery;
    update(values: Record<string, unknown>): UpdateQuery;
  };
};

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  fromEmail?: string;
  fromDisplayName?: string | null;
  region?: string | null;
  useDefaultReplyTo?: boolean;
};

type SendEmailResult = {
  messageId: string | null;
};

type QueuedTenantEmailSender = {
  senderDisplayName: string;
  senderEmail: string;
  replyToEmail: string | null;
  sesRegion: string | null;
};

export type ProcessMessagesOptions = {
  supabase?: SupabaseClient;
  messageId?: string;
  sendSesEmail?: (input: SendEmailInput) => Promise<unknown>;
  resolveTenantEmailSender?: (businessId: string) => Promise<QueuedTenantEmailSender>;
  now?: () => Date;
};

const POST_BOOKING_CHARGE_RECEIPT_TEMPLATE = "post_booking_charge_paid";

function truncateError(value: unknown) {
  const message = value instanceof Error ? value.message : typeof value === "string" ? value : "Email send failed.";
  return message.replace(/\s+/g, " ").trim().slice(0, 500) || "Email send failed.";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textToHtml(value: string) {
  return `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827; white-space: pre-wrap;">${escapeHtml(value)}</div>`;
}

function getSesMessageId(result: unknown) {
  if (!result || typeof result !== "object") return null;
  const output = result as {
    MessageId?: string | null;
    messageId?: string | null;
    $metadata?: { requestId?: string | null };
  };
  return output.MessageId ?? output.messageId ?? output.$metadata?.requestId ?? null;
}

function isPostBookingChargeReceipt(message: QueuedBookingMessage) {
  return Boolean(
    message.booking_charge_id &&
      message.template === POST_BOOKING_CHARGE_RECEIPT_TEMPLATE,
  );
}

async function defaultSendSesEmail(input: SendEmailInput) {
  const { sendEmail } = await import("../email/ses.ts");
  return sendEmail(input);
}

async function defaultResolveTenantEmailSender(businessId: string): Promise<QueuedTenantEmailSender> {
  const { resolveTenantEmailSender } = await import("../email/tenant-sender.ts");
  const sender = await resolveTenantEmailSender({ businessId });

  return {
    senderDisplayName: sender.senderDisplayName,
    senderEmail: sender.senderEmail,
    replyToEmail: sender.replyToEmail,
    sesRegion: sender.sesRegion,
  };
}

async function getDefaultSupabase() {
  const { supabaseAdmin } = await import("../supabaseAdmin.ts");
  return supabaseAdmin as unknown as SupabaseClient;
}

async function updateMessageStatus(
  supabase: SupabaseClient,
  id: string,
  businessId: string | null,
  values: Record<string, unknown>,
) {
  let query = supabase
    .from("booking_messages")
    .update(values)
    .eq("id", id);

  if (businessId) {
    query = query.eq("business_id", businessId);
  }

  return query;
}

async function updateLinkedChargeReceiptStatus(
  supabase: SupabaseClient,
  message: QueuedBookingMessage,
  values: Record<string, unknown>,
) {
  if (!isPostBookingChargeReceipt(message)) return;

  let query = supabase
    .from("booking_charges")
    .update(values)
    .eq("id", message.booking_charge_id as string);

  if (message.business_id) {
    query = query.eq("business_id", message.business_id);
  }

  await query;
}

async function sendQueuedMessage(
  message: QueuedBookingMessage,
  options: Required<Pick<ProcessMessagesOptions, "sendSesEmail" | "resolveTenantEmailSender">>,
): Promise<SendEmailResult> {
  const toEmail = (message.to ?? "").trim();
  const subject = (message.subject ?? "").trim() || "Booking update";
  const body = (message.body ?? "").trim();
  const provider = (message.provider ?? "ses").trim().toLowerCase();

  if (!message.business_id) {
    throw new Error("Tenant email sender requires queued message business_id.");
  }

  if (provider && !["ses", "amazon_ses", "resend"].includes(provider)) {
    throw new Error(`Unsupported queued email provider: ${provider}`);
  }

  const sender = await options.resolveTenantEmailSender(message.business_id);
  const result = await options.sendSesEmail({
    to: toEmail,
    subject,
    text: body,
    html: textToHtml(body),
    fromEmail: sender.senderEmail,
    fromDisplayName: sender.senderDisplayName,
    replyTo: sender.replyToEmail,
    region: sender.sesRegion,
    useDefaultReplyTo: false,
  });

  return { messageId: getSesMessageId(result) };
}

export async function processQueuedBookingMessages(options: ProcessMessagesOptions = {}) {
  const supabase = options.supabase ?? (await getDefaultSupabase());
  const sendSesEmail = options.sendSesEmail ?? defaultSendSesEmail;
  const resolveTenantEmailSender = options.resolveTenantEmailSender ?? defaultResolveTenantEmailSender;
  const now = options.now ?? (() => new Date());

  let query = supabase
    .from("booking_messages")
    .select(
      "id, business_id, booking_id, booking_charge_id, channel, to, subject, body, status, provider, provider_message_id, template",
    )
    .eq("status", "queued")
    .eq("channel", "email");

  if (options.messageId) {
    query = query.eq("id", options.messageId);
  }

  const { data: messages, error } = await query.limit(options.messageId ? 1 : 10);

  if (error) {
    return { ok: false, error: error.message, status: 500, processed: 0 };
  }

  if (!messages || messages.length === 0) {
    return { ok: true, processed: 0 };
  }

  let processed = 0;

  for (const message of messages as QueuedBookingMessage[]) {
    const toEmail = (message.to ?? "").trim();
    const body = (message.body ?? "").trim();

    if (!toEmail || !body) {
      const failedAt = now().toISOString();
      const errorMessage = !toEmail ? "Missing recipient email" : "Missing email body";

      await updateMessageStatus(supabase, message.id, message.business_id ?? null, {
        status: "failed",
        error: errorMessage,
      });
      await updateLinkedChargeReceiptStatus(supabase, message, {
        customer_receipt_email_status: "failed",
        customer_receipt_email_sent_at: null,
        customer_receipt_email_failed_at: failedAt,
        customer_receipt_email_error: errorMessage,
      });
      continue;
    }

    try {
      const sentAt = now().toISOString();
      const result = await sendQueuedMessage(message, { sendSesEmail, resolveTenantEmailSender });

      await updateMessageStatus(supabase, message.id, message.business_id ?? null, {
        status: "sent",
        sent_at: sentAt,
        provider: "ses",
        provider_message_id: result.messageId,
        error: null,
      });
      await updateLinkedChargeReceiptStatus(supabase, message, {
        customer_receipt_email_status: "sent",
        customer_receipt_email_sent_at: sentAt,
        customer_receipt_email_failed_at: null,
        customer_receipt_email_error: null,
      });

      processed += 1;
    } catch (sendErr: unknown) {
      const failedAt = now().toISOString();
      const errorMessage = truncateError(sendErr);

      await updateMessageStatus(supabase, message.id, message.business_id ?? null, {
        status: "failed",
        error: errorMessage,
      });
      await updateLinkedChargeReceiptStatus(supabase, message, {
        customer_receipt_email_status: "failed",
        customer_receipt_email_sent_at: null,
        customer_receipt_email_failed_at: failedAt,
        customer_receipt_email_error: errorMessage,
      });
    }
  }

  return { ok: true, processed };
}
