import HomePageClient from "@/app/home-page-client";
import { getRetailSiteSettings } from "@/lib/tenant/retail-site-settings";
import {
  getHomeFaqContent,
  getHomeHeroContent,
  getHomeSectionsContent,
  getHomeServiceAreaContent,
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
    homeSectionsContent,
    faqContent,
    supportMarketingContent,
    retailSiteSettings,
  ] = await Promise.all([
    getHomeHeroContent({ preview }),
    getHomeServiceAreaContent({ preview }),
    getHomeSectionsContent({ preview }),
    getHomeFaqContent({ preview }),
    getSupportMarketingContent({ preview }),
    getRetailSiteSettings(),
  ]);

  return (
    <HomePageClient
      previewMode={preview}
      heroContent={heroContent}
      serviceAreaContent={serviceAreaContent}
      homeSectionsContent={homeSectionsContent}
      faqContent={faqContent}
      supportMarketingContent={supportMarketingContent}
      visibilitySettings={retailSiteSettings.home.visibility}
    />
  );
}
