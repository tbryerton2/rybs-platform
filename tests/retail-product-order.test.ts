import test from 'node:test';
import assert from 'node:assert/strict';
import { supabaseAdmin } from '../src/lib/supabaseAdmin.ts';
import { reorderDumpsterProducts } from '../src/lib/admin/reorder-dumpster-products.ts';
import { getPublicDumpsterProducts } from '../src/lib/dumpster-product-settings.ts';
import { getProductSizeGuideRows } from '../src/lib/pricing-size-guide.ts';
import { compareProductPosition, orderHomeSizeCards } from '../src/lib/product-position.ts';

test('reorder commits tenant positions, invalidates retail routes, and all retail lists follow the saved order', async (t) => {
  const tenant = 'tenant-under-test';
  const rows = [20, 12, 30].map((size, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index+1}`,
    business_id: tenant, dumpster_size: `${size} yard`, dumpster_product_id: `${size}-yard`,
    display_name: `${size}-yard dumpster`, is_public: size !== 30, position: index+1 as number | null,
    truck_load_estimate: '2 loads', size_guide_examples: 'Cleanouts', base_price: 400,
  }));
  t.mock.method(supabaseAdmin, 'rpc', async (name: string, args: { p_business_id: string; p_ids: string[] }) => {
    assert.equal(name, 'reorder_dumpster_products');
    assert.equal(args.p_business_id, tenant);
    if (args.p_ids.length !== rows.length || new Set(args.p_ids).size !== rows.length || args.p_ids.some(id=>!rows.some(row=>row.id===id))) {
      return { data: null, error: { message: 'Invalid full list' } };
    }
    for (const [index,id] of args.p_ids.entries()) rows.find(row=>row.id===id)!.position=index+1;
    return { data: null, error: null };
  });
  t.mock.method(supabaseAdmin, 'from', (table: string) => {
    const data: Record<string, unknown[]> = {
      dumpster_product_settings: rows,
      dumpsters: rows.map(row=>({size:row.dumpster_size,active:true,service_status:'Ready'})),
      pricing_settings: [{standard_rental_price:400,included_rental_days:7,daily_overage_price:25,included_tons:1}],
      service_area_zips: [],
    };
    assert.ok(table in data, table);
    const query = {
      select: (columns: string) => { assert.doesNotMatch(columns,/sort_order/); return query; },
      eq: (column: string, value: unknown) => { if(column==='business_id') assert.equal(value,tenant); return query; },
      order: (column: string) => { assert.notEqual(column,'sort_order'); return query; },
      limit: () => query,
      maybeSingle: async () => ({data:data[table][0]??null,error:null}),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({data:data[table],error:null}).then(resolve),
    };
    return query;
  });
  const before=await getPublicDumpsterProducts(undefined,tenant);
  assert.deepEqual(before.map(p=>p.dumpsterSize),['20 yard','12 yard']);
  const paths:string[]=[];
  assert.equal((await reorderDumpsterProducts(tenant,[rows[2].id,rows[1].id,rows[0].id],path=>paths.push(path))).success,true);
  assert.deepEqual(paths,['/','/book','/pricing']);
  const after=await getPublicDumpsterProducts(undefined,tenant);
  assert.deepEqual(after.map(p=>p.dumpsterSize),['12 yard','20 yard']);
  assert.deepEqual(getProductSizeGuideRows(after).map(p=>p.sizeLabel),['12 yard','20 yard']);
  assert.deepEqual(orderHomeSizeCards([{sizeYards:20},{sizeYards:12}],after).map(p=>p.sizeYards),[12,20]);
  const tied=[{...after[0],id:'b',position:1,displayName:'Same'},{...after[1],id:'a',position:1,displayName:'Same'}, {...after[0],id:'z',position:1,displayName:'Alpha'}];
  assert.deepEqual(tied.sort(compareProductPosition).map(p=>p.id),['z','a','b']);
  paths.length=0;
  assert.equal((await reorderDumpsterProducts(tenant,[rows[0].id],path=>paths.push(path))).success,false);
  assert.deepEqual(paths,[]);
  rows[0].position=null;
  await assert.rejects(getPublicDumpsterProducts(undefined,tenant),/backfill must complete/);
});
