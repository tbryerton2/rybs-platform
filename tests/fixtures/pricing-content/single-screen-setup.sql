insert into public.tenants(id,slug) values ('11111111-1111-4111-8111-111111111104','pricing-page-draft-only');
insert into public.tenant_content_entries(tenant_id,key,status,value_json) values
 ('11111111-1111-4111-8111-111111111104','content.pricing.product_content','draft','{"includedHeading":"Never live", "bottomNote":"Draft note"}'),
 ('11111111-1111-4111-8111-111111111101','content.pricing.intro','published','{"headline":"Published headline","defaultBody":"Published intro"}'),
 ('11111111-1111-4111-8111-111111111101','content.pricing.intro','draft','{"headline":"Draft headline","defaultBody":"Published intro"}');
