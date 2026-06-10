import HomePageClient from "@/app/home-page-client";
import { getRetailSiteSettings } from "@/lib/tenant/retail-site-settings";
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
  ] = await Promise.all([
    getHomeHeroContent({ preview }),
    getHomeServiceAreaContent({ preview }),
    getHomeStatsBarContent({ preview }),
    getHomeSectionsContent({ preview }),
    getHomeDumpsterSizesContent({ preview }),
    getHomeServiceAreaLookupContent({ preview }),
    getHomeFaqContent({ preview }),
    getSupportMarketingContent({ preview }),
    getRetailSiteSettings(),
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
    />
  );
}
