import { compareProductPosition } from "./product-position";
import type { PublicDumpsterProduct } from "./dumpster-product-settings";
import type { PricingSizeGuideRowContent } from "./tenant/content";

type GuideProduct = Pick<PublicDumpsterProduct,
  "id" | "dumpsterProductId" | "dumpsterSize" | "displayName" | "isPublic" | "position" |
  "truckLoadEstimate" | "sizeGuideExamples"
>;

export function getProductSizeGuideRows(products: GuideProduct[]): PricingSizeGuideRowContent[] {
  return products
    .filter((product) => product.isPublic &&
      (product.truckLoadEstimate.trim() || product.sizeGuideExamples.trim()))
    .slice()
    .sort(compareProductPosition)
    .map((product) => ({
      id: product.dumpsterProductId,
      sizeLabel: product.dumpsterSize,
      truckLoadEstimate: product.truckLoadEstimate.trim(),
      description: product.sizeGuideExamples.trim(),
      position: product.position,
      active: true,
    }));
}
