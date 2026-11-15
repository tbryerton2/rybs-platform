do $$ begin
 assert (select truck_load_estimate='1-2 loads' and size_guide_examples='Small cleanouts' and short_description is null
   from public.dumpster_product_settings where business_id='11111111-1111-4111-8111-111111111101' and dumpster_product_id='ten');
 assert (select short_description='My own description' from public.dumpster_product_settings where dumpster_product_id='twenty');
 assert not exists(select 1 from public.dumpster_product_settings where dumpster_product_id in ('twenty','twenty-alt','thirty','forty','sixty') and size_guide_examples is not null);
 assert (select truck_load_estimate='Keep me' and size_guide_examples is null from public.dumpster_product_settings where dumpster_product_id='fifty');
 assert (select size_guide_examples='Tenant B examples' from public.dumpster_product_settings where business_id='11111111-1111-4111-8111-111111111102');
 assert (select value_json->'includedItems'='["Global A"]' and value_json->>'includedHeading'='Custom heading'
   and value_json->>'description'='Preserve description' and jsonb_array_length(value_json#>'{sizeGuide,rows}')=8
   from public.tenant_content_entries where tenant_id='11111111-1111-4111-8111-111111111101' and key='content.pricing.product_content' and status='published');
 assert (select value_json->'includedItems'='["Unpublished item"]' from public.tenant_content_entries
   where tenant_id='11111111-1111-4111-8111-111111111101' and key='content.pricing.product_content' and status='draft');
 assert (select value_json->'includedItems'='["Existing CMS"]' from public.tenant_content_entries
   where tenant_id='11111111-1111-4111-8111-111111111102' and key='content.pricing.product_content' and status='published');
 assert (select value_json->>'footnote'='Legacy bottom note' and value_json->'includedItems'='["Legacy included"]' from public.tenant_content_entries
   where tenant_id='11111111-1111-4111-8111-111111111103' and key='content.pricing.product_content' and status='published');
 assert (select report->>'matched'='1' and report->>'unmatched'='1' and report->>'skipped'='7' and report->>'seededDescriptionsCleared'='1'
   from public.pricing_content_migration_audit where tenant_id='11111111-1111-4111-8111-111111111101');
 assert (select report->'rows' @> '[{"outcome":"ambiguous_products"},{"outcome":"ambiguous_rows"},{"outcome":"skipped_draft"},{"outcome":"skipped_inactive"},{"outcome":"skipped_existing_product_data"}]'
   from public.pricing_content_migration_audit where tenant_id='11111111-1111-4111-8111-111111111101');
 assert (select jsonb_array_length(report->'retiredCmsCopy')=1 from public.pricing_content_migration_audit where tenant_id='11111111-1111-4111-8111-111111111103');
 assert not has_table_privilege('anon','public.pricing_content_migration_audit','SELECT');
 assert not has_table_privilege('authenticated','public.pricing_content_migration_audit','SELECT');
 assert not has_table_privilege('service_role','public.pricing_content_migration_audit','UPDATE');
 assert not has_table_privilege('service_role','public.pricing_content_migration_audit','DELETE');
end $$;
