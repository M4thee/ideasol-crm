-- Keep spam in the traffic audit while excluding it from lead conversion totals.
alter table public.energy_storage_calculator_sessions
  add column if not exists is_spam boolean not null default false,
  add column if not exists spam_reason text,
  add column if not exists spam_marked_at timestamptz,
  add column if not exists spam_marked_by uuid references public.profiles(id) on delete set null;

alter table public.energy_storage_calculator_sessions
  drop constraint if exists energy_storage_calculator_sessions_spam_reason_length_check;

alter table public.energy_storage_calculator_sessions
  add constraint energy_storage_calculator_sessions_spam_reason_length_check
  check (spam_reason is null or char_length(spam_reason) between 3 and 500);

comment on column public.energy_storage_calculator_sessions.is_spam is
  'Admin-reviewed spam flag. Spam remains in traffic audit but is excluded from lead conversions.';
comment on column public.energy_storage_calculator_sessions.spam_reason is
  'Reason supplied by the admin who classified the calculator session as spam.';
comment on column public.energy_storage_calculator_sessions.spam_marked_at is
  'Time at which the calculator session was most recently classified as spam.';
comment on column public.energy_storage_calculator_sessions.spam_marked_by is
  'Admin profile that most recently classified the calculator session as spam.';

create index if not exists energy_storage_sessions_spam_idx
  on public.energy_storage_calculator_sessions (first_seen_at desc)
  where is_spam;

create or replace function public.get_energy_storage_calculator_analytics_summary_range(
  p_from timestamptz,
  p_to timestamptz,
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
    'successful_submissions', count(*) filter (where max_step >= 9 and not is_spam),
    'leads', count(distinct lead_client_id) filter (where lead_client_id is not null and not is_spam),
    'reports_unlocked', count(*) filter (where max_step >= 10 and not is_spam),
    'recommended', count(*) filter (where recommendation_type = 'recommended'),
    'not_recommended', count(*) filter (where recommendation_type = 'not_recommended'),
    'spam', count(*) filter (where is_spam)
  )
  from public.energy_storage_calculator_sessions
  where first_seen_at >= p_from
    and first_seen_at < p_to
    and (p_include_test or not is_test);
$$;

revoke all on function public.get_energy_storage_calculator_analytics_summary_range(
  timestamptz,
  timestamptz,
  boolean
) from public, anon, authenticated;
grant execute on function public.get_energy_storage_calculator_analytics_summary_range(
  timestamptz,
  timestamptz,
  boolean
) to service_role;

create or replace function public.get_energy_storage_calculator_analytics_summary(
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
    'successful_submissions', count(*) filter (where max_step >= 9 and not is_spam),
    'leads', count(distinct lead_client_id) filter (where lead_client_id is not null and not is_spam),
    'reports_unlocked', count(*) filter (where max_step >= 10 and not is_spam),
    'recommended', count(*) filter (where recommendation_type = 'recommended'),
    'not_recommended', count(*) filter (where recommendation_type = 'not_recommended'),
    'spam', count(*) filter (where is_spam)
  )
  from public.energy_storage_calculator_sessions
  where first_seen_at >= p_since
    and (p_include_test or not is_test);
$$;

revoke all on function public.get_energy_storage_calculator_analytics_summary(timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.get_energy_storage_calculator_analytics_summary(timestamptz, boolean)
  to service_role;
