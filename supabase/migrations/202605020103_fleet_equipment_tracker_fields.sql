alter table public.fleet_equipment
  add column if not exists tracker_installation_date date,
  add column if not exists tracker_last_check_in timestamptz,
  add column if not exists tracker_status text,
  add column if not exists tracker_notes text;

alter table public.fleet_equipment
  drop constraint if exists fleet_equipment_tracker_status_check;

alter table public.fleet_equipment
  add constraint fleet_equipment_tracker_status_check
    check (tracker_status is null or tracker_status in ('Online', 'Offline', 'Needs attention', 'Not installed'));
