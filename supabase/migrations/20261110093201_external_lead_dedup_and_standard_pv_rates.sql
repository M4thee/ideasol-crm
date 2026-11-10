-- Point 1: atomically reuse existing Meta/WWW clients after contact normalization.
-- Point 6/7: standard-calculator-only PV structure and installation rates.

alter table public.clients
  add column if not exists phone_dedup_key text
    generated always as (
      case
        when length(regexp_replace(coalesce(nullif(phone, ''), contact_phone, ''), '[^0-9]', '', 'g')) >= 9
          then right(regexp_replace(coalesce(nullif(phone, ''), contact_phone, ''), '[^0-9]', '', 'g'), 9)
        else null
      end
    ) stored,
  add column if not exists email_dedup_key text
    generated always as (nullif(lower(btrim(email)), '')) stored,
  add column if not exists last_lead_activity_at timestamptz;

update public.clients
set last_lead_activity_at = coalesce(updated_at, created_at, now())
where last_lead_activity_at is null;

alter table public.clients
  alter column last_lead_activity_at set default now(),
  alter column last_lead_activity_at set not null;

create index if not exists clients_business_phone_dedup_idx
  on public.clients (business_area, phone_dedup_key)
  where phone_dedup_key is not null;

create index if not exists clients_business_email_dedup_idx
  on public.clients (business_area, email_dedup_key)
  where email_dedup_key is not null;

create index if not exists clients_business_activity_idx
  on public.clients (business_area, last_lead_activity_at desc, id);

create table if not exists public.external_lead_dedup_events (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('meta', 'www')),
  external_uid text,
  client_id uuid references public.clients(id) on delete set null,
  duplicate boolean not null,
  matched_by text not null check (matched_by in ('new', 'phone', 'email')),
  submitted_phone_key text,
  submitted_email_key text,
  assigned_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.external_lead_dedup_events enable row level security;
revoke all on table public.external_lead_dedup_events from public, anon, authenticated;
grant all on table public.external_lead_dedup_events to service_role;

create index if not exists external_lead_dedup_events_client_created_idx
  on public.external_lead_dedup_events (client_id, created_at desc);

create table if not exists public.client_merge_audit (
  id uuid primary key default gen_random_uuid(),
  source_client_uid text not null,
  target_client_uid text not null,
  target_client_id uuid references public.clients(id) on delete set null,
  source_client_snapshot jsonb not null,
  relation_counts_before jsonb not null,
  moved_relations jsonb not null default '{}'::jsonb,
  source_assigned_user_id uuid references public.profiles(id) on delete set null,
  target_assigned_user_id_before uuid references public.profiles(id) on delete set null,
  resolved_assigned_user_id uuid references public.profiles(id) on delete set null,
  advisor_resolution_rule text not null default 'earliest_duplicate_card_with_assigned_advisor',
  decided_by uuid references public.profiles(id) on delete set null,
  decision_note text,
  merged_at timestamptz not null default now()
);

comment on table public.client_merge_audit is
  'Technical, immutable audit of explicit client-card merges; preserves both old and target UIDs.';

alter table public.client_merge_audit enable row level security;
revoke all on table public.client_merge_audit from public, anon, authenticated;
grant select, insert on table public.client_merge_audit to service_role;

alter table public.pricing_settings
  add column if not exists pv_installation_rate_1_10 numeric(12, 2) not null default 600 check (pv_installation_rate_1_10 >= 0),
  add column if not exists pv_installation_rate_10_20 numeric(12, 2) not null default 570 check (pv_installation_rate_10_20 >= 0),
  add column if not exists pv_installation_rate_20_40 numeric(12, 2) not null default 480 check (pv_installation_rate_20_40 >= 0),
  add column if not exists pv_installation_rate_40_100 numeric(12, 2) not null default 360 check (pv_installation_rate_40_100 >= 0),
  add column if not exists pv_installation_rate_above_100 numeric(12, 2) not null default 320 check (pv_installation_rate_above_100 >= 0),
  add column if not exists pv_structure_sheet_rate_per_kwp numeric(12, 2) not null default 175 check (pv_structure_sheet_rate_per_kwp >= 0),
  add column if not exists pv_structure_tile_rate_per_kwp numeric(12, 2) not null default 260 check (pv_structure_tile_rate_per_kwp >= 0),
  add column if not exists pv_structure_felt_rate_per_kwp numeric(12, 2) not null default 325 check (pv_structure_felt_rate_per_kwp >= 0),
  add column if not exists pv_structure_ground_rate_per_kwp numeric(12, 2) not null default 325 check (pv_structure_ground_rate_per_kwp >= 0);

comment on column public.pricing_settings.pv_installation_rate_1_10 is
  'Standard calculator: whole-installation PV mounting rate for power <= 10 kWp.';
comment on column public.pricing_settings.pv_installation_rate_10_20 is
  'Standard calculator: whole-installation PV mounting rate for power > 10 and <= 20 kWp.';
comment on column public.pricing_settings.pv_installation_rate_20_40 is
  'Standard calculator: whole-installation PV mounting rate for power > 20 and <= 40 kWp.';
comment on column public.pricing_settings.pv_installation_rate_40_100 is
  'Standard calculator: whole-installation PV mounting rate for power > 40 and <= 100 kWp.';
comment on column public.pricing_settings.pv_installation_rate_above_100 is
  'Standard calculator: whole-installation PV mounting rate for power > 100 kWp.';
comment on column public.pricing_settings.pv_structure_sheet_rate_per_kwp is
  'Standard calculator only: editable sheet-roof structure rate in PLN net per kWp.';
comment on column public.pricing_settings.pv_structure_tile_rate_per_kwp is
  'Standard calculator only: editable tile-roof structure rate in PLN net per kWp.';
comment on column public.pricing_settings.pv_structure_felt_rate_per_kwp is
  'Standard calculator only: editable flat felt/membrane-roof structure rate in PLN net per kWp.';
comment on column public.pricing_settings.pv_structure_ground_rate_per_kwp is
  'Standard calculator only: editable ground-structure rate in PLN net per kWp.';

create or replace function public.ingest_external_lead(
  p_source text,
  p_external_uid text,
  p_business_area text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_postal_code text,
  p_province text,
  p_client_type text,
  p_assigned_user_id uuid,
  p_note text
)
returns table (
  client_id uuid,
  duplicate boolean,
  assigned_user_id uuid,
  client_status text,
  matched_by text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_phone_key text;
  v_email_key text;
  v_client public.clients%rowtype;
  v_match_method text := 'new';
  v_lock_key text;
begin
  if p_source not in ('meta', 'www') then
    raise exception 'Unsupported external lead source: %', p_source;
  end if;

  v_phone_key := case
    when length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) >= 9
      then right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 9)
    else null
  end;
  v_email_key := nullif(lower(btrim(coalesce(p_email, ''))), '');

  if v_phone_key is null and v_email_key is null then
    raise exception 'External lead requires a normalizable phone or email';
  end if;

  -- Serialize equal phone/email ingestions so concurrent webhooks cannot create twins.
  for v_lock_key in
    select value
    from unnest(array[
      case when v_phone_key is not null then coalesce(p_business_area, 'ideasol') || ':phone:' || v_phone_key end,
      case when v_email_key is not null then coalesce(p_business_area, 'ideasol') || ':email:' || v_email_key end
    ]) as keys(value)
    where value is not null
    order by value
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('external-lead:' || v_lock_key, 0));
  end loop;

  select c.*
  into v_client
  from public.clients c
  where c.business_area = coalesce(nullif(p_business_area, ''), 'ideasol')
    and (
      (v_phone_key is not null and c.phone_dedup_key = v_phone_key)
      or (v_phone_key is null and v_email_key is not null and c.email_dedup_key = v_email_key)
    )
  order by
    case when v_phone_key is not null and c.phone_dedup_key = v_phone_key then 0 else 1 end,
    case when v_email_key is not null and c.email_dedup_key = v_email_key then 0 else 1 end,
    c.last_lead_activity_at desc,
    c.created_at asc,
    c.id
  limit 1
  for update;

  if found then
    v_match_method := case
      when v_phone_key is not null and v_client.phone_dedup_key = v_phone_key then 'phone'
      else 'email'
    end;

    update public.clients
    set last_lead_activity_at = now(), updated_at = now()
    where id = v_client.id
    returning * into v_client;
  else
    insert into public.clients (
      full_name,
      email,
      phone,
      postal_code,
      province,
      client_type,
      status,
      assigned_user_id,
      lead_source,
      business_area,
      last_lead_activity_at
    ) values (
      coalesce(nullif(btrim(p_full_name), ''), case when p_source = 'meta' then 'Lead Meta Ads' else 'Lead WWW' end),
      v_email_key,
      nullif(btrim(p_phone), ''),
      nullif(btrim(p_postal_code), ''),
      nullif(btrim(p_province), ''),
      coalesce(nullif(btrim(p_client_type), ''), 'B2C'),
      case when p_assigned_user_id is null then 'Nowy lead' else 'Przypisany' end,
      p_assigned_user_id,
      case when p_source = 'meta' then 'Meta Ads' else 'WWW' end,
      coalesce(nullif(p_business_area, ''), 'ideasol'),
      now()
    )
    returning * into v_client;
  end if;

  if nullif(btrim(coalesce(p_note, '')), '') is not null then
    insert into public.client_notes (client_id, content, created_by)
    values (v_client.id, p_note, null);
  end if;

  if v_match_method <> 'new' and v_client.assigned_user_id is not null then
    insert into public.notifications (user_id, title, body, client_id, link_url)
    values (
      v_client.assigned_user_id,
      'Ponowne zgłoszenie klienta — wykryto duplikat',
      coalesce(nullif(btrim(p_full_name), ''), v_client.full_name, 'Klient') ||
        ' przesłał ponowne zgłoszenie przez ' || upper(p_source) || '. Dodano ankietę do istniejącej karty.',
      v_client.id,
      '/clients/' || v_client.id::text
    );
  end if;

  insert into public.external_lead_dedup_events (
    source, external_uid, client_id, duplicate, matched_by,
    submitted_phone_key, submitted_email_key, assigned_user_id
  ) values (
    p_source, nullif(p_external_uid, ''), v_client.id, v_match_method <> 'new', v_match_method,
    v_phone_key, v_email_key, v_client.assigned_user_id
  );

  return query
  select v_client.id, v_match_method <> 'new', v_client.assigned_user_id,
         v_client.status, v_match_method;
end;
$$;

revoke all on function public.ingest_external_lead(text, text, text, text, text, text, text, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.ingest_external_lead(text, text, text, text, text, text, text, text, text, uuid, text)
  to service_role;

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
