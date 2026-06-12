import { NextResponse } from "next/server";
import { requireAdminOwnerForApi } from "@/lib/admin/auth";
import {
  buildDumpsterInsert,
  mapDumpsterRowToRecord,
  validateDumpsterRecord,
  DUMPSTER_SELECT,
  getNextDumpsterEquipmentIdFromValues,
  getDumpsterEquipmentIdConflictMessage,
  type DumpsterRow,
} from "@/lib/admin/dumpster-inventory-shared";
import { decorateDumpstersWithOperationalStatus } from "@/lib/admin/dumpster-operational-status";
import type { DumpsterRecord } from "@/lib/admin/equipment";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CreateDumpsterBody = {
  dumpster?: DumpsterRecord;
};

export async function POST(req: Request) {
  try {
    const adminAuth = await requireAdminOwnerForApi();
    if (!adminAuth.ok) return adminAuth.response;

    const body = (await req.json().catch(() => ({}))) as CreateDumpsterBody;
    const dumpster = body.dumpster;

    if (!dumpster) {
      return NextResponse.json({ ok: false, error: "Missing dumpster payload." }, { status: 400 });
    }

    const fieldErrors = validateDumpsterRecord(dumpster);
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { ok: false, error: "Please review the dumpster form.", fieldErrors },
        { status: 400 },
      );
    }

    const { data: equipmentRows, error: equipmentError } = await supabaseAdmin
      .from("dumpsters")
      .select("equipment_id")
      .eq("business_id", adminAuth.session.business.id);

    if (equipmentError) {
      return NextResponse.json({ ok: false, error: equipmentError.message }, { status: 400 });
    }

    const nextEquipmentId = getNextDumpsterEquipmentIdFromValues(
      ((equipmentRows ?? []) as Array<{ equipment_id: string | null }>).map((row) => row.equipment_id ?? ""),
    );
    const createRecord = { ...dumpster, equipmentId: nextEquipmentId };

    const { data, error } = await supabaseAdmin
      .from("dumpsters")
      .insert({
        ...buildDumpsterInsert(createRecord),
        business_id: adminAuth.session.business.id,
      })
      .select(DUMPSTER_SELECT)
      .single<DumpsterRow>();

    if (error) {
      return NextResponse.json(
        { ok: false, error: getDumpsterEquipmentIdConflictMessage(error) ?? error.message },
        { status: 400 },
      );
    }

    const [savedDumpster] = await decorateDumpstersWithOperationalStatus([
      mapDumpsterRowToRecord(data),
    ]);

    return NextResponse.json({
      ok: true,
      dumpster: savedDumpster,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Dumpster create failed." },
      { status: 500 },
    );
  }
}
