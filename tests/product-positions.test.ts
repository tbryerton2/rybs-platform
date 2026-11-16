import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLegacyProducts, planProductPositions, type LegacyProduct } from '../scripts/lib/product-position-backfill.ts';
import { findProductForSize } from '../src/lib/product-position.ts';
import { readFileSync } from 'node:fs';
const product=(id:string,name:string,order=5,isPublic=true):LegacyProduct => ({id,dumpster_size:`${Number(id)+10} yard`,dumpster_product_id:id,display_name:name,sort_order:order,is_public:isPublic});
test('backfill uses the original case/accent-aware Node comparison, followed only by ID',()=>{
 const rows=['Zulu','alpha','Alpha','álpha','Ångström','10-yard','2-yard','éclair','e\u0301clair'].map((name,i)=>product(String(i),name));
 const expected=[...rows].sort((a,b)=>a.sort_order-b.sort_order || a.display_name.localeCompare(b.display_name) || a.id.localeCompare(b.id));
 assert.deepEqual([...rows].reverse().sort(compareLegacyProducts),expected);
 const tied=[product('2','same'),product('1','same')];
 assert.deepEqual(tied.sort(compareLegacyProducts).map(p=>p.id),['1','2']);
});
test('retail order is preserved while size-sorted admin order changes; hidden stays hidden',()=>{
 const products=[product('20','Thirty',1),product('10','Twenty',2),product('1','Hidden',0,false)];
 const inventory=products.map(p=>({size:p.dumpster_size,active:true}));
 const plan=planProductPositions(products,inventory);
 assert.equal(plan.retailChanged,false);
 assert.equal(plan.adminChanged,true);
 assert.equal(plan.retailAfter.length,2);
 assert.equal(plan.ordered.find(p=>p.id==='1')?.is_public,false);
});
test('only already-live active missing sizes are materialized, including hidden alias protection',()=>{
 const hidden={...product('1','Hidden',1,false),dumpster_size:'20-yard'};
 const plan=planProductPositions([hidden],[{size:'20 yard',active:true},{size:'30 yard',active:false},{size:'40 yard',active:true}]);
 assert.deepEqual(plan.missing.map(p=>[p.dumpster_size,p.is_public]),[['40 yard',true]]);
 assert.deepEqual(plan.retailBefore,plan.retailAfter);
 assert.equal(findProductForSize([{dumpsterSize:'20-yard',isPublic:false}],'20 yard')?.isPublic,false);
});
test('product application paths no longer read legacy ordering; forms stay mounted with stable IDs',()=>{
 const paths=['src/lib/dumpster-product-settings.ts','src/lib/pricing-size-guide.ts','src/app/admin/(protected)/settings/pricing/actions.ts','src/app/admin/(protected)/settings/pricing/dumpster-product-settings-form.tsx'];
 for(const path of paths)assert.doesNotMatch(readFileSync(path,'utf8'),/sort_order|sortOrder|Display order/,path);
 const ui=readFileSync(paths[3],'utf8');
 assert.match(ui,/hidden={!expanded}/);
 assert.match(ui,/key={id}/);
 assert.doesNotMatch(ui,/setValues\(initialValues\)/);
});
