with service_area_seed as (
  select jsonb_build_object(
    'title', 'Service area',
    'intro', 'We serve select areas in Central New York.',
    'coverageTitle', 'Currently covered',
    'coverageBullets', to_jsonb(array[
      'Syracuse + surrounding suburbs',
      'Clay, Cicero, Liverpool',
      'Fayetteville, Manlius, DeWitt',
      'Baldwinsville, North Syracuse'
    ]::text[]),
    'bottomNote', 'We’re expanding coverage. More areas coming soon.',
    'buttonLabel', 'View service area'
  ) as value_json
)
update public.tenant_content_entries as target
set value_json = legacy.value_json,
    updated_at = now()
from public.tenant_content_entries as legacy
cross join service_area_seed
where target.key = 'content.home.service_area_popup'
  and legacy.key = 'content.home.service_area'
  and target.tenant_id = legacy.tenant_id
  and target.status = legacy.status
  and target.value_json = service_area_seed.value_json
  and legacy.value_json is distinct from target.value_json;

with pricing_seed as (
  select jsonb_build_object(
    'description', 'Flat-rate pricing includes delivery, pickup, and standard weight allowance.',
    'featureBullets', to_jsonb(array['Driveway friendly', 'Up to 3 tons included', 'Flexible rental period']::text[]),
    'includedHeading', 'What’s included in your rental',
    'includedItems', to_jsonb(array[
      'Delivery & pickup included',
      'Up to 3 tons included',
      'Flexible rental period',
      'No hidden fees'
    ]::text[]),
    'bottomNote', 'Overage charges apply only if weight allowance is exceeded.'
  ) as value_json
)
update public.tenant_content_entries as target
set value_json = legacy.value_json,
    updated_at = now()
from public.tenant_content_entries as legacy
cross join pricing_seed
where target.key = 'content.pricing.product_content'
  and legacy.key = 'content.pricing.promises'
  and target.tenant_id = legacy.tenant_id
  and target.status = legacy.status
  and target.value_json = pricing_seed.value_json
  and legacy.value_json is distinct from target.value_json;

insert into public.tenant_content_entries (tenant_id, key, status, value_json)
select legacy.tenant_id, 'content.home.service_area_popup', legacy.status, legacy.value_json
from public.tenant_content_entries as legacy
where legacy.key = 'content.home.service_area'
  and not exists (
    select 1
    from public.tenant_content_entries existing
    where existing.tenant_id = legacy.tenant_id
      and existing.key = 'content.home.service_area_popup'
      and existing.status = legacy.status
  );

insert into public.tenant_content_entries (tenant_id, key, status, value_json)
select legacy.tenant_id, 'content.pricing.product_content', legacy.status, legacy.value_json
from public.tenant_content_entries as legacy
where legacy.key = 'content.pricing.promises'
  and not exists (
    select 1
    from public.tenant_content_entries existing
    where existing.tenant_id = legacy.tenant_id
      and existing.key = 'content.pricing.product_content'
      and existing.status = legacy.status
  );
