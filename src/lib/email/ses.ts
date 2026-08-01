import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
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

const sesClient = new SESClient({
  region: awsRegion,
  credentials: {
    accessKeyId: getRequiredEnv("AWS_ACCESS_KEY_ID"),
    secretAccessKey: getRequiredEnv("AWS_SECRET_ACCESS_KEY"),
  },
});

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: SendEmailInput) {
  const recipients = Array.isArray(to) ? to : [to];
  const replyToAddress = replyTo ?? defaultReplyToEmail;

  const command = new SendEmailCommand({
    Source: fromEmail,
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

  return sesClient.send(command);
}