import { NextResponse } from "next/server";
import {
  DUMPSTER_SELECT,
  type DumpsterRow,
  buildDumpsterInsert,
  mapDumpsterRowToRecord,
  validateDumpsterRecord,
} from "@/lib/admin/dumpster-inventory";
import type { DumpsterRecord } from "@/lib/admin/equipment";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UpdateDumpsterBody = {
  dumpster?: DumpsterRecord;
  active?: boolean;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as UpdateDumpsterBody;

    if (body.dumpster) {
      const fieldErrors = validateDumpsterRecord(body.dumpster);
      if (Object.keys(fieldErrors).length > 0) {
        return NextResponse.json(
          { ok: false, error: "Please review the dumpster form.", fieldErrors },
          { status: 400 },
        );
      }

      const { data, error } = await supabaseAdmin
        .from("dumpsters")
        .update(buildDumpsterInsert(body.dumpster))
        .eq("id", id)
        .select(DUMPSTER_SELECT)
        .single<DumpsterRow>();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        dumpster: mapDumpsterRowToRecord(data),
      });
    }

    if (typeof body.active === "boolean") {
      const { data, error } = await supabaseAdmin
        .from("dumpsters")
        .update({ active: body.active })
        .eq("id", id)
        .select(DUMPSTER_SELECT)
        .single<DumpsterRow>();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        dumpster: mapDumpsterRowToRecord(data),
      });
    }

    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Dumpster update failed." },
      { status: 500 },
    );
  }
}
