export const dynamic = "force-dynamic";
export const revalidate = 0;

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { AdminToastTrigger } from "@/app/admin/_components/admin/admin-toast-trigger";
import { InteractiveInfoPopover } from "@/app/admin/customers/[id]/interactive-info-popover";
import { AddZipForm } from "./add-zip-form";
import { ZipList } from "./zip-list";

type ServiceZipRow = {
  id: number;
  zip: string;
  active: boolean;
  county: string | null;
  town: string | null;
  state: string | null;
  price_14_yard_override: number | null;
};

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
    .select("id, zip, active, county, town, state, price_14_yard_override" as string)
    .order("zip", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as ServiceZipRow[];

  return (
    <AdminPage>
      <AdminPageHeader
        className="lg:flex-row lg:items-end lg:justify-between"
        title={
          <span className="inline-flex items-center gap-2">
            <span>Service Area</span>
            <InteractiveInfoPopover
              label="About Service Area"
              body="Manage ZIP codes where the business accepts bookings."
            />
          </span>
        }
        actions={<AddZipForm compact />}
      />

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

      <ZipList rows={rows} />
    </AdminPage>
  );
}
