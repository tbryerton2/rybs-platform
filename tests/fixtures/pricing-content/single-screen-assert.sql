do $$ begin
 assert (select headline='Published headline' and introduction='Published intro'
   and included_heading='Custom heading' and included_items='["Global A"]'
   from public.pricing_page_settings where business_id='11111111-1111-4111-8111-111111111101'), 'Published wins';
 assert (select draft_differences @> '[{"key":"content.pricing.intro","fields":["headline"]},{"key":"content.pricing.product_content","fields":["includedHeading","includedItems","sizeGuide.rows"]}]'
   from public.pricing_page_settings where business_id='11111111-1111-4111-8111-111111111101'), 'Differing draft fields reported';
 assert (select archived_cms @> '[{"key":"content.pricing.product_content","status":"draft","value":{"includedItems":["Unpublished item"]}}]'
   from public.pricing_page_settings where business_id='11111111-1111-4111-8111-111111111101'), 'Draft content archived';
 assert (select included_items='["Existing CMS"]' from public.pricing_page_settings where business_id='11111111-1111-4111-8111-111111111102'), 'Tenant isolation';
 assert (select included_heading='' and bottom_note='' and jsonb_array_length(draft_differences)=1
   from public.pricing_page_settings where business_id='11111111-1111-4111-8111-111111111104'), 'Draft-only content must not become live';
 assert (select value_json->'includedItems'='["Unpublished item"]' from public.tenant_content_entries
   where tenant_id='11111111-1111-4111-8111-111111111101' and key='content.pricing.product_content' and status='draft'), 'Old CMS retained';
 assert not has_table_privilege('anon','public.pricing_page_settings','SELECT');
 assert not has_table_privilege('authenticated','public.pricing_page_settings','UPDATE');
end $$;
