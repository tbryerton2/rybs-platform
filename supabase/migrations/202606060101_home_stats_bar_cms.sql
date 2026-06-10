insert into public.tenant_content_entries (tenant_id, key, status, value_json)
select
  tenants.id,
  'content.home.stats_bar',
  'published',
  jsonb_build_object(
    'enabled', true,
    'items', jsonb_build_array(
      jsonb_build_object(
        'id', 'next-day-delivery',
        'icon', 'truck',
        'text', 'Next-day delivery available',
        'sort_order', 1,
        'active', true
      ),
      jsonb_build_object(
        'id', 'family-owned',
        'icon', 'home',
        'text', 'Family owned & operated',
        'sort_order', 2,
        'active', true
      ),
      jsonb_build_object(
        'id', 'insured-licensed',
        'icon', 'shield',
        'text', 'Fully insured & licensed',
        'sort_order', 3,
        'active', true
      )
    )
  )
from public.tenants
where tenants.status = 'active'
on conflict (tenant_id, key, status) do nothing;
