import { NextResponse } from "next/server";
import {
  buildFleetEquipmentServiceDateInsert,
  FLEET_EQUIPMENT_SERVICE_DATE_SELECT,
  mapFleetEquipmentServiceDateRowToRecord,
  validateFleetEquipmentServiceDateInput,
  type FleetEquipmentServiceDateInput,
  type FleetEquipmentServiceDateRow,
} from "@/lib/admin/fleet-equipment-service-dates";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CreateServiceDateBody = {
  serviceDate?: FleetEquipmentServiceDateInput;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from("fleet_equipment_service_dates")
      .select(FLEET_EQUIPMENT_SERVICE_DATE_SELECT)
      .eq("fleet_equipment_id", id)
      .order("service_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      serviceDates: ((data ?? []) as FleetEquipmentServiceDateRow[]).map(mapFleetEquipmentServiceDateRowToRecord),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load service dates." },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as CreateServiceDateBody;
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
      .insert(buildFleetEquipmentServiceDateInsert(id, serviceDate))
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
      { ok: false, error: error instanceof Error ? error.message : "Could not create service date." },
      { status: 500 },
    );
  }
}
