begin;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'cc_dashboards',
    'cc_dashboard_versions',
    'cc_devices',
    'cc_radio_stations'
  ] loop
    if not coalesce((
      select relrowsecurity
      from pg_class
      where oid = format('public.%I', target_table)::regclass
    ), false) then
      raise exception 'RLS is not enabled on public.%', target_table;
    end if;
  end loop;

  if has_table_privilege('anon', 'public.cc_dashboards', 'select,insert,update,delete') then
    raise exception 'anon can access Command Center dashboards';
  end if;

  if has_table_privilege('authenticated', 'public.cc_devices', 'select,insert,update,delete') then
    raise exception 'authenticated can access Command Center devices';
  end if;

  if not has_table_privilege('service_role', 'public.cc_dashboards', 'select,insert,update,delete') then
    raise exception 'service_role cannot manage Command Center dashboards';
  end if;

  if has_function_privilege('authenticated', 'public.cc_publish_dashboard(uuid,jsonb,uuid)', 'execute') then
    raise exception 'authenticated can publish Command Center dashboards';
  end if;

  if not has_function_privilege('service_role', 'public.cc_publish_dashboard(uuid,jsonb,uuid)', 'execute') then
    raise exception 'service_role cannot publish Command Center dashboards';
  end if;
end;
$$;

select 'command_center_security_ok' as result;

rollback;
