import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

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

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const awsRegion = getRequiredEnv("AWS_REGION");
const fromEmail = getRequiredEnv("SES_FROM_EMAIL");
const defaultReplyToEmail = process.env.SES_REPLY_TO_EMAIL;

const sesClientsByRegion = new Map<string, SESClient>();

function getSesClient(region = awsRegion) {
  const normalizedRegion = region.trim() || awsRegion;
  const existing = sesClientsByRegion.get(normalizedRegion);
  if (existing) return existing;

  const client = new SESClient({
    region: normalizedRegion,
    credentials: {
      accessKeyId: getRequiredEnv("AWS_ACCESS_KEY_ID"),
      secretAccessKey: getRequiredEnv("AWS_SECRET_ACCESS_KEY"),
    },
  });
  sesClientsByRegion.set(normalizedRegion, client);
  return client;
}

function clean(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function quoteDisplayName(value: string) {
  return `"${value.replace(/[\r\n]+/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function formatSesSourceAddress(input: {
  fromEmail: string;
  fromDisplayName?: string | null;
}) {
  const displayName = clean(input.fromDisplayName);
  return displayName ? `${quoteDisplayName(displayName)} <${input.fromEmail}>` : input.fromEmail;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  fromEmail: inputFromEmail,
  fromDisplayName,
  region,
  useDefaultReplyTo = true,
}: SendEmailInput) {
  const recipients = Array.isArray(to) ? to : [to];
  const senderEmail = clean(inputFromEmail) ?? fromEmail;
  const replyToAddress = replyTo === null
    ? null
    : clean(replyTo) ?? (useDefaultReplyTo ? defaultReplyToEmail : null);

  const command = new SendEmailCommand({
    Source: formatSesSourceAddress({
      fromEmail: senderEmail,
      fromDisplayName,
    }),
    Destination: {
      ToAddresses: recipients,
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: "UTF-8",
      },
      Body: {
        Html: {
          Data: html,
          Charset: "UTF-8",
        },
        Text: {
          Data: text,
          Charset: "UTF-8",
        },
      },
    },
    ReplyToAddresses: replyToAddress ? [replyToAddress] : undefined,
  });

  return getSesClient(clean(region) ?? awsRegion).send(command);
}
