import { NextResponse } from "next/server";
import {
  devPortalLog,
  getOptionalPortalCustomer,
  PORTAL_CUSTOMER_NOT_LINKED_ERROR,
} from "@/lib/portal/auth";
import {
  createSavedServiceLocation,
  listSavedServiceLocations,
  validateSavedServiceLocationForSave,
} from "@/lib/service-locations";

export async function GET() {
  try {
    const customer = await getOptionalPortalCustomer();
    if (!customer) {
      return NextResponse.json({ ok: false, error: "Portal login required." }, { status: 401 });
    }

    devPortalLog("portal_locations_list", {
      customerId: customer.customerId,
      authUserId: customer.authUserId,
    });

    const locations = await listSavedServiceLocations(customer.customerId);
    return NextResponse.json({ ok: true, locations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to load saved locations.";
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

export async function POST(req: Request) {
  try {
    const customer = await getOptionalPortalCustomer();
    console.log("[portal-locations][POST][customer]", customer);
    if (!customer) {
      return NextResponse.json({ ok: false, error: "Portal login required." }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const validation = await validateSavedServiceLocationForSave(body);

    if (!validation.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: validation.formError,
          fieldErrors: validation.fieldErrors,
        },
        { status: 400 },
      );
    }

    devPortalLog("portal_locations_create", {
      customerId: customer.customerId,
      authUserId: customer.authUserId,
      email: customer.email,
    });

    console.log("[portal-locations][POST][about-to-create]", {
      customerId: customer?.customerId,
      authUserId: customer?.authUserId,
      legacyId: customer?.id,
    });

    const location = await createSavedServiceLocation(customer.customerId, validation.data);

    return NextResponse.json({ ok: true, location }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to save location.";
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
