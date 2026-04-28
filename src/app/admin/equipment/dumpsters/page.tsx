export const dynamic = "force-dynamic";
export const revalidate = 0;

import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { type DumpsterRow, DUMPSTER_SELECT, mapDumpsterRowToRecord } from "@/lib/admin/dumpster-inventory";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DumpstersClient } from "./dumpsters-client";

async function getDumpsters() {
  const { data, error } = await supabaseAdmin
    .from("dumpsters")
    .select(DUMPSTER_SELECT)
    .order("active", { ascending: false })
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DumpsterRow[]).map(mapDumpsterRowToRecord);
}

export default async function AdminDumpstersPage() {
  const dumpsters = await getDumpsters();

  return (
    <AdminPage width="wide">
      <AdminPageHeader title="Dumpsters" description="Manage active container inventory, service readiness, and tracker coverage." />
      <DumpstersClient initialDumpsters={dumpsters} />
    </AdminPage>
  );
}
