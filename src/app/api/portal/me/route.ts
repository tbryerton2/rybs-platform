import { NextResponse } from "next/server";
import { getOptionalPortalCustomer, PORTAL_CUSTOMER_NOT_LINKED_ERROR } from "@/lib/portal/auth";

export async function GET() {
  try {
    const customer = await getOptionalPortalCustomer();

    if (!customer) {
      return NextResponse.json({ ok: false, error: "Portal login required." }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        primaryStreet: customer.primary_street,
        primaryCity: customer.primary_city,
        primaryState: customer.primary_state,
        primaryZip: customer.primary_zip,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to load portal customer.";

    if (message === PORTAL_CUSTOMER_NOT_LINKED_ERROR) {
      return NextResponse.json(
        {
          ok: false,
          error: "Your portal account is not linked to a customer record yet. Please contact support so we can finish setting up your account.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
