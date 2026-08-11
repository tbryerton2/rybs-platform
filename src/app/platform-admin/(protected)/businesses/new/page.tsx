import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { CreateBusinessForm } from "./create-business-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CreatePlatformBusinessPage() {
  return (
    <AdminPage width="standard" className="space-y-6 pt-2">
      <div>
        <Link
          href="/platform-admin/businesses"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Businesses
        </Link>
      </div>

      <AdminPageHeader
        eyebrow="Platform"
        title="Create business"
        description="Create the tenant record and only the minimum settings needed to identify the business safely."
      />

      <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
        <CreateBusinessForm />
      </section>
    </AdminPage>
  );
}
