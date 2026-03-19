alter table public.bookings
  add column if not exists placement_preference text,
  add column if not exists placement_details text,
  add column if not exists access_issues jsonb not null default '[]'::jsonb,
  add column if not exists gate_instructions text,
  add column if not exists delivery_presence text,
  add column if not exists alternate_contact_name text,
  add column if not exists alternate_contact_phone text,
  add column if not exists placement_photo_url text,
  add column if not exists special_delivery_instructions text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_placement_preference_check'
  ) then
    alter table public.bookings
      add constraint bookings_placement_preference_check
      check (
        placement_preference is null
        or placement_preference in (
          'driveway',
          'left_side_of_driveway',
          'right_side_of_driveway',
          'street_curb',
          'parking_lot',
          'alley_side_access',
          'jobsite_custom_area',
          'other'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_delivery_presence_check'
  ) then
    alter table public.bookings
      add constraint bookings_delivery_presence_check
      check (
        delivery_presence is null
        or delivery_presence in (
          'customer_present',
          'deliver_without_customer',
          'call_if_issue'
        )
      );
  end if;
end $$;

create index if not exists bookings_placement_preference_idx
  on public.bookings (placement_preference);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'placement-photos',
  'placement-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
where not exists (
  select 1 from storage.buckets where id = 'placement-photos'
);
