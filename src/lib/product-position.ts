import { getDumpsterSizeCapacity } from './booking-product';

export function findProductForSize<T extends { dumpsterSize: string }>(products: T[], size: string): T | undefined {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
  const exact = products.find((product) => normalize(product.dumpsterSize) === normalize(size));
  if (exact) return exact;
  const capacity = getDumpsterSizeCapacity(size);
  return capacity === null ? undefined : products.find((product) => getDumpsterSizeCapacity(product.dumpsterSize) === capacity);
}

export function defaultProductIdentity(size: string) {
  const normalized = size.trim().toLowerCase();
  return {
    dumpster_size: size,
    dumpster_product_id: normalized === '14 yard' ? 'default' : normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'default',
    display_name: `${size.trim().replace(/\s+/g, '-')} dumpster`,
  };
}

export function compareProductPosition(
  left: { position: number; displayName: string; id: string },
  right: { position: number; displayName: string; id: string },
) {
  return left.position - right.position || left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id);
}

// Home cards retain CMS copy, but product position owns their display order.
export function orderHomeSizeCards<T extends { sizeYards: number }>(
  items: T[],
  products: Array<{ dumpsterSize: string; position: number; displayName: string; id: string }>,
): T[] {
  const matched = items.map((item) => ({ item, product: findProductForSize(products, `${item.sizeYards} yard`) }));
  return matched.sort((a, b) => {
    if (a.product && b.product) return compareProductPosition(a.product, b.product);
    // Unmatched marketing cards have no product position; retain their relative order at the end.
    return a.product ? -1 : b.product ? 1 : 0;
  }).map(({ item }) => item);
}
