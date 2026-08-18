create table public.energy_storage_calculator_sessions (
  id uuid primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address inet,
  country_code text,
  region text,
  city text,
  postal_code text,
  timezone text,
  user_agent text,
  accept_language text,
  referrer text,
  landing_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  device_type text,
  screen_width integer,
  screen_height integer,
  is_test boolean not null default false,
  max_step smallint not null default 0 check (max_step between 0 and 10),
  last_event text not null default 'calculator_view',
  event_count integer not null default 0 check (event_count >= 0),
  started_at timestamptz,
  recommendation_at timestamptz,
  lead_submitted_at timestamptz,
  report_unlocked_at timestamptz,
  recommendation_type text check (
    recommendation_type is null
    or recommendation_type in ('recommended', 'not_recommended')
  ),
  recommended_storage_kwh numeric,
  lead_client_id uuid references public.clients(id) on delete set null
);

comment on table public.energy_storage_calculator_sessions is
  'Server-side audit of visits and progress through the public energy storage calculator.';
comment on column public.energy_storage_calculator_sessions.ip_address is
  'Full request IP address; personal data restricted to server-side admin access.';
comment on column public.energy_storage_calculator_sessions.is_test is
  'True for localhost and other explicitly identified test traffic.';

create index energy_storage_sessions_first_seen_idx
  on public.energy_storage_calculator_sessions (first_seen_at desc);
create index energy_storage_sessions_last_seen_idx
  on public.energy_storage_calculator_sessions (last_seen_at desc);
create index energy_storage_sessions_progress_idx
  on public.energy_storage_calculator_sessions (is_test, max_step, first_seen_at desc);
create index energy_storage_sessions_recommendation_idx
  on public.energy_storage_calculator_sessions (recommendation_type, first_seen_at desc)
  where recommendation_type is not null;
create index energy_storage_sessions_lead_idx
  on public.energy_storage_calculator_sessions (lead_submitted_at desc)
  where lead_submitted_at is not null;

create table public.energy_storage_calculator_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.energy_storage_calculator_sessions(id) on delete cascade,
  event_name text not null check (
    event_name in (
      'calculator_view',
      'calculator_started',
      'step_view',
      'analysis_started',
      'recommendation_shown',
      'lead_submit_attempt',
      'lead_submit_success',
      'lead_submit_failed',
      'report_unlocked',
      'session_closed'
    )
  ),
  step_number smallint check (step_number is null or step_number between 0 and 10),
  step_key text,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 8192),
  created_at timestamptz not null default now()
);

comment on table public.energy_storage_calculator_events is
  'Chronological, non-contact-data event trail for each calculator visit.';

create index energy_storage_events_session_created_idx
  on public.energy_storage_calculator_events (session_id, created_at asc);
create index energy_storage_events_name_created_idx
  on public.energy_storage_calculator_events (event_name, created_at desc);
create index energy_storage_events_created_idx
  on public.energy_storage_calculator_events (created_at desc);

alter table public.energy_storage_calculator_sessions enable row level security;
alter table public.energy_storage_calculator_events enable row level security;

revoke all on table public.energy_storage_calculator_sessions from public, anon, authenticated;
revoke all on table public.energy_storage_calculator_events from public, anon, authenticated;
revoke all on sequence public.energy_storage_calculator_events_id_seq from public, anon, authenticated;

grant select, insert, update, delete on table public.energy_storage_calculator_sessions to service_role;
grant select, insert, update, delete on table public.energy_storage_calculator_events to service_role;
grant usage, select on sequence public.energy_storage_calculator_events_id_seq to service_role;

create policy "Service role manages calculator sessions"
on public.energy_storage_calculator_sessions
for all to service_role using (true) with check (true);

create policy "Service role manages calculator events"
on public.energy_storage_calculator_events
for all to service_role using (true) with check (true);

create function public.sync_energy_storage_calculator_session_progress()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.energy_storage_calculator_sessions
  set
    last_seen_at = new.created_at,
    updated_at = new.created_at,
    last_event = new.event_name,
    event_count = event_count + 1,
    max_step = greatest(max_step, coalesce(new.step_number, 0)),
    started_at = case when new.event_name = 'calculator_started' then coalesce(started_at, new.created_at) else started_at end,
    recommendation_at = case when new.event_name = 'recommendation_shown' then coalesce(recommendation_at, new.created_at) else recommendation_at end,
    lead_submitted_at = case when new.event_name = 'lead_submit_success' then coalesce(lead_submitted_at, new.created_at) else lead_submitted_at end,
    report_unlocked_at = case when new.event_name = 'report_unlocked' then coalesce(report_unlocked_at, new.created_at) else report_unlocked_at end,
    recommendation_type = case
      when new.payload ->> 'recommendation_type' in ('recommended', 'not_recommended') then new.payload ->> 'recommendation_type'
      else recommendation_type
    end,
    recommended_storage_kwh = case
      when coalesce(new.payload ->> 'recommended_storage_kwh', '') ~ '^[0-9]+([.][0-9]+)?$'
        then (new.payload ->> 'recommended_storage_kwh')::numeric
      else recommended_storage_kwh
    end,
    lead_client_id = case
      when coalesce(new.payload ->> 'lead_client_id', '') ~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        then (new.payload ->> 'lead_client_id')::uuid
      else lead_client_id
    end
  where id = new.session_id;

  return new;
end;
$$;

revoke all on function public.sync_energy_storage_calculator_session_progress()
  from public, anon, authenticated;
grant execute on function public.sync_energy_storage_calculator_session_progress() to service_role;

create trigger sync_energy_storage_calculator_session_progress
after insert on public.energy_storage_calculator_events
for each row execute function public.sync_energy_storage_calculator_session_progress();

create function public.get_energy_storage_calculator_analytics_summary(
  p_since timestamptz,
  p_include_test boolean default false
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'visits', count(*),
    'started', count(*) filter (where max_step >= 1),
    'analysis_started', count(*) filter (where max_step >= 6),
    'recommendations', count(*) filter (where max_step >= 7),
    'form_attempts', count(*) filter (where max_step >= 8),
    'leads', count(*) filter (where max_step >= 9),
    'reports_unlocked', count(*) filter (where max_step >= 10),
    'recommended', count(*) filter (where recommendation_type = 'recommended'),
    'not_recommended', count(*) filter (where recommendation_type = 'not_recommended')
  )
  from public.energy_storage_calculator_sessions
  where first_seen_at >= p_since
    and (p_include_test or not is_test);
$$;

revoke all on function public.get_energy_storage_calculator_analytics_summary(timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.get_energy_storage_calculator_analytics_summary(timestamptz, boolean)
  to service_role;
