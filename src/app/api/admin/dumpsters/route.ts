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

type CreateDumpsterBody = {
  dumpster?: DumpsterRecord;
};

export async function POST(req: Request) {
  try {
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

    const { data, error } = await supabaseAdmin
      .from("dumpsters")
      .insert(buildDumpsterInsert(dumpster))
      .select(DUMPSTER_SELECT)
      .single<DumpsterRow>();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      dumpster: mapDumpsterRowToRecord(data),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Dumpster create failed." },
      { status: 500 },
    );
  }
}
