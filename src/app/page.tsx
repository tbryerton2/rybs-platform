import HomePageClient from "@/app/home-page-client";
import { getActiveServiceAreaZipCodes } from "@/lib/service-area";
import { getRetailSiteSettingsForTenant } from "@/lib/tenant/retail-site-settings";
import { getCurrentTenant } from "@/lib/tenant/server";
import {
  getHomeFaqContent,
  getHomeDumpsterSizesContent,
  getHomeHeroContent,
  getHomeSectionsContent,
  getHomeServiceAreaContent,
  getHomeServiceAreaLookupContent,
  getHomeStatsBarContent,
  getSupportMarketingContent,
} from "@/lib/tenant/content";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ preview?: string }>;
}) {
  const sp = await searchParams;
  const preview = sp?.preview === "1";
  const tenant = await getCurrentTenant();
  const contentOptions = { preview, tenantId: tenant.id };
  const [
    heroContent,
    serviceAreaContent,
    statsBarContent,
    homeSectionsContent,
    dumpsterSizesContent,
    serviceAreaLookupContent,
    faqContent,
    supportMarketingContent,
    retailSiteSettings,
    servedZipCodes,
  ] = await Promise.all([
    getHomeHeroContent(contentOptions),
    getHomeServiceAreaContent(contentOptions),
    getHomeStatsBarContent(contentOptions),
    getHomeSectionsContent(contentOptions),
    getHomeDumpsterSizesContent(contentOptions),
    getHomeServiceAreaLookupContent(contentOptions),
    getHomeFaqContent(contentOptions),
    getSupportMarketingContent(contentOptions),
    getRetailSiteSettingsForTenant(tenant),
    getActiveServiceAreaZipCodes(tenant.id),
  ]);

  return (
    <HomePageClient
      previewMode={preview}
      heroContent={heroContent}
      serviceAreaContent={serviceAreaContent}
      statsBarContent={statsBarContent}
      homeSectionsContent={homeSectionsContent}
      dumpsterSizesContent={dumpsterSizesContent}
      serviceAreaLookupContent={serviceAreaLookupContent}
      faqContent={faqContent}
      supportMarketingContent={supportMarketingContent}
      visibilitySettings={retailSiteSettings.home.visibility}
      servedZipCodes={servedZipCodes}
    />
  );
}
