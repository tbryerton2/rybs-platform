// Migration-only legacy reads. Keep this comparison in Node, matching retail's localeCompare exactly.
import { defaultProductIdentity, findProductForSize } from '../../src/lib/product-position.ts';
export type LegacyProduct = {
 id: string; dumpster_size: string; dumpster_product_id: string; display_name: string;
 sort_order: number; is_public: boolean; position?: number | null;
};
export type Inventory = { size: string; active: boolean };
export function compareLegacyProducts(a: LegacyProduct, b: LegacyProduct) {
 return a.sort_order-b.sort_order || a.display_name.localeCompare(b.display_name) || a.id.localeCompare(b.id);
}
function offeredSizes(inventory: Inventory[]) {
 const counts = new Map<string, number>();
 for (const row of inventory) if (row.active) counts.set(row.size.trim(), (counts.get(row.size.trim()) ?? 0)+1);
 return [...counts].map(([size, count]) => ({ size, count }));
}
function match(products: LegacyProduct[], size: string) {
 return findProductForSize(products.map(p => ({ ...p, dumpsterSize:p.dumpster_size })), size);
}
function virtual(size: string, count: number): LegacyProduct {
 return { ...defaultProductIdentity(size), id:`new:${size}`, sort_order:count, is_public:true };
}
export function planProductPositions(products: LegacyProduct[], inventory: Inventory[]) {
 const offered = offeredSizes(inventory);
 const legacy = [...products]; // Supplied in the old database query order.
 const missing: LegacyProduct[] = [];
 for (const {size,count} of offered) if (!match([...legacy,...missing],size)) missing.push(virtual(size,count));
 const ordered = [...legacy,...missing].sort(compareLegacyProducts);
 const retail = (records: LegacyProduct[], usePosition: boolean) => [...offered]
  .sort((a,b) => a.count-b.count || `${a.size.trim()} dumpster`.localeCompare(`${b.size.trim()} dumpster`))
  .map(({size,count}) => ({size, product: match(records,size) ?? virtual(size,count)}))
  .filter(({product}) => product.is_public)
  .sort((a,b) => usePosition ? (a.product.position! - b.product.position!) :
    a.product.sort_order-b.product.sort_order || (a.product.display_name || defaultProductIdentity(a.size).display_name).localeCompare(b.product.display_name || defaultProductIdentity(b.size).display_name))
  .map(({size,product}) => `${size}: ${product.display_name || defaultProductIdentity(size).display_name}`);
 // Previous admin matched exact labels, sorted numeric size first, and included inactive settings.
 const active = new Set(offered.map(p => p.size.trim().toLowerCase()));
 const adminBefore = [...offered.map(({size,count}) => legacy.find(p => p.dumpster_size.trim().toLowerCase()===size.toLowerCase()) ?? virtual(size,count)),
  ...legacy.filter(p=>!active.has(p.dumpster_size.trim().toLowerCase()))]
  .sort((a,b) => {
   const size=(p: LegacyProduct) => Number.parseFloat(p.dumpster_size) || Number.parseFloat(p.display_name) || Infinity;
   return (size(a)-size(b)) || a.sort_order-b.sort_order || a.display_name.localeCompare(b.display_name);
  }).map(p=>`${p.dumpster_size}: ${p.display_name}`);
 const retailBefore=retail(legacy,false);
 const retailAfter=retail(ordered.map((p,i)=>({...p,position:i+1})),true);
 const adminAfter=ordered.map(p=>`${p.dumpster_size}: ${p.display_name}`);
 return { missing, ordered, retailBefore, retailAfter, adminBefore, adminAfter,
  retailChanged:JSON.stringify(retailBefore)!==JSON.stringify(retailAfter),
  adminChanged:JSON.stringify(adminBefore)!==JSON.stringify(adminAfter),
  locale:new Intl.Collator().resolvedOptions(), icu:process.versions.icu };
}
