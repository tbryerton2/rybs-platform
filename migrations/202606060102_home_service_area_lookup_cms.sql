insert into public.tenant_content_entries (tenant_id, key, status, value_json)
select
  tenants.id,
  'content.home.service_area_lookup',
  'published',
  jsonb_build_object(
    'enabled', true,
    'eyebrow', 'SERVICE AREA',
    'headline', 'Do we serve your area?',
    'description', 'Enter your ZIP for instant confirmation and pricing.',
    'zipPlaceholder', 'Enter ZIP code',
    'buttonText', 'Check ZIP',
    'areasEyebrow', 'SOME AREAS WE COVER',
    'areaPills', jsonb_build_array(
      'Syracuse',
      'Oneida',
      'Utica',
      'Rome',
      'Cazenovia',
      'Chittenango',
      'Canastota',
      'Hamilton'
    ),
    'helperText', '& more — check your ZIP to confirm'
  )
from public.tenants
where tenants.status = 'active'
on conflict (tenant_id, key, status) do nothing;
