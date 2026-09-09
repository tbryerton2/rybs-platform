begin;

truncate table
  public.business_expenses,
  public.business_employees,
  public.rental_action_requests,
  public.booking_requests,
  public.booking_holds,
  public.customer_locations,
  public.bookings,
  public.customers,
  public.entity_history
restart identity cascade;

delete from public.pricing_settings;

create temporary table seed_tan_can_man_business (
  id uuid primary key
) on commit drop;

create temporary table seed_demo_dumpster_business (
  id uuid primary key
) on commit drop;

insert into seed_tan_can_man_business (id)
select id
from public.tenants
where slug = 'tan-can-man';

do $$
begin
  if not exists (select 1 from seed_tan_can_man_business) then
    raise exception 'Local seed requires tenant slug tan-can-man to exist.';
  end if;
end $$;

with seeded_demo as (
  insert into public.tenants (id, slug, status)
  values (
    '22222222-2222-4222-8222-222222222222',
    'demo-dumpster-co',
    'active'
  )
  on conflict (slug) do update
    set status = excluded.status,
        updated_at = now()
  returning id
), resolved_demo as (
  select id from seeded_demo
  union all
  select id from public.tenants where slug = 'demo-dumpster-co'
  limit 1
)
insert into seed_demo_dumpster_business (id)
select id from resolved_demo;

insert into public.tenant_settings (tenant_id, category, key, value_json)
select demo.id, seeded.category, seeded.key, seeded.value_json
from seed_demo_dumpster_business demo
cross join (
  values
    ('brand', 'name', to_jsonb('Demo Dumpster Company'::text)),
    ('brand', 'tagline', to_jsonb('Simple roll-off rentals for clean demo walkthroughs'::text)),
    ('brand', 'legalDisplayName', to_jsonb('Demo Dumpster Company'::text)),
    ('brand', 'headerPrimaryCtaLabel', to_jsonb('Call/Text'::text)),
    ('brand', 'headerPrimaryCtaType', to_jsonb('tel'::text)),
    ('brand', 'headerPrimaryCtaValue', to_jsonb('+1-512-555-0144'::text)),
    ('support', 'phone', to_jsonb('+1-512-555-0144'::text)),
    ('support', 'email', to_jsonb('hello@demo-dumpster-company.local'::text)),
    ('support', 'timezone', to_jsonb('America/Chicago'::text)),
    ('runtime', 'storageNamespace', to_jsonb('demo_dumpster_company'::text)),
    ('implementation', 'type', to_jsonb('full_site_platform_subdomain'::text)),
    ('settings.header', 'showCallTextButton', to_jsonb(true)),
    ('settings.header', 'phoneNumber', to_jsonb('+1-512-555-0144'::text)),
    ('settings.header', 'showEmailInHeader', to_jsonb(true)),
    ('settings.header', 'emailAddress', to_jsonb('hello@demo-dumpster-company.local'::text)),
    ('settings.header', 'businessNameSize', to_jsonb('medium'::text)),
    ('settings.home.visibility', 'showServiceAreaPopup', to_jsonb(true)),
    ('settings.home.visibility', 'showFaq', to_jsonb(true)),
    ('settings.calendarClosures', 'blockedDates', '[]'::jsonb),
    ('settings.calendarClosures', 'blockedRanges', jsonb_build_array(
      jsonb_build_object(
        'startDate', to_char(current_date + 45, 'YYYY-MM-DD'),
        'endDate', to_char(current_date + 46, 'YYYY-MM-DD'),
        'label', 'Demo maintenance window'
      )
    )),
    ('notifications', 'bookingEmail', to_jsonb('bookings@demo-dumpster-company.local'::text))
) as seeded(category, key, value_json)
on conflict (tenant_id, category, key) do update
set value_json = excluded.value_json,
    updated_at = now();

insert into public.tenant_domains (
  tenant_id,
  hostname,
  domain_type,
  status,
  is_primary,
  provider_status,
  verification_status
)
select
  demo.id,
  'demo-dumpster-co.localhost',
  'platform_subdomain',
  'active',
  true,
  'not_provisioned',
  'unknown'
from seed_demo_dumpster_business demo
on conflict (hostname) do update
set tenant_id = excluded.tenant_id,
    domain_type = excluded.domain_type,
    status = excluded.status,
    is_primary = excluded.is_primary,
    provider_status = excluded.provider_status,
    verification_status = excluded.verification_status,
    updated_at = now();

insert into public.tenant_content_entries (tenant_id, key, status, value_json)
select demo.id, seeded.key, 'published', seeded.value_json
from seed_demo_dumpster_business demo
cross join (
  values
    (
      'content.home.hero',
      jsonb_build_object(
        'eyebrow', 'Demo Dumpster Company',
        'headlineLine1', 'Rent a dumpster without the runaround',
        'headlineLine2', null,
        'subheadline', 'A clean demo tenant with realistic pricing, service areas, and booking flow data.',
        'imageUrl', '/images/dumpster-hero.svg',
        'imageAlt', 'Roll-off dumpster staged at a residential project',
        'availabilityHelper', 'Check ZIP availability and reserve a delivery window.',
        'trustItems', jsonb_build_array('Local demo service area', 'Transparent pricing', 'Online booking ready')
      )
    ),
    (
      'content.pricing.intro',
      jsonb_build_object(
        'headline', 'Demo dumpster pricing',
        'defaultBody', 'Use this tenant to show customers how tenant-specific products, prices, and rental rules appear.'
      )
    ),
    (
      'content.booking.entry',
      jsonb_build_object(
        'title', 'Book a Demo Dumpster Company rental',
        'subtitle', 'Choose a size, service ZIP, delivery date, and placement details.',
        'sectionTitle', 'Start with the project',
        'sectionDescription', 'The demo flow uses Demo Dumpster Company products and service ZIPs only.',
        'blockedCtaText', 'Select a dumpster size to continue'
      )
    )
) as seeded(key, value_json)
on conflict on constraint tenant_content_entries_tenant_key_status_unique
do update
set value_json = excluded.value_json,
    updated_at = now();

insert into public.service_area_zips (business_id, zip, active, county, town)
select demo.id, seeded.zip, true, seeded.county, seeded.town
from seed_demo_dumpster_business demo
cross join (
  values
    ('78704', 'Travis', 'Austin'),
    ('78745', 'Travis', 'Austin'),
    ('78748', 'Travis', 'Austin')
) as seeded(zip, county, town)
on conflict on constraint service_area_zips_business_id_zip_key
do update
set active = excluded.active,
    county = excluded.county,
    town = excluded.town,
    updated_at = now();

insert into public.pricing_settings (
  id,
  business_id,
  standard_rental_price,
  scheduled_pickup_price,
  included_rental_days,
  included_tons,
  daily_overage_price,
  ton_overage_price,
  max_rental_days,
  allow_extended_rental_at_booking,
  included_services_blurb
)
select
  '22000000-0000-4000-8000-000000000001',
  demo.id,
  395.00,
  395.00,
  7,
  1.50,
  25.00,
  110.00,
  14,
  true,
  'Includes delivery, pickup, a 7-day rental window, and the listed weight allowance.'
from seed_demo_dumpster_business demo
on conflict on constraint pricing_settings_business_id_key
do update
set standard_rental_price = excluded.standard_rental_price,
    scheduled_pickup_price = excluded.scheduled_pickup_price,
    included_rental_days = excluded.included_rental_days,
    included_tons = excluded.included_tons,
    daily_overage_price = excluded.daily_overage_price,
    ton_overage_price = excluded.ton_overage_price,
    max_rental_days = excluded.max_rental_days,
    allow_extended_rental_at_booking = excluded.allow_extended_rental_at_booking,
    included_services_blurb = excluded.included_services_blurb,
    updated_at = now();

insert into public.dumpster_product_settings (
  id,
  business_id,
  dumpster_size,
  dumpster_product_id,
  display_name,
  short_description,
  dimensions,
  included_weight_tons,
  included_rental_days,
  extra_day_price,
  base_price,
  is_public,
  sort_order,
  customer_bullet_points
)
select
  seeded.id,
  demo.id,
  seeded.dumpster_size,
  seeded.dumpster_product_id,
  seeded.display_name,
  seeded.short_description,
  seeded.dimensions,
  seeded.included_weight_tons,
  seeded.included_rental_days,
  seeded.extra_day_price,
  seeded.base_price,
  true,
  seeded.sort_order,
  seeded.customer_bullet_points
from seed_demo_dumpster_business demo
cross join (
  values
    (
      '22000000-0000-4000-8000-000000000101'::uuid,
      '12 yard'::text,
      'demo-12-yard'::text,
      '12-yard demo dumpster'::text,
      'Great for garage cleanouts, small remodels, and tight driveways.'::text,
      '12'' x 8'' x 4'''::text,
      1.50::numeric,
      7,
      25.00::numeric,
      395.00::numeric,
      10,
      'Driveway friendly; 1.5 tons included; 7 rental days included'::text
    ),
    (
      '22000000-0000-4000-8000-000000000102'::uuid,
      '20 yard'::text,
      'demo-20-yard'::text,
      '20-yard demo dumpster'::text,
      'Sized for larger remodels, roofing debris, and contractor jobs.'::text,
      '22'' x 8'' x 4.5'''::text,
      2.00::numeric,
      10,
      30.00::numeric,
      525.00::numeric,
      20,
      'Contractor friendly; 2 tons included; 10 rental days included'::text
    )
) as seeded(
  id,
  dumpster_size,
  dumpster_product_id,
  display_name,
  short_description,
  dimensions,
  included_weight_tons,
  included_rental_days,
  extra_day_price,
  base_price,
  sort_order,
  customer_bullet_points
)
on conflict on constraint dumpster_product_settings_business_id_dumpster_size_key
do update
set dumpster_product_id = excluded.dumpster_product_id,
    display_name = excluded.display_name,
    short_description = excluded.short_description,
    dimensions = excluded.dimensions,
    included_weight_tons = excluded.included_weight_tons,
    included_rental_days = excluded.included_rental_days,
    extra_day_price = excluded.extra_day_price,
    base_price = excluded.base_price,
    is_public = excluded.is_public,
    sort_order = excluded.sort_order,
    customer_bullet_points = excluded.customer_bullet_points,
    updated_at = now();

insert into public.dumpsters (
  id,
  business_id,
  equipment_id,
  display_name,
  size,
  dimensions,
  capacity_notes,
  active,
  operational_status,
  maintenance_status,
  condition_notes,
  in_service_date,
  notes,
  serial_number,
  manufacturer,
  model,
  yard_location,
  service_status,
  last_service_date,
  next_service_date,
  last_inspection_date,
  next_inspection_due,
  asset_tag,
  tracker_enabled,
  tracker_status,
  created_at,
  updated_at
)
select
  seeded.id,
  demo.id,
  seeded.equipment_id,
  seeded.display_name,
  seeded.size,
  seeded.dimensions,
  seeded.capacity_notes,
  true,
  'Available',
  'Current',
  seeded.condition_notes,
  seeded.in_service_date,
  seeded.notes,
  seeded.serial_number,
  'DemoCo',
  seeded.model,
  'Demo Yard',
  'Ready',
  current_date - 30,
  current_date + 60,
  current_date - 30,
  current_date + 60,
  seeded.asset_tag,
  false,
  'Not installed',
  now(),
  now()
from seed_demo_dumpster_business demo
cross join (
  values
    (
      '22000000-0000-4000-8000-000000000201'::uuid,
      'DEMO-12-01'::text,
      'Demo 12 Yard #1'::text,
      '12 yard'::text,
      '12'' x 8'' x 4'''::text,
      'Residential cleanouts and compact renovation debris'::text,
      'Clean, camera-ready demo unit.'::text,
      current_date - 180,
      'Use for standard demo bookings.'::text,
      'DEMO-SER-1201'::text,
      'DEMO-TAG-1201'::text,
      'D12'::text
    ),
    (
      '22000000-0000-4000-8000-000000000202'::uuid,
      'DEMO-20-01'::text,
      'Demo 20 Yard #1'::text,
      '20 yard'::text,
      '22'' x 8'' x 4.5'''::text,
      'Large cleanouts, roofing, and contractor debris'::text,
      'Primary contractor-size demo unit.'::text,
      current_date - 240,
      'Use for larger project demos.'::text,
      'DEMO-SER-2001'::text,
      'DEMO-TAG-2001'::text,
      'D20'::text
    )
) as seeded(
  id,
  equipment_id,
  display_name,
  size,
  dimensions,
  capacity_notes,
  condition_notes,
  in_service_date,
  notes,
  serial_number,
  asset_tag,
  model
)
on conflict on constraint dumpsters_business_id_equipment_id_key
do update
set display_name = excluded.display_name,
    size = excluded.size,
    dimensions = excluded.dimensions,
    capacity_notes = excluded.capacity_notes,
    active = excluded.active,
    operational_status = excluded.operational_status,
    maintenance_status = excluded.maintenance_status,
    condition_notes = excluded.condition_notes,
    in_service_date = excluded.in_service_date,
    notes = excluded.notes,
    serial_number = excluded.serial_number,
    manufacturer = excluded.manufacturer,
    model = excluded.model,
    yard_location = excluded.yard_location,
    service_status = excluded.service_status,
    last_service_date = excluded.last_service_date,
    next_service_date = excluded.next_service_date,
    last_inspection_date = excluded.last_inspection_date,
    next_inspection_due = excluded.next_inspection_due,
    asset_tag = excluded.asset_tag,
    tracker_enabled = excluded.tracker_enabled,
    tracker_status = excluded.tracker_status,
    updated_at = now();

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_anonymous
)
values (
  '23000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'demo.admin@demo-dumpster-company.local',
  crypt('demo-admin-password', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Demo Admin"}'::jsonb,
  now(),
  now(),
  false
)
on conflict (id) do update
set email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

insert into auth.identities (
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at
)
values (
  '23000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'sub', '23000000-0000-4000-8000-000000000001',
    'email', 'demo.admin@demo-dumpster-company.local',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  '23000000-0000-4000-8000-000000000001',
  now(),
  now()
)
on conflict (provider, provider_id) do update
set user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    updated_at = now();

insert into public.business_admin_memberships (
  id,
  business_id,
  auth_user_id,
  role,
  status
)
select
  '23000000-0000-4000-8000-000000000101',
  demo.id,
  '23000000-0000-4000-8000-000000000001',
  'owner',
  'active'
from seed_demo_dumpster_business demo
on conflict on constraint business_admin_memberships_business_auth_user_unique
do update
set role = excluded.role,
    status = excluded.status,
    updated_at = now();

-- Tan Can Man QA fixture data.
insert into public.pricing_settings (
  id,
  business_id,
  standard_rental_price,
  scheduled_pickup_price,
  included_rental_days,
  included_tons,
  daily_overage_price,
  ton_overage_price,
  max_rental_days,
  allow_extended_rental_at_booking
)
values (
  '90000000-0000-4000-8000-000000000001',
  (select id from seed_tan_can_man_business),
  425.00,
  425.00,
  10,
  2.00,
  15.00,
  125.00,
  21,
  true
);

insert into public.customers (
  id,
  business_id,
  name,
  email,
  phone,
  primary_street,
  primary_city,
  primary_state,
  primary_zip,
  notes,
  portal_status,
  company,
  preferred_contact_method
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    (select id from seed_tan_can_man_business),
    'Alice Benton',
    'alice.benton@example.com',
    '3155550101',
    '12 Lakeview Dr',
    'Chittenango',
    'NY',
    '13037',
    'Kitchen remodel customer. Prefers text updates before delivery.',
    'active',
    'Benton Home Projects',
    'either'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    (select id from seed_tan_can_man_business),
    'Marcus Hale',
    'marcus.hale@example.com',
    '3155550102',
    '84 Quarry Rd',
    'Canastota',
    'NY',
    '13032',
    'Contractor account with repeat seasonal work.',
    'active',
    'Hale Demo & Haul',
    'phone'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    (select id from seed_tan_can_man_business),
    'Priya Desai',
    'priya.desai@example.com',
    '3155550103',
    '455 Ridge St',
    'Fayetteville',
    'NY',
    '13066',
    'Needs careful driveway placement to avoid basketball hoop.',
    'invited',
    null,
    'email'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    (select id from seed_tan_can_man_business),
    'Jonah Mercer',
    'jonah.mercer@example.com',
    '3155550104',
    '901 County Route 5',
    'Cazenovia',
    'NY',
    '13035',
    'Roof tear-off project with active extension requests.',
    'active',
    'Mercer Roofing',
    'phone'
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    (select id from seed_tan_can_man_business),
    'Sofia Alvarez',
    'sofia.alvarez@example.com',
    '3155550105',
    '233 Canal St',
    'Minoa',
    'NY',
    '13116',
    'Cancelled project after permit delay.',
    'invited',
    null,
    'email'
  );

insert into public.customer_locations (
  id,
  business_id,
  customer_id,
  label,
  street,
  city,
  state,
  zip,
  delivery_notes,
  is_default,
  access_notes,
  onsite_contact_name,
  onsite_contact_phone
)
values
  (
    '11000000-0000-4000-8000-000000000001',
    (select id from seed_tan_can_man_business),
    '10000000-0000-4000-8000-000000000001',
    'Home driveway',
    '12 Lakeview Dr',
    'Chittenango',
    'NY',
    '13037',
    'Place on the right side of the driveway near the garage.',
    true,
    'Avoid blocking the basketball hoop.',
    'Alice Benton',
    '3155550101'
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    (select id from seed_tan_can_man_business),
    '10000000-0000-4000-8000-000000000002',
    'Main job yard',
    '84 Quarry Rd',
    'Canastota',
    'NY',
    '13032',
    'Call Marcus when 20 minutes out.',
    true,
    'Gate code 2468 after 7 AM.',
    'Marcus Hale',
    '3155550102'
  ),
  (
    '11000000-0000-4000-8000-000000000003',
    (select id from seed_tan_can_man_business),
    '10000000-0000-4000-8000-000000000003',
    'Primary residence',
    '455 Ridge St',
    'Fayetteville',
    'NY',
    '13066',
    'Set back from the curb so the HOA does not complain.',
    true,
    'Narrow driveway. Driver should back in carefully.',
    'Priya Desai',
    '3155550103'
  ),
  (
    '11000000-0000-4000-8000-000000000004',
    (select id from seed_tan_can_man_business),
    '10000000-0000-4000-8000-000000000004',
    'Farm lane',
    '901 County Route 5',
    'Cazenovia',
    'NY',
    '13035',
    'Use gravel pull-off near the red barn.',
    true,
    'Soft shoulder when wet. Stay on the packed gravel.',
    'Jonah Mercer',
    '3155550104'
  ),
  (
    '11000000-0000-4000-8000-000000000005',
    (select id from seed_tan_can_man_business),
    '10000000-0000-4000-8000-000000000005',
    'Canal-side project',
    '233 Canal St',
    'Minoa',
    'NY',
    '13116',
    'Street placement would have required a permit.',
    true,
    'Tight turnaround at the curb.',
    'Sofia Alvarez',
    '3155550105'
  ),
  (
    '11000000-0000-4000-8000-000000000006',
    (select id from seed_tan_can_man_business),
    '10000000-0000-4000-8000-000000000002',
    'Overflow yard',
    '18 Sullivan Rd',
    'Canastota',
    'NY',
    '13032',
    'Secondary yard for overflow material.',
    false,
    'Open lot with easy truck access.',
    'Marcus Hale',
    '3155550102'
  );

insert into public.customers (
  id,
  business_id,
  name,
  email,
  phone,
  primary_street,
  primary_city,
  primary_state,
  primary_zip,
  notes,
  portal_status,
  company,
  preferred_contact_method
)
values
  (
    '21000000-0000-4000-8000-000000000001',
    (select id from seed_demo_dumpster_business),
    'Riley Parker',
    'riley.parker@example.test',
    '5125550181',
    '810 Barton Springs Rd',
    'Austin',
    'TX',
    '78704',
    'Demo residential cleanout customer.',
    'active',
    null,
    'email'
  ),
  (
    '21000000-0000-4000-8000-000000000002',
    (select id from seed_demo_dumpster_business),
    'Morgan Lee',
    'morgan.lee@example.test',
    '5125550182',
    '4401 S Congress Ave',
    'Austin',
    'TX',
    '78745',
    'Demo contractor customer for the 20-yard product.',
    'invited',
    'Lee Demo Services',
    'phone'
  );

insert into public.customer_locations (
  id,
  business_id,
  customer_id,
  label,
  street,
  city,
  state,
  zip,
  delivery_notes,
  is_default,
  access_notes,
  onsite_contact_name,
  onsite_contact_phone
)
values
  (
    '21100000-0000-4000-8000-000000000001',
    (select id from seed_demo_dumpster_business),
    '21000000-0000-4000-8000-000000000001',
    'Demo driveway',
    '810 Barton Springs Rd',
    'Austin',
    'TX',
    '78704',
    'Place near the detached garage for the sales demo.',
    true,
    'Wide driveway with clear access.',
    'Riley Parker',
    '5125550181'
  ),
  (
    '21100000-0000-4000-8000-000000000002',
    (select id from seed_demo_dumpster_business),
    '21000000-0000-4000-8000-000000000002',
    'Retail renovation site',
    '4401 S Congress Ave',
    'Austin',
    'TX',
    '78745',
    'Set behind the building near the marked contractor entrance.',
    true,
    'Call before arrival so the demo gate can be opened.',
    'Morgan Lee',
    '5125550182'
  );

with selected_business as (
  select id from seed_tan_can_man_business
)
insert into public.business_employees (
  id,
  business_id,
  employee_code,
  first_name,
  last_name,
  email,
  phone,
  second_phone,
  preferred_contact_method,
  street_address,
  city,
  state,
  postal_code,
  date_of_birth,
  hire_date,
  emergency_contact_name,
  emergency_contact_phone,
  job_title,
  role_key,
  status,
  deactivated_at,
  deactivation_reason,
  notes,
  license_number,
  license_state,
  license_class,
  license_expiration
)
select
  seeded.id,
  selected_business.id,
  seeded.employee_code,
  seeded.first_name,
  seeded.last_name,
  seeded.email,
  seeded.phone,
  seeded.second_phone,
  seeded.preferred_contact_method,
  seeded.street_address,
  seeded.city,
  seeded.state,
  seeded.postal_code,
  seeded.date_of_birth,
  seeded.hire_date,
  seeded.emergency_contact_name,
  seeded.emergency_contact_phone,
  seeded.job_title,
  seeded.role_key,
  seeded.status,
  seeded.deactivated_at,
  seeded.deactivation_reason,
  seeded.notes,
  seeded.license_number,
  seeded.license_state,
  seeded.license_class,
  seeded.license_expiration
from selected_business
cross join (
  values
    (
      '12000000-0000-4000-8000-000000000001'::uuid,
      'EMP-1001'::text,
      'Marcus'::text,
      'Hill'::text,
      'marcus.hill@example.com'::text,
      '3155550181'::text,
      null::text,
      'text'::text,
      '1420 Cedar Run'::text,
      'Syracuse'::text,
      'NY'::text,
      '13208'::text,
      '1988-09-17'::date,
      '2022-03-14'::date,
      'Dana Hill'::text,
      '3155550199'::text,
      'Lead Driver'::text,
      'lead_driver'::text,
      'active'::text,
      null::timestamptz,
      null::text,
      'Primary roll-off route lead. Cleared for training newer drivers on yard loading flow.'::text,
      'H4589217'::text,
      'NY'::text,
      'Class B'::text,
      '2026-11-02'::date
    ),
    (
      '12000000-0000-4000-8000-000000000002'::uuid,
      'EMP-1002'::text,
      'Alyssa'::text,
      'Nguyen'::text,
      'alyssa.nguyen@example.com'::text,
      '3155550114'::text,
      '3155550115'::text,
      'email'::text,
      '28 Palmer Ave'::text,
      'Liverpool'::text,
      'NY'::text,
      '13088'::text,
      '1992-04-05'::date,
      '2023-08-21'::date,
      'Helen Nguyen'::text,
      '3155550116'::text,
      'Operations Coordinator'::text,
      'operations'::text,
      'active'::text,
      null::timestamptz,
      null::text,
      'Handles customer handoff and same-day dispatch changes. Prefers email for non-urgent updates.'::text,
      'N6034921'::text,
      'NY'::text,
      'Class D'::text,
      '2027-01-18'::date
    ),
    (
      '12000000-0000-4000-8000-000000000003'::uuid,
      'EMP-1003'::text,
      'Jordan'::text,
      'Ellis'::text,
      'jordan.ellis@example.com'::text,
      '3155550172'::text,
      null::text,
      'phone'::text,
      '511 Westmoreland Dr'::text,
      'Baldwinsville'::text,
      'NY'::text,
      '13027'::text,
      '1996-12-11'::date,
      '2024-02-12'::date,
      'Maya Ellis'::text,
      '3155550173'::text,
      'Driver'::text,
      'driver'::text,
      'active'::text,
      null::timestamptz,
      null::text,
      'Available for Saturday routes. Forklift certified.'::text,
      'E8842104'::text,
      'NY'::text,
      'Class B'::text,
      '2026-08-09'::date
    ),
    (
      '12000000-0000-4000-8000-000000000004'::uuid,
      'EMP-1004'::text,
      'Renee'::text,
      'Porter'::text,
      'renee.porter@example.com'::text,
      '3155550137'::text,
      null::text,
      'phone'::text,
      '77 Lakeview Ct'::text,
      'Clay'::text,
      'NY'::text,
      '13041'::text,
      '1985-06-29'::date,
      '2021-05-03'::date,
      'Chris Porter'::text,
      '3155550138'::text,
      'Yard Associate'::text,
      'seasonal'::text,
      'inactive'::text,
      '2026-02-19T11:05:00.000Z'::timestamptz,
      'Seasonal leave retained for rehire review.'::text,
      'Currently inactive. Keep record for rehire review during peak season.'::text,
      'P7218401'::text,
      'NY'::text,
      'Class D'::text,
      '2026-05-30'::date
    )
) as seeded(
  id,
  employee_code,
  first_name,
  last_name,
  email,
  phone,
  second_phone,
  preferred_contact_method,
  street_address,
  city,
  state,
  postal_code,
  date_of_birth,
  hire_date,
  emergency_contact_name,
  emergency_contact_phone,
  job_title,
  role_key,
  status,
  deactivated_at,
  deactivation_reason,
  notes,
  license_number,
  license_state,
  license_class,
  license_expiration
);

with selected_business as (
  select id from seed_tan_can_man_business
)
insert into public.business_expenses (
  id,
  business_id,
  expense_date,
  category,
  vendor,
  description,
  amount_cents,
  status,
  payment_method,
  asset_reference,
  tax_deductible,
  receipt_reference,
  notes,
  created_at,
  updated_at
)
select
  seeded.id,
  selected_business.id,
  seeded.expense_date,
  seeded.category,
  seeded.vendor,
  seeded.description,
  seeded.amount_cents,
  seeded.status,
  seeded.payment_method,
  seeded.asset_reference,
  seeded.tax_deductible,
  seeded.receipt_reference,
  seeded.notes,
  seeded.created_at,
  seeded.updated_at
from selected_business
cross join (
  values
    (
      '13000000-0000-4000-8000-000000000001'::uuid,
      current_date - 19,
      'Fuel'::text,
      'Fleet Fuel Services'::text,
      'Weekly diesel top-up for route trucks'::text,
      48620,
      'Paid'::text,
      'Card'::text,
      'Truck 12'::text,
      true,
      'INV-24018'::text,
      'Included two emergency after-hours fills.'::text,
      now() - interval '19 days',
      now() - interval '19 days'
    ),
    (
      '13000000-0000-4000-8000-000000000002'::uuid,
      current_date - 22,
      'Vehicle maintenance'::text,
      'North Yard Truck Repair'::text,
      'Brake service and inspection'::text,
      129500,
      'Outstanding'::text,
      'ACH'::text,
      'Truck 08'::text,
      true,
      'WO-8821'::text,
      'Payment due net 15.'::text,
      now() - interval '22 days',
      now() - interval '21 days'
    ),
    (
      '13000000-0000-4000-8000-000000000003'::uuid,
      current_date - 24,
      'Dump fees / disposal'::text,
      'County Transfer Station'::text,
      'Disposal charges for mixed debris loads'::text,
      73200,
      'Paid'::text,
      'ACH'::text,
      null::text,
      true,
      'CTS-19037'::text,
      ''::text,
      now() - interval '24 days',
      now() - interval '24 days'
    ),
    (
      '13000000-0000-4000-8000-000000000004'::uuid,
      current_date - 26,
      'Payroll'::text,
      'Weekly payroll'::text,
      'Driver and yard payroll batch'::text,
      428000,
      'Paid'::text,
      'Payroll run'::text,
      null::text,
      true,
      'PAY-2026-14'::text,
      'Includes overtime for Saturday route support.'::text,
      now() - interval '26 days',
      now() - interval '26 days'
    )
) as seeded(
  id,
  expense_date,
  category,
  vendor,
  description,
  amount_cents,
  status,
  payment_method,
  asset_reference,
  tax_deductible,
  receipt_reference,
  notes,
  created_at,
  updated_at
);

insert into public.bookings (
  id,
  created_at,
  updated_at,
  business_id,
  customer_id,
  customer_first_name,
  customer_last_name,
  customer_email,
  customer_phone,
  customer_street,
  customer_city,
  customer_state,
  customer_zip,
  delivery_date,
  pickup_date,
  pickup_mode,
  status,
  total_price_cents,
  service_town,
  service_county,
  notes,
  placement_preference,
  placement_details,
  access_issues,
  gate_instructions,
  delivery_presence,
  alternate_contact_name,
  alternate_contact_phone,
  special_delivery_instructions,
  base_rental_price_cents,
  included_rental_days,
  rental_duration_days,
  extra_days,
  daily_overage_price_cents,
  extra_days_charge_cents,
  subtotal_cents,
  taxable_subtotal_cents,
  tax_cents,
  max_rental_days_snapshot,
  allow_extended_rental_at_booking_snapshot
)
values
  (
    '12000000-0000-4000-8000-000000000001',
    now() - interval '14 days',
    now() - interval '2 hours',
    (select id from seed_tan_can_man_business),
    '10000000-0000-4000-8000-000000000001',
    'Alice',
    'Benton',
    'alice.benton@example.com',
    '3155550101',
    '12 Lakeview Dr',
    'Chittenango',
    'NY',
    '13037',
    current_date + 2,
    current_date + 12,
    'date',
    'confirmed',
    45900,
    'Chittenango',
    'Madison',
    'Basement cleanout before cabinet install.',
    'right_side_of_driveway',
    'Keep the container tight to the garage apron.',
    '["narrow_driveway"]'::jsonb,
    null,
    'call_if_issue',
    'Evan Benton',
    '3155550199',
    'Customer will be at work. Text photos after drop-off.',
    42500,
    10,
    10,
    0,
    1500,
    0,
    42500,
    42500,
    3400,
    21,
    true
  ),
  (
    '12000000-0000-4000-8000-000000000002',
    now() - interval '10 days',
    now() - interval '1 day',
    (select id from seed_tan_can_man_business),
    '10000000-0000-4000-8000-000000000002',
    'Marcus',
    'Hale',
    'marcus.hale@example.com',
    '3155550102',
    '84 Quarry Rd',
    'Canastota',
    'NY',
    '13032',
    current_date + 5,
    current_date + 16,
    'date',
    'scheduled',
    47520,
    'Canastota',
    'Madison',
    'Concrete and framing debris for garage tear-down.',
    'jobsite_custom_area',
    'Set beside the chain-link fence near the excavator.',
    '["low_clearance_branch"]'::jsonb,
    'Open yard gate on arrival.',
    'deliver_without_customer',
    null,
    null,
    'Driver can call the foreman if the lot is crowded.',
    42500,
    10,
    11,
    1,
    1500,
    1500,
    44000,
    44000,
    3520,
    21,
    true
  ),
  (
    '12000000-0000-4000-8000-000000000003',
    now() - interval '8 days',
    now() - interval '4 hours',
    (select id from seed_tan_can_man_business),
    '10000000-0000-4000-8000-000000000003',
    'Priya',
    'Desai',
    'priya.desai@example.com',
    '3155550103',
    '455 Ridge St',
    'Fayetteville',
    'NY',
    '13066',
    current_date - 4,
    null,
    'request',
    'delivered',
    45900,
    'Fayetteville',
    'Onondaga',
    'On site now. Customer expects pickup request later this week.',
    'driveway',
    'Straight placement at the top of the driveway.',
    '[]'::jsonb,
    null,
    'customer_present',
    null,
    null,
    'Avoid the basketball hoop when lifting.',
    42500,
    10,
    10,
    0,
    1500,
    0,
    42500,
    42500,
    3400,
    21,
    true
  ),
  (
    '12000000-0000-4000-8000-000000000004',
    now() - interval '20 days',
    now() - interval '6 hours',
    (select id from seed_tan_can_man_business),
    '10000000-0000-4000-8000-000000000004',
    'Jonah',
    'Mercer',
    'jonah.mercer@example.com',
    '3155550104',
    '901 County Route 5',
    'Cazenovia',
    'NY',
    '13035',
    current_date - 14,
    current_date - 1,
    'date',
    'delivered',
    50760,
    'Cazenovia',
    'Madison',
    'Roof tear-off is still running late. Admin should see overage and extension activity.',
    'alley_side_access',
    'Place on the gravel lane by the barn.',
    '["soft_ground_when_wet"]'::jsonb,
    'Use the side gate if the front lane is blocked.',
    'call_if_issue',
    'Marla Mercer',
    '3155550188',
    'Do not block the feed delivery lane.',
    42500,
    10,
    13,
    3,
    1500,
    4500,
    47000,
    47000,
    3760,
    21,
    true
  ),
  (
    '12000000-0000-4000-8000-000000000005',
    now() - interval '45 days',
    now() - interval '18 days',
    (select id from seed_tan_can_man_business),
    '10000000-0000-4000-8000-000000000001',
    'Alice',
    'Benton',
    'alice.benton@example.com',
    '3155550101',
    '12 Lakeview Dr',
    'Chittenango',
    'NY',
    '13037',
    current_date - 30,
    current_date - 20,
    'date',
    'picked_up',
    45900,
    'Chittenango',
    'Madison',
    'Completed spring garage cleanout.',
    'left_side_of_driveway',
    'Leave room for the family van to back out.',
    '[]'::jsonb,
    null,
    'deliver_without_customer',
    null,
    null,
    'No weekend pickup needed.',
    42500,
    10,
    10,
    0,
    1500,
    0,
    42500,
    42500,
    3400,
    21,
    true
  ),
  (
    '12000000-0000-4000-8000-000000000006',
    now() - interval '3 days',
    now() - interval '12 hours',
    (select id from seed_tan_can_man_business),
    '10000000-0000-4000-8000-000000000005',
    'Sofia',
    'Alvarez',
    'sofia.alvarez@example.com',
    '3155550105',
    '233 Canal St',
    'Minoa',
    'NY',
    '13116',
    current_date + 8,
    current_date + 18,
    'date',
    'cancelled',
    45900,
    'Minoa',
    'Onondaga',
    'Permit delay forced the project to pause.',
    'street_curb',
    'Original request was curbside in front of the house.',
    '[]'::jsonb,
    null,
    'customer_present',
    null,
    null,
    'Cancelled before delivery.',
    42500,
    10,
    10,
    0,
    1500,
    0,
    42500,
    42500,
    3400,
    21,
    true
  );

insert into public.bookings (
  id,
  created_at,
  updated_at,
  business_id,
  customer_id,
  customer_first_name,
  customer_last_name,
  customer_email,
  customer_phone,
  customer_street,
  customer_city,
  customer_state,
  customer_zip,
  delivery_date,
  pickup_date,
  pickup_mode,
  status,
  total_price_cents,
  service_town,
  service_county,
  notes,
  placement_preference,
  placement_details,
  access_issues,
  gate_instructions,
  delivery_presence,
  alternate_contact_name,
  alternate_contact_phone,
  special_delivery_instructions,
  dumpster_size,
  dumpster_product_id,
  base_rental_price_cents,
  included_rental_days,
  rental_duration_days,
  extra_days,
  daily_overage_price_cents,
  extra_days_charge_cents,
  subtotal_cents,
  taxable_subtotal_cents,
  tax_cents,
  max_rental_days_snapshot,
  allow_extended_rental_at_booking_snapshot
)
values
  (
    '21200000-0000-4000-8000-000000000001',
    now() - interval '4 days',
    now() - interval '1 hour',
    (select id from seed_demo_dumpster_business),
    '21000000-0000-4000-8000-000000000002',
    'Morgan',
    'Lee',
    'morgan.lee@example.test',
    '5125550182',
    '4401 S Congress Ave',
    'Austin',
    'TX',
    '78745',
    current_date + 4,
    current_date + 14,
    'date',
    'scheduled',
    56700,
    'Austin',
    'Travis',
    'Demo tenant booking for a retail renovation sales walkthrough.',
    'jobsite_custom_area',
    'Place behind the building near the contractor entrance.',
    '["gate_access"]'::jsonb,
    'Call Morgan to open the rear gate.',
    'call_if_issue',
    null,
    null,
    'Keep the container clear of the loading bay.',
    '20 yard',
    'demo-20-yard',
    52500,
    10,
    10,
    0,
    3000,
    0,
    52500,
    52500,
    4200,
    14,
    true
  );

insert into public.booking_requests (
  id,
  booking_id,
  customer_id,
  request_type,
  status,
  message,
  requested_pickup_date,
  requested_extension_days,
  created_at,
  updated_at
)
values
  (
    '13000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    'pickup',
    'submitted',
    'Can you pick this up on Friday morning if the driveway is clear?',
    current_date + 3,
    null,
    now() - interval '6 hours',
    now() - interval '6 hours'
  ),
  (
    '13000000-0000-4000-8000-000000000002',
    '12000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000004',
    'extension',
    'approved',
    'Need three more days to finish the roof decking.',
    null,
    3,
    now() - interval '2 days',
    now() - interval '18 hours'
  ),
  (
    '13000000-0000-4000-8000-000000000003',
    '12000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'issue',
    'reviewed',
    'Please confirm the gate swing will clear the delivery truck.',
    null,
    null,
    now() - interval '1 day',
    now() - interval '20 hours'
  );

insert into public.rental_action_requests (
  id,
  booking_id,
  customer_id,
  business_id,
  action_type,
  status,
  customer_visible_status,
  priority,
  details_json,
  internal_notes,
  customer_update,
  reviewed_by,
  submitted_at,
  reviewed_at,
  resolved_at,
  created_at,
  updated_at
)
values
  (
    '14000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    (select id from seed_tan_can_man_business),
    'pickup_request',
    'submitted',
    'received',
    'normal',
    jsonb_build_object(
      'requestedPickupDate', to_char(current_date + 3, 'YYYY-MM-DD'),
      'accessConfirmed', true,
      'notes', 'Driveway should be clear after 9 AM.'
    ),
    'Awaiting dispatcher review.',
    'Customer requested Friday pickup.',
    null,
    now() - interval '6 hours',
    null,
    null,
    now() - interval '6 hours',
    now() - interval '6 hours'
  ),
  (
    '14000000-0000-4000-8000-000000000002',
    '12000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000004',
    (select id from seed_tan_can_man_business),
    'extension_request',
    'approved',
    'under_review',
    'high',
    jsonb_build_object(
      'requestedExtensionDays', 3,
      'currentPickupDate', to_char(current_date - 1, 'YYYY-MM-DD'),
      'requestedNewPickupDate', to_char(current_date + 2, 'YYYY-MM-DD')
    ),
    'Approved by operations while reroofing wraps up.',
    'Three extra days approved at the standard daily overage rate.',
    'ops@tincanman.local',
    now() - interval '2 days',
    now() - interval '36 hours',
    null,
    now() - interval '2 days',
    now() - interval '18 hours'
  ),
  (
    '14000000-0000-4000-8000-000000000003',
    '12000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    (select id from seed_tan_can_man_business),
    'issue_report',
    'completed',
    'completed',
    'low',
    jsonb_build_object(
      'category', 'site_access',
      'note', 'Foreman confirmed the gate will stay open on delivery day.'
    ),
    'Closed after confirming site access with the foreman.',
    'We have your gate instructions and the driver will follow them.',
    'dispatch@tincanman.local',
    now() - interval '1 day',
    now() - interval '20 hours',
    now() - interval '18 hours',
    now() - interval '1 day',
    now() - interval '18 hours'
  );

insert into public.booking_holds (
  id,
  business_id,
  delivery_date,
  expires_at,
  status,
  client_id,
  zip,
  created_at
)
values
  (
    '15000000-0000-4000-8000-000000000001',
    (select id from seed_tan_can_man_business),
    current_date + 1,
    now() + interval '15 minutes',
    'active',
    'qa-active-client-1',
    '13037',
    now() - interval '2 minutes'
  ),
  (
    '15000000-0000-4000-8000-000000000002',
    (select id from seed_tan_can_man_business),
    current_date + 6,
    now() + interval '5 minutes',
    'converting',
    'qa-converting-client-1',
    '13032',
    now() - interval '10 minutes'
  ),
  (
    '15000000-0000-4000-8000-000000000003',
    (select id from seed_tan_can_man_business),
    current_date - 1,
    now() - interval '30 minutes',
    'expired',
    'qa-expired-client-1',
    '13066',
    now() - interval '2 hours'
  );

insert into public.booking_holds (
  id,
  business_id,
  delivery_date,
  expires_at,
  status,
  client_id,
  zip,
  dumpster_size,
  dumpster_product_id,
  created_at
)
values
  (
    '21500000-0000-4000-8000-000000000001',
    (select id from seed_demo_dumpster_business),
    current_date + 2,
    now() + interval '20 minutes',
    'active',
    'demo-active-client-1',
    '78704',
    '12 yard',
    'demo-12-yard',
    now() - interval '5 minutes'
  );

commit;
