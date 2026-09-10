begin;

do $$
declare
  dashboard_id uuid;
  first_version public.cc_dashboard_versions;
  second_version public.cc_dashboard_versions;
  published_id uuid;
  current_draft_snapshot jsonb;
begin
  insert into public.cc_dashboards (name, slug, draft_snapshot)
  values (
    'Command Center transaction test',
    'command-center-transaction-test-' || substr(gen_random_uuid()::text, 1, 8),
    '{"schemaVersion":1,"pages":[{"id":"first","name":"First","enabled":true,"order":0,"rotationSeconds":30,"widgets":[]}]}'::jsonb
  )
  returning id into dashboard_id;

  select * into first_version
  from public.cc_publish_dashboard(
    dashboard_id,
    '{"schemaVersion":1,"pages":[{"id":"first","name":"First","enabled":true,"order":0,"rotationSeconds":30,"widgets":[]}]}'::jsonb,
    null
  );

  select * into second_version
  from public.cc_publish_dashboard(
    dashboard_id,
    '{"schemaVersion":1,"pages":[{"id":"second","name":"Second","enabled":true,"order":0,"rotationSeconds":30,"widgets":[]}]}'::jsonb,
    null
  );

  select dashboard.published_version_id, dashboard.draft_snapshot
  into published_id, current_draft_snapshot
  from public.cc_dashboards as dashboard
  where dashboard.id = dashboard_id;

  if first_version.version_number <> 1 or second_version.version_number <> 2 then
    raise exception 'Published version numbers are not monotonic';
  end if;

  if published_id <> second_version.id then
    raise exception 'Dashboard does not point to the newest published version';
  end if;

  if current_draft_snapshot #>> '{pages,0,id}' <> 'second' then
    raise exception 'Published snapshot and draft snapshot are inconsistent';
  end if;

  if (select snapshot #>> '{pages,0,id}' from public.cc_dashboard_versions where id = first_version.id) <> 'first' then
    raise exception 'Historical snapshot was mutated';
  end if;
end;
$$;

select 'command_center_publish_ok' as result;

rollback;
