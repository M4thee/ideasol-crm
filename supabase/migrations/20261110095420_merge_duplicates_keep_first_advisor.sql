-- Preserve the advisor from the earliest duplicate card that had an advisor.
-- The lookup covers the whole normalized-phone group, so the result does not
-- depend on the order in which individual source cards are merged.

alter table public.client_merge_audit
  add column if not exists source_assigned_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists target_assigned_user_id_before uuid references public.profiles(id) on delete set null,
  add column if not exists resolved_assigned_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists advisor_resolution_rule text not null
    default 'earliest_duplicate_card_with_assigned_advisor';

create or replace function public.merge_duplicate_client(
  p_source_client_id uuid,
  p_target_client_id uuid,
  p_decided_by uuid,
  p_decision_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source public.clients%rowtype;
  v_target public.clients%rowtype;
  v_relation record;
  v_count bigint;
  v_counts jsonb := '{}'::jsonb;
  v_moved jsonb := '{}'::jsonb;
  v_audit_id uuid;
  v_shared_phone_key text;
  v_shared_email_key text;
  v_resolved_advisor_id uuid;
begin
  if p_source_client_id = p_target_client_id then
    raise exception 'Source and target client must differ';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('client-merge:' || least(p_source_client_id::text, p_target_client_id::text), 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('client-merge:' || greatest(p_source_client_id::text, p_target_client_id::text), 0)
  );

  select * into v_source from public.clients where id = p_source_client_id for update;
  if not found then raise exception 'Source client % not found', p_source_client_id; end if;
  select * into v_target from public.clients where id = p_target_client_id for update;
  if not found then raise exception 'Target client % not found', p_target_client_id; end if;

  if v_source.business_area is distinct from v_target.business_area then
    raise exception 'Clients belong to different business areas';
  end if;

  v_shared_phone_key := case
    when v_source.phone_dedup_key is not null
     and v_source.phone_dedup_key = v_target.phone_dedup_key
      then v_source.phone_dedup_key
    else null
  end;
  v_shared_email_key := case
    when v_source.email_dedup_key is not null
     and v_source.email_dedup_key = v_target.email_dedup_key
      then v_source.email_dedup_key
    else null
  end;

  if v_shared_phone_key is null and v_shared_email_key is null then
    raise exception 'Clients do not share a normalized phone or email';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'client-merge-identity:' || v_target.business_area || ':' ||
      coalesce('phone:' || v_shared_phone_key, 'email:' || v_shared_email_key),
      0
    )
  );

  select c.assigned_user_id
  into v_resolved_advisor_id
  from public.clients c
  where c.business_area = v_target.business_area
    and c.assigned_user_id is not null
    and (
      (v_shared_phone_key is not null and c.phone_dedup_key = v_shared_phone_key)
      or (
        v_shared_phone_key is null
        and v_shared_email_key is not null
        and c.email_dedup_key = v_shared_email_key
      )
    )
  order by c.created_at asc nulls last, c.id
  limit 1;

  if exists (select 1 from public.ideatermo_preaudits where client_id = p_source_client_id)
     and exists (select 1 from public.ideatermo_preaudits where client_id = p_target_client_id) then
    raise exception 'Both clients have IdeaTermo pre-audits; manual relation decision is required';
  end if;

  if exists (select 1 from public.partner_referrals where client_id = p_source_client_id)
     and exists (select 1 from public.partner_referrals where client_id = p_target_client_id) then
    raise exception 'Both clients have partner referrals; manual relation decision is required';
  end if;

  for v_relation in
    select tc.table_schema, tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema
     and kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_schema = tc.constraint_schema
     and ccu.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_schema = 'public'
      and ccu.table_name = 'clients'
      and tc.table_schema = 'public'
      and tc.table_name <> 'client_tag_links'
      and not (tc.table_name = 'client_merge_audit' and kcu.column_name = 'target_client_id')
    order by tc.table_name, kcu.column_name
  loop
    execute pg_catalog.format(
      'select count(*) from %I.%I where %I = $1',
      v_relation.table_schema, v_relation.table_name, v_relation.column_name
    ) into v_count using p_source_client_id;
    v_counts := v_counts || jsonb_build_object(v_relation.table_name || '.' || v_relation.column_name, v_count);
  end loop;

  select count(*) into v_count from public.client_tag_links where client_id = p_source_client_id;
  v_counts := v_counts || jsonb_build_object('client_tag_links.client_id', v_count);

  insert into public.client_tag_links (client_id, tag_id, created_by, created_at)
  select p_target_client_id, tag_id, created_by, created_at
  from public.client_tag_links
  where client_id = p_source_client_id
  on conflict (client_id, tag_id) do nothing;

  delete from public.client_tag_links where client_id = p_source_client_id;
  get diagnostics v_count = row_count;
  v_moved := v_moved || jsonb_build_object('client_tag_links.client_id', v_count);

  for v_relation in
    select tc.table_schema, tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema
     and kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_schema = tc.constraint_schema
     and ccu.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_schema = 'public'
      and ccu.table_name = 'clients'
      and tc.table_schema = 'public'
      and tc.table_name <> 'client_tag_links'
      and not (tc.table_name = 'client_merge_audit' and kcu.column_name = 'target_client_id')
    order by tc.table_name, kcu.column_name
  loop
    execute pg_catalog.format(
      'update %I.%I set %I = $1 where %I = $2',
      v_relation.table_schema, v_relation.table_name,
      v_relation.column_name, v_relation.column_name
    ) using p_target_client_id, p_source_client_id;
    get diagnostics v_count = row_count;
    v_moved := v_moved || jsonb_build_object(v_relation.table_name || '.' || v_relation.column_name, v_count);
  end loop;

  insert into public.client_notes (client_id, content, created_by)
  values (p_target_client_id, 'Potencjalny dubel, scalono różne UID.', p_decided_by);

  update public.clients
  set updated_at = now(),
      last_lead_activity_at = greatest(last_lead_activity_at, v_source.last_lead_activity_at),
      assigned_user_id = v_resolved_advisor_id,
      status = case
        when v_resolved_advisor_id is not null and status = 'Nowy lead' then 'Przypisany'
        else status
      end
  where id = p_target_client_id;

  insert into public.client_merge_audit (
    source_client_uid, target_client_uid, target_client_id,
    source_client_snapshot, relation_counts_before, moved_relations,
    source_assigned_user_id, target_assigned_user_id_before,
    resolved_assigned_user_id, advisor_resolution_rule,
    decided_by, decision_note
  ) values (
    p_source_client_id::text, p_target_client_id::text, p_target_client_id,
    to_jsonb(v_source), v_counts, v_moved,
    v_source.assigned_user_id, v_target.assigned_user_id,
    v_resolved_advisor_id, 'earliest_duplicate_card_with_assigned_advisor',
    p_decided_by, p_decision_note
  ) returning id into v_audit_id;

  delete from public.clients where id = p_source_client_id;

  return jsonb_build_object(
    'audit_id', v_audit_id,
    'source_client_id', p_source_client_id,
    'target_client_id', p_target_client_id,
    'resolved_assigned_user_id', v_resolved_advisor_id,
    'moved_relations', v_moved
  );
end;
$$;

revoke all on function public.merge_duplicate_client(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.merge_duplicate_client(uuid, uuid, uuid, text)
  to service_role;
