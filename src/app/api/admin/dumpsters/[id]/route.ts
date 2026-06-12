import { NextResponse } from "next/server";
import { requireAdminOwnerForApi } from "@/lib/admin/auth";
import {
  buildDumpsterInsert,
  mapDumpsterRowToRecord,
  validateDumpsterRecord,
  DUMPSTER_SELECT,
  getDumpsterEquipmentIdConflictMessage,
  type DumpsterRow,
} from "@/lib/admin/dumpster-inventory-shared";
import { decorateDumpstersWithOperationalStatus } from "@/lib/admin/dumpster-operational-status";
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
    const adminAuth = await requireAdminOwnerForApi();
    if (!adminAuth.ok) return adminAuth.response;

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
        .update({
          ...buildDumpsterInsert(body.dumpster),
          business_id: adminAuth.session.business.id,
        })
        .eq("id", id)
        .eq("business_id", adminAuth.session.business.id)
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
    }

    if (typeof body.active === "boolean") {
      const { data, error } = await supabaseAdmin
        .from("dumpsters")
        .update({ active: body.active, business_id: adminAuth.session.business.id })
        .eq("id", id)
        .eq("business_id", adminAuth.session.business.id)
        .select(DUMPSTER_SELECT)
        .single<DumpsterRow>();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }

      const [savedDumpster] = await decorateDumpstersWithOperationalStatus([
        mapDumpsterRowToRecord(data),
      ]);

      return NextResponse.json({
        ok: true,
        dumpster: savedDumpster,
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminAuth = await requireAdminOwnerForApi();
    if (!adminAuth.ok) return adminAuth.response;

    const { id } = await params;

    const { count, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", adminAuth.session.business.id)
      .eq("dumpster_id", id);

    if (bookingError) {
      return NextResponse.json({ ok: false, error: bookingError.message }, { status: 400 });
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This dumpster cannot be deleted because it is connected to existing bookings. Deactivate it instead.",
        },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("dumpsters")
      .delete()
      .eq("id", id)
      .eq("business_id", adminAuth.session.business.id);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error.message.includes("foreign key") || error.message.includes("constraint")
              ? "This dumpster cannot be deleted because it is connected to existing bookings. Deactivate it instead."
              : error.message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Dumpster delete failed." },
      { status: 500 },
    );
  }
}
