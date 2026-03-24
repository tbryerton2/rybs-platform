import { NextResponse } from "next/server";
import {
  devPortalLog,
  getOptionalPortalCustomer,
  PORTAL_CUSTOMER_NOT_LINKED_ERROR,
} from "@/lib/portal/auth";
import {
  deleteSavedServiceLocation,
  setDefaultSavedServiceLocation,
  updateSavedServiceLocation,
  validateSavedServiceLocationForSave,
} from "@/lib/service-locations";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const customer = await getOptionalPortalCustomer();
    if (!customer) {
      return NextResponse.json({ ok: false, error: "Portal login required." }, { status: 401 });
    }

    const { id } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (body.action === "set-default") {
      devPortalLog("portal_locations_set_default", {
        customerId: customer.customerId,
        authUserId: customer.authUserId,
        locationId: id,
      });

      const location = await setDefaultSavedServiceLocation(customer.customerId, id);
      return NextResponse.json({ ok: true, location });
    }

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

    devPortalLog("portal_locations_update", {
      customerId: customer.customerId,
      authUserId: customer.authUserId,
      locationId: id,
    });

    const location = await updateSavedServiceLocation(customer.customerId, id, validation.data);
    return NextResponse.json({ ok: true, location });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to update location.";
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

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const customer = await getOptionalPortalCustomer();
    if (!customer) {
      return NextResponse.json({ ok: false, error: "Portal login required." }, { status: 401 });
    }

    const { id } = await context.params;
    devPortalLog("portal_locations_delete", {
      customerId: customer.customerId,
      authUserId: customer.authUserId,
      locationId: id,
    });

    const result = await deleteSavedServiceLocation(customer.customerId, id);
    return NextResponse.json({ ok: true, deletedId: result.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to delete location.";
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
