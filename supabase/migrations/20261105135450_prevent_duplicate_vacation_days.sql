create unique index if not exists calendar_events_unique_vacation_day_per_user_idx
  on public.calendar_events (
    assigned_user_id,
    ((event_at at time zone 'UTC')::date)
  )
  where event_type = 'vacation'
    and assigned_user_id is not null
    and event_at is not null;

comment on index public.calendar_events_unique_vacation_day_per_user_idx is
  'Prevents more than one vacation entry per assigned user and UTC calendar day.';
