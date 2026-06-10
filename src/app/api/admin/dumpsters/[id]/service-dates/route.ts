import { NextResponse } from "next/server";
import { requireAdminOwnerForApi } from "@/lib/admin/auth";
import {
  buildDumpsterServiceDateInsert,
  DUMPSTER_SERVICE_DATE_SELECT,
  mapDumpsterServiceDateRowToRecord,
  validateDumpsterServiceDateInput,
  type DumpsterServiceDateInput,
  type DumpsterServiceDateRow,
} from "@/lib/admin/dumpster-service-dates";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CreateServiceDateBody = {
  serviceDate?: DumpsterServiceDateInput;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminAuth = await requireAdminOwnerForApi();
    if (!adminAuth.ok) return adminAuth.response;

    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from("dumpster_service_dates")
      .select(DUMPSTER_SERVICE_DATE_SELECT)
      .eq("dumpster_id", id)
      .order("service_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      serviceDates: ((data ?? []) as DumpsterServiceDateRow[]).map(mapDumpsterServiceDateRowToRecord),
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
    const adminAuth = await requireAdminOwnerForApi();
    if (!adminAuth.ok) return adminAuth.response;

    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as CreateServiceDateBody;
    const serviceDate = body.serviceDate;

    if (!serviceDate) {
      return NextResponse.json({ ok: false, error: "Missing service date payload." }, { status: 400 });
    }

    const validationError = validateDumpsterServiceDateInput(serviceDate);
    if (validationError) {
      return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("dumpster_service_dates")
      .insert(buildDumpsterServiceDateInsert(id, serviceDate))
      .select(DUMPSTER_SERVICE_DATE_SELECT)
      .single<DumpsterServiceDateRow>();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      serviceDate: mapDumpsterServiceDateRowToRecord(data),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not create service date." },
      { status: 500 },
    );
  }
}
