create extension if not exists pgcrypto;

create table if not exists public.fleet_equipment (
  id uuid primary key default gen_random_uuid(),
  equipment_id text not null unique,
  equipment_type text not null,
  unit_name text not null,
  status text not null default 'Active',
  make text,
  model text,
  year text,
  vin text,
  license_plate text,
  registration_expiration date,
  inspection_status text not null default 'Current',
  inspection_expiration date,
  insurance_status text not null default 'Current',
  insurance_renewal_date date,
  mileage text,
  gvwr text,
  assigned_team text,
  in_service_date date,
  maintenance_status text not null default 'Current',
  last_service_date date,
  next_service_due date,
  condition_notes text,
  title_status text,
  default_location text,
  tracker_enabled boolean not null default false,
  tracker_provider text,
  tracker_id text,
  tracker_installation_date date,
  tracker_last_check_in timestamptz,
  tracker_status text not null default 'Not installed',
  tracker_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fleet_equipment_equipment_id_not_blank check (char_length(trim(equipment_id)) > 0),
  constraint fleet_equipment_unit_name_not_blank check (char_length(trim(unit_name)) > 0),
  constraint fleet_equipment_equipment_type_check
    check (equipment_type in ('Truck', 'Trailer')),
  constraint fleet_equipment_status_check
    check (status in ('Active', 'Inactive')),
  constraint fleet_equipment_inspection_status_check
    check (inspection_status in ('Current', 'Due soon', 'Expired')),
  constraint fleet_equipment_insurance_status_check
    check (insurance_status in ('Current', 'Due soon', 'Expired')),
  constraint fleet_equipment_maintenance_status_check
    check (maintenance_status in ('Current', 'Due soon', 'Needs service')),
  constraint fleet_equipment_tracker_status_check
    check (tracker_status in ('Online', 'Offline', 'Needs attention', 'Not installed'))
);

create index if not exists fleet_equipment_status_idx
  on public.fleet_equipment (status);

create index if not exists fleet_equipment_equipment_type_idx
  on public.fleet_equipment (equipment_type);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'fleet_equipment'
      and column_name = 'next_service_due'
  ) then
    create index if not exists fleet_equipment_next_service_due_idx
      on public.fleet_equipment (next_service_due);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'fleet_equipment'
      and column_name = 'inspection_expiration'
  ) then
    create index if not exists fleet_equipment_inspection_expiration_idx
      on public.fleet_equipment (inspection_expiration);
  end if;
end
$$;

drop trigger if exists fleet_equipment_set_updated_at on public.fleet_equipment;
create trigger fleet_equipment_set_updated_at
before update on public.fleet_equipment
for each row execute function public.set_updated_at();
