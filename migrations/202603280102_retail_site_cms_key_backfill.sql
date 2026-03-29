with resolved_tenant as (
  select id
  from public.tenants
  where slug = 'tan-can-man'
  limit 1
)
insert into public.tenant_content_entries (tenant_id, key, status, value_json)
select resolved_tenant.id, seeded.key, 'published', seeded.value_json
from resolved_tenant
cross join (
  values
    (
      'content.home.service_area_popup',
      jsonb_build_object(
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
      )
    ),
    (
      'content.pricing.product_content',
      jsonb_build_object(
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
      )
    )
) as seeded(key, value_json)
on conflict (tenant_id, key, status) do nothing;
