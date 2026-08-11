import BookPageClient from "./book-page-client";
import { redirect } from "next/navigation";
import { sanitizeZip } from "@/lib/pricing";
import { getPublicDumpsterProducts } from "@/lib/dumpster-product-settings";
import { getActiveServiceAreaZip } from "@/lib/service-area";
import { getBookingEntryContent } from "@/lib/tenant/content";
import { getCurrentTenant } from "@/lib/tenant/server";

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams?: Promise<{
    zip?: string;
    dumpsterSize?: string;
    dumpsterProductId?: string;
    origin?: string;
    editing?: string;
  }>;
}) {
  const sp = await searchParams;
  const zip = sanitizeZip(sp?.zip);
  const zipValid = zip.length === 5;
  const isEditingDumpster = sp?.editing === "dumpster";
  const tenant = await getCurrentTenant();

  if (!zipValid) {
    redirect("/book/address");
  }

  const [entryContent, products, serviceAreaZip] = await Promise.all([
    getBookingEntryContent({ tenantId: tenant.id }),
    getPublicDumpsterProducts(zip, tenant.id),
    zipValid ? getActiveServiceAreaZip(zip, tenant.id) : Promise.resolve(null),
  ]);

  const blocked = zipValid && !serviceAreaZip;

  if (blocked) {
    redirect(`/book/address?zip=${encodeURIComponent(zip)}`);
  }

  if ((sp?.dumpsterSize || sp?.dumpsterProductId) && zipValid && !isEditingDumpster) {
    const params = new URLSearchParams({ zip });
    if (sp?.dumpsterSize) {
      params.set("dumpsterSize", sp.dumpsterSize);
    }
    if (sp?.dumpsterProductId) {
      params.set("dumpsterProductId", sp.dumpsterProductId);
    }
    if (sp?.origin) {
      params.set("origin", sp.origin);
    }
    redirect(`/book/date?${params.toString()}`);
  }

  return (
    <BookPageClient
      zip={zip}
      zipValid={zipValid}
      blocked={blocked}
      entryContent={entryContent}
      products={products}
      initialSelectedDumpster={{
        dumpsterSize: sp?.dumpsterSize,
        dumpsterProductId: sp?.dumpsterProductId,
      }}
      initialOrigin={sp?.origin}
      isEditingDumpster={isEditingDumpster}
    />
  );
}
