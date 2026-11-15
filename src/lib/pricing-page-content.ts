export type PricingPageSettings = {
  headline: string;
  introduction: string;
  includedHeading: string;
  includedItems: string[];
  bottomNote: string;
  sizeGuide: { enabled: boolean; buttonText: string; title: string };
};

export function normalizePricingPageSettings(raw: Record<string, unknown> | null): PricingPageSettings {
  const text = (key: string, fallback = "") => typeof raw?.[key] === "string" ? raw[key] as string : fallback;
  return {
    headline: text("headline", "Dumpster Pricing"),
    introduction: text("introduction", "Review available dumpster sizes and rental details."),
    includedHeading: text("included_heading"),
    includedItems: Array.isArray(raw?.included_items)
      ? raw.included_items.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [],
    bottomNote: text("bottom_note"),
    sizeGuide: {
      enabled: typeof raw?.show_size_guide === "boolean" ? raw.show_size_guide : true,
      buttonText: text("size_guide_button_text", "Not sure which size? →"),
      title: text("size_guide_title", "Which size is right for me?"),
    },
  };
}
