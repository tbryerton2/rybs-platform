create unique index if not exists analytics_booking_sessions_id_business_visitor_unique_idx
  on public.analytics_booking_sessions (id, business_id, visitor_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'analytics_booking_events_session_visitor_match_fkey'
      and conrelid = 'public.analytics_booking_events'::regclass
  ) then
    alter table public.analytics_booking_events
      add constraint analytics_booking_events_session_visitor_match_fkey
      foreign key (booking_session_id, business_id, visitor_id)
      references public.analytics_booking_sessions (id, business_id, visitor_id)
      on delete cascade
      not valid;
  end if;
end $$;

comment on constraint analytics_booking_events_session_visitor_match_fkey
  on public.analytics_booking_events is
  'Ensures new booking funnel events use the authoritative visitor owned by the referenced booking session. NOT VALID preserves pre-existing historical rows from the initial race-condition window.';
