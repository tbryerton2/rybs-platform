import type { PublicDumpsterProduct } from "./dumpster-product-settings";
import type { PricingSizeGuideRowContent } from "./tenant/content";

type GuideProduct = Pick<PublicDumpsterProduct,
  "dumpsterProductId" | "dumpsterSize" | "displayName" | "isPublic" | "position" |
  "truckLoadEstimate" | "sizeGuideExamples"
>;

export function getProductSizeGuideRows(products: GuideProduct[]): PricingSizeGuideRowContent[] {
  return products
    .filter((product) => product.isPublic &&
      (product.truckLoadEstimate.trim() || product.sizeGuideExamples.trim()))
    .slice()
    .sort((left, right) => left.position - right.position)
    .map((product) => ({
      id: product.dumpsterProductId,
      sizeLabel: product.dumpsterSize,
      truckLoadEstimate: product.truckLoadEstimate.trim(),
      description: product.sizeGuideExamples.trim(),
      position: product.position,
      active: true,
    }));
}
