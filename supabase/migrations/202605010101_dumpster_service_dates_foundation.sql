create table if not exists public.dumpster_service_dates (
  id uuid primary key default gen_random_uuid(),
  dumpster_id uuid not null references public.dumpsters(id) on delete cascade,
  service_date date not null,
  service_type text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dumpster_service_dates_service_type_check
    check (service_type in ('Inspection', 'Maintenance', 'Repair', 'Cleaning', 'Other'))
);

create index if not exists dumpster_service_dates_dumpster_id_idx
  on public.dumpster_service_dates (dumpster_id);

drop trigger if exists dumpster_service_dates_set_updated_at on public.dumpster_service_dates;
create trigger dumpster_service_dates_set_updated_at
before update on public.dumpster_service_dates
for each row execute function public.set_updated_at();
