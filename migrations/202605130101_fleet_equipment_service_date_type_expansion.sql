alter table public.fleet_equipment_service_dates
  drop constraint if exists fleet_equipment_service_dates_service_type_check;

alter table public.fleet_equipment_service_dates
  add constraint fleet_equipment_service_dates_service_type_check
    check (
      service_type in (
        'Inspection',
        'Registration',
        'Insurance',
        'Maintenance',
        'Repair',
        'Cleaning',
        'Other'
      )
    );
