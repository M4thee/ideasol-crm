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
    'successful_submissions', count(*) filter (where max_step >= 9),
    'leads', count(distinct lead_client_id) filter (where lead_client_id is not null),
    'reports_unlocked', count(*) filter (where max_step >= 10),
    'recommended', count(*) filter (where recommendation_type = 'recommended'),
    'not_recommended', count(*) filter (where recommendation_type = 'not_recommended')
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
