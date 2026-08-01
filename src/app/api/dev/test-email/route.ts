import { NextResponse } from "next/server";

import { sendEmail } from "@/lib/email/ses";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Test email route is disabled in production." },
      { status: 404 },
    );
  }

  const adminEmail = process.env.ADMIN_BOOKING_EMAIL;

  if (!adminEmail) {
    return NextResponse.json(
      { error: "Missing ADMIN_BOOKING_EMAIL environment variable." },
      { status: 500 },
    );
  }

  await sendEmail({
    to: adminEmail,
    subject: "Tan Can Man app email test",
    text: "This is a test email sent from the Tan Can Man app using Amazon SES.",
    html: `
      <div>
        <h1>Tan Can Man app email test</h1>
        <p>This is a test email sent from the Tan Can Man app using Amazon SES.</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}