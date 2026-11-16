// Default is read-only rehearsal. Apply only after the schema migration, before deploying the application.
// Use the same Node/ICU runtime as the retail server to preserve localeCompare semantics.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { planProductPositions, compareLegacyProducts, type LegacyProduct } from './lib/product-position-backfill.ts';
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
const apply=process.argv.includes('--apply');
const output=process.argv.find(arg=>arg.startsWith('--output='))?.slice(9);
const {data:tenants,error}=await db.from('tenants').select('id,slug');
if(error)throw error;
const reports=[];
for(const tenant of tenants ?? []) {
 const responses=await Promise.all([
  db.from('dumpster_product_settings').select('*').eq('business_id',tenant.id).order('sort_order').order('display_name'),
  db.from('dumpsters').select('size,active').eq('business_id',tenant.id),
  db.from('pricing_settings').select('*').eq('business_id',tenant.id).maybeSingle(),
 ]);
 for(const r of responses)if(r.error)throw r.error;
 const [products,inventory,pricing]=responses.map(r=>r.data) as [LegacyProduct[], {size:string;active:boolean}[], Record<string,number>|null];
 const plan=planProductPositions(products,inventory);
 if(apply) {
  const receipt=await db.from('dumpster_product_order_migrations').select('business_id').eq('business_id',tenant.id).maybeSingle();
  if(receipt.error)throw receipt.error;
  if(receipt.data){reports.push({tenant:tenant.slug,id:tenant.id,skipped:'already migrated'});continue;}
  if(plan.retailChanged)throw new Error(`Retail order would change for ${tenant.id}; review the rehearsal before applying.`);
  const defaults=plan.missing.sort(compareLegacyProducts).map(p=>({...p,id:randomUUID(),
   base_price:pricing?.standard_rental_price ?? 475, extra_day_price:pricing?.daily_overage_price ?? 30,
   included_weight_tons:pricing?.included_tons ?? 1, included_rental_days:pricing?.included_rental_days ?? 7,
  }));
  const ordered=[...products,...defaults].sort(compareLegacyProducts);
  const initialized=await db.rpc('initialize_dumpster_product_positions',{p_business_id:tenant.id,p_ids:ordered.map(p=>p.id),p_snapshot:plan,p_products:defaults});
  if(initialized.error)throw initialized.error;
 }
 reports.push({tenant:tenant.slug,id:tenant.id,...plan,applied:apply});
}
const result=JSON.stringify(reports,null,2);
if(output)writeFileSync(output,result+'\n');else console.log(result);
