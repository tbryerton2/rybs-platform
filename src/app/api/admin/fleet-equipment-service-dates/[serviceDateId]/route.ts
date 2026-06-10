import { NextResponse } from "next/server";
import { requireAdminOwnerForApi } from "@/lib/admin/auth";
import {
  FLEET_EQUIPMENT_SERVICE_DATE_SELECT,
  mapFleetEquipmentServiceDateRowToRecord,
  validateFleetEquipmentServiceDateInput,
  type FleetEquipmentServiceDateInput,
  type FleetEquipmentServiceDateRow,
} from "@/lib/admin/fleet-equipment-service-dates";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UpdateServiceDateBody = {
  serviceDate?: FleetEquipmentServiceDateInput;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ serviceDateId: string }> },
) {
  try {
    const adminAuth = await requireAdminOwnerForApi();
    if (!adminAuth.ok) return adminAuth.response;

    const { serviceDateId } = await params;
    const body = (await req.json().catch(() => ({}))) as UpdateServiceDateBody;
    const serviceDate = body.serviceDate;

    if (!serviceDate) {
      return NextResponse.json({ ok: false, error: "Missing service date payload." }, { status: 400 });
    }

    const validationError = validateFleetEquipmentServiceDateInput(serviceDate);
    if (validationError) {
      return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("fleet_equipment_service_dates")
      .update({
        service_date: serviceDate.serviceDate,
        service_type: serviceDate.serviceType,
        notes: serviceDate.notes.trim() || null,
      })
      .eq("id", serviceDateId)
      .select(FLEET_EQUIPMENT_SERVICE_DATE_SELECT)
      .single<FleetEquipmentServiceDateRow>();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      serviceDate: mapFleetEquipmentServiceDateRowToRecord(data),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not update service date." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ serviceDateId: string }> },
) {
  try {
    const adminAuth = await requireAdminOwnerForApi();
    if (!adminAuth.ok) return adminAuth.response;

    const { serviceDateId } = await params;

    const { error } = await supabaseAdmin
      .from("fleet_equipment_service_dates")
      .delete()
      .eq("id", serviceDateId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not delete service date." },
      { status: 500 },
    );
  }
}
