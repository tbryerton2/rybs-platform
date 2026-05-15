create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.fleet_equipment (
  id uuid primary key default gen_random_uuid(),
  equipment_type text not null,
  name text not null,
  status text not null default 'active',
  license_plate text,
  vin text,
  tracker_enabled boolean not null default false,
  tracker_provider text,
  tracker_identifier text,
  maintenance_status text,
  maintenance_due_date date,
  registration_expiration_date date,
  inspection_expiration_date date,
  insurance_expiration_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fleet_equipment_equipment_type_check
    check (equipment_type in ('truck', 'trailer')),
  constraint fleet_equipment_status_check
    check (status in ('active', 'inactive', 'maintenance', 'retired'))
);

alter table public.fleet_equipment
  drop constraint if exists fleet_equipment_equipment_id_not_blank,
  drop constraint if exists fleet_equipment_unit_name_not_blank,
  drop constraint if exists fleet_equipment_inspection_status_check,
  drop constraint if exists fleet_equipment_insurance_status_check,
  drop constraint if exists fleet_equipment_maintenance_status_check,
  drop constraint if exists fleet_equipment_tracker_status_check;

alter table public.fleet_equipment
  drop column if exists equipment_id,
  drop column if exists unit_name,
  drop column if exists make,
  drop column if exists model,
  drop column if exists year,
  drop column if exists registration_expiration,
  drop column if exists inspection_status,
  drop column if exists inspection_expiration,
  drop column if exists insurance_status,
  drop column if exists insurance_renewal_date,
  drop column if exists mileage,
  drop column if exists gvwr,
  drop column if exists assigned_team,
  drop column if exists in_service_date,
  drop column if exists last_service_date,
  drop column if exists next_service_due,
  drop column if exists condition_notes,
  drop column if exists title_status,
  drop column if exists default_location,
  drop column if exists tracker_id,
  drop column if exists tracker_installation_date,
  drop column if exists tracker_last_check_in,
  drop column if exists tracker_status,
  drop column if exists tracker_notes;

alter table public.fleet_equipment
  add column if not exists equipment_type text,
  add column if not exists name text,
  add column if not exists status text,
  add column if not exists license_plate text,
  add column if not exists vin text,
  add column if not exists tracker_enabled boolean,
  add column if not exists tracker_provider text,
  add column if not exists tracker_identifier text,
  add column if not exists maintenance_status text,
  add column if not exists maintenance_due_date date,
  add column if not exists registration_expiration_date date,
  add column if not exists inspection_expiration_date date,
  add column if not exists insurance_expiration_date date,
  add column if not exists notes text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.fleet_equipment
set
  equipment_type = lower(equipment_type),
  status = lower(status)
where equipment_type is not null
   or status is not null;

alter table public.fleet_equipment
  alter column equipment_type set not null,
  alter column name set not null,
  alter column status set not null,
  alter column status set default 'active',
  alter column tracker_enabled set not null,
  alter column tracker_enabled set default false,
  alter column created_at set not null,
  alter column created_at set default now(),
  alter column updated_at set not null,
  alter column updated_at set default now();

alter table public.fleet_equipment
  drop constraint if exists fleet_equipment_equipment_type_check,
  drop constraint if exists fleet_equipment_status_check;

alter table public.fleet_equipment
  add constraint fleet_equipment_equipment_type_check
    check (equipment_type in ('truck', 'trailer')),
  add constraint fleet_equipment_status_check
    check (status in ('active', 'inactive', 'maintenance', 'retired'));

create index if not exists fleet_equipment_equipment_type_idx
  on public.fleet_equipment (equipment_type);

create index if not exists fleet_equipment_status_idx
  on public.fleet_equipment (status);

create index if not exists fleet_equipment_maintenance_due_date_idx
  on public.fleet_equipment (maintenance_due_date);

create index if not exists fleet_equipment_tracker_enabled_idx
  on public.fleet_equipment (tracker_enabled);

drop index if exists public.fleet_equipment_next_service_due_idx;
drop index if exists public.fleet_equipment_inspection_expiration_idx;

drop trigger if exists fleet_equipment_set_updated_at on public.fleet_equipment;
create trigger fleet_equipment_set_updated_at
before update on public.fleet_equipment
for each row execute function public.set_updated_at();
