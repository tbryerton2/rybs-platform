import type { PublicDumpsterProduct } from "./dumpster-product-settings";
import type { PricingSizeGuideRowContent } from "./tenant/content";

type GuideProduct = Pick<PublicDumpsterProduct,
  "dumpsterProductId" | "dumpsterSize" | "displayName" | "isPublic" | "sortOrder" |
  "truckLoadEstimate" | "sizeGuideExamples"
>;

export function getProductSizeGuideRows(products: GuideProduct[]): PricingSizeGuideRowContent[] {
  return products
    .filter((product) => product.isPublic &&
      (product.truckLoadEstimate.trim() || product.sizeGuideExamples.trim()))
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.displayName.localeCompare(right.displayName))
    .map((product) => ({
      id: product.dumpsterProductId,
      sizeLabel: product.dumpsterSize,
      truckLoadEstimate: product.truckLoadEstimate.trim(),
      description: product.sizeGuideExamples.trim(),
      sortOrder: product.sortOrder,
      active: true,
    }));
}
