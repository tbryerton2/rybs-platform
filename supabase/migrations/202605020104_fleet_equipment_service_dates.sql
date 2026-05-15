create table if not exists public.fleet_equipment_service_dates (
  id uuid primary key default gen_random_uuid(),
  fleet_equipment_id uuid not null references public.fleet_equipment(id) on delete cascade,
  service_date date not null,
  service_type text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fleet_equipment_service_dates_service_type_check
    check (service_type in ('Inspection', 'Maintenance', 'Repair', 'Cleaning', 'Other'))
);

create index if not exists fleet_equipment_service_dates_fleet_equipment_id_idx
  on public.fleet_equipment_service_dates (fleet_equipment_id);

drop trigger if exists fleet_equipment_service_dates_set_updated_at on public.fleet_equipment_service_dates;
create trigger fleet_equipment_service_dates_set_updated_at
before update on public.fleet_equipment_service_dates
for each row execute function public.set_updated_at();
