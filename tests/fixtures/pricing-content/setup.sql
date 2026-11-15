insert into public.tenants(id,slug) values
 ('11111111-1111-4111-8111-111111111101','pricing-content-test-a'),
 ('11111111-1111-4111-8111-111111111102','pricing-content-test-b'),
 ('11111111-1111-4111-8111-111111111103','pricing-content-test-c');
insert into public.dumpster_product_settings(business_id,dumpster_size,dumpster_product_id,display_name,short_description)
select '11111111-1111-4111-8111-111111111101',size,id,size,description from (values
 ('10 yard','ten','Draft defaults based on the current global pricing fallback.'),
 ('20 yard','twenty','My own description'),('20-yard','twenty-alt',''),
 ('30 yard','thirty',''),('40 yard','forty',''),('50 yard','fifty',''),('60 yard','sixty','')) p(size,id,description);
insert into public.dumpster_product_settings(business_id,dumpster_size,dumpster_product_id,display_name)
 values ('11111111-1111-4111-8111-111111111102','10 yard','ten','Other tenant');
update public.dumpster_product_settings set truck_load_estimate = 'Keep me'
 where dumpster_product_id = 'fifty';
insert into public.pricing_settings(business_id,included_services_blurb)
 values ('11111111-1111-4111-8111-111111111101','Global A'),
 ('11111111-1111-4111-8111-111111111102','Global B'),
 ('11111111-1111-4111-8111-111111111103','Global C');
insert into public.tenant_content_entries(tenant_id,key,status,value_json) values
 ('11111111-1111-4111-8111-111111111101','content.pricing.product_content','published',
 '{"description":"Preserve description", "featureBullets":["Preserve bullet"],"includedHeading":"Custom heading","includedItems":[],"sizeGuide":{"enabled":true,"rows":[
 {"sizeLabel":" 10-CUBIC YARDS ","truckLoadEstimate":"1-2 loads","description":"Small cleanouts","active":true},
 {"sizeLabel":"20 yard","truckLoadEstimate":"3 loads","description":"Ambiguous","active":true},
 {"sizeLabel":"99 yard","description":"Unmatched","active":true},
 {"sizeLabel":"30 yard","description":"Inactive","active":false},
 {"sizeLabel":"40 yard","description":"Duplicate one","active":true},
 {"sizeLabel":"40-yard","description":"Duplicate two","active":true},
 {"sizeLabel":"50 yard","truckLoadEstimate":"Overwrite","description":"Conflict","active":true},
 {"sizeLabel":"60 yard","truckLoadEstimate":"","description":"","active":true}]}}'),
 ('11111111-1111-4111-8111-111111111101','content.pricing.product_content','draft',
 '{"includedHeading":"Draft heading","includedItems":["Unpublished item"],"sizeGuide":{"rows":[{"sizeLabel":"10 yard","description":"Unpublished guide"}]}}'),
 ('11111111-1111-4111-8111-111111111102','content.pricing.product_content','published',
 '{"includedItems":["Existing CMS"],"sizeGuide":{"rows":[{"sizeLabel":"10 yd","description":"Tenant B examples"}]}}'),
 ('11111111-1111-4111-8111-111111111103','content.pricing.promises','published',
 '{"productBody":"Legacy product copy","featureList":["Legacy bullet"],"includedItems":["Legacy included"],"footnote":"Legacy bottom note"}');
