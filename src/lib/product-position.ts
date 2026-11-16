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
