export const dynamic = "force-dynamic";
export const revalidate = 0;

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { AdminToastTrigger } from "@/app/admin/_components/admin/admin-toast-trigger";
import { AddZipForm } from "./add-zip-form";
import { ZipList } from "./zip-list";

type ServiceZipRow = {
  id: number;
  zip: string;
  active: boolean;
  county: string | null;
  town: string | null;
  price_14_yard_override: number | null;
};

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>
    </div>
  );
}

type SearchParams = Record<string, string | string[] | undefined>;

function sp(obj: SearchParams, key: string) {
  const value = obj[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminServiceAreaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const addedZip = sp(resolvedSearchParams, "added");
  const deletedZip = sp(resolvedSearchParams, "deleted");
  const toggled = sp(resolvedSearchParams, "toggled");

  const { data, error } = await supabaseAdmin
    .from("service_area_zips")
    .select("id, zip, active, county, town, price_14_yard_override")
    .order("zip", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ServiceZipRow[];

  const totalCount = rows.length;
  const activeCount = rows.filter((row) => row.active).length;
  const disabledCount = totalCount - activeCount;

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Service Area
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage ZIP codes where the business accepts bookings.
        </p>
      </div>

      <AdminToastTrigger
        success={addedZip ? `ZIP ${addedZip} added successfully.` : null}
        trigger={addedZip}
        clearParam="added"
      />

      <AdminToastTrigger
        success={deletedZip ? `ZIP ${deletedZip} deleted successfully.` : null}
        trigger={deletedZip}
        clearParam="deleted"
      />

      <AdminToastTrigger
        success={
          toggled
            ? (() => {
                const [zip, action] = toggled.split(":");
                return `ZIP ${zip} ${action}.`;
              })()
            : null
        }
        trigger={toggled}
        clearParam="toggled"
      />


      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total ZIP codes" value={totalCount} />
        <StatCard label="Active ZIP codes" value={activeCount} />
        <StatCard label="Disabled ZIP codes" value={disabledCount} />
      </div>

      <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Add ZIP code</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add a new service ZIP. New ZIP codes are active by default.
          </p>
        </div>

        <AddZipForm />
      </div>

      <ZipList rows={rows} />
    </div>
  );
}
