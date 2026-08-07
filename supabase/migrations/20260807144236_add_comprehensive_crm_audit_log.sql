create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.crm_audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  action text not null,
  module text not null default 'crm',
  summary text not null,
  entity_type text,
  entity_id text,
  client_id uuid,
  sale_id uuid,
  offer_id uuid,
  path text,
  correlation_id text,
  session_id text,
  changed_fields text[] not null default '{}',
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  request_id text
);

create index if not exists crm_audit_logs_created_at_idx
  on public.crm_audit_logs (created_at desc);

create index if not exists crm_audit_logs_actor_created_idx
  on public.crm_audit_logs (actor_user_id, created_at desc);

create index if not exists crm_audit_logs_module_created_idx
  on public.crm_audit_logs (module, created_at desc);

create index if not exists crm_audit_logs_event_created_idx
  on public.crm_audit_logs (event_type, created_at desc);

create index if not exists crm_audit_logs_correlation_idx
  on public.crm_audit_logs (correlation_id, event_type)
  where correlation_id is not null;

create index if not exists crm_audit_logs_client_idx
  on public.crm_audit_logs (client_id, created_at desc)
  where client_id is not null;

alter table public.crm_audit_logs enable row level security;

revoke all on table public.crm_audit_logs from anon, authenticated, service_role;
grant select, insert on table public.crm_audit_logs to service_role;

comment on table public.crm_audit_logs is
  'Niemodyfikowalny dziennik aktywności CRM. Odczyt wyłącznie przez zabezpieczone API administratora.';

comment on column public.crm_audit_logs.old_values is
  'Migawka rekordu przed zmianą, z pominięciem sekretów i dużych danych binarnych.';

comment on column public.crm_audit_logs.new_values is
  'Migawka rekordu po zmianie, z pominięciem sekretów i dużych danych binarnych.';

do $$
begin
  if to_regclass('public.user_activity_logs') is not null then
    execute $legacy_backfill$
      insert into public.crm_audit_logs (
        id,
        created_at,
        actor_user_id,
        event_type,
        action,
        module,
        summary,
        entity_type,
        entity_id,
        client_id,
        offer_id,
        path,
        correlation_id,
        session_id,
        metadata,
        user_agent,
        request_id
      )
      select
        legacy.id,
        legacy.occurred_at,
        legacy.user_id,
        case legacy.event_type
          when 'crm_visit' then 'session_started'
          when 'crm_resume' then 'session_resumed'
          when 'client_opened' then 'page_view'
          when 'offer_calculated' then 'calculation_completed'
          else legacy.event_type
        end,
        case legacy.event_type
          when 'crm_visit' then 'login'
          when 'crm_resume' then 'resume'
          when 'client_opened' then 'view'
          when 'offer_calculated' then 'calculate'
          when 'offer_saved' then 'save'
          when 'offer_sent' then 'send'
          else 'legacy_event'
        end,
        case
          when legacy.event_type = 'client_opened' or legacy.path like '/clients%' then 'clients'
          when legacy.event_type like 'offer_%' or legacy.path like '/offers%' then 'offers'
          when legacy.path like '/sales%' then 'sales'
          when legacy.path like '/calculator%' then 'calculator'
          when legacy.path like '/calendar%' then 'calendar'
          when legacy.path like '/reports%' then 'reports'
          when legacy.path like '/admin%' then 'admin'
          when legacy.path = '/' then 'dashboard'
          else 'crm'
        end,
        case legacy.event_type
          when 'crm_visit' then 'Użytkownik wszedł do CRM'
          when 'crm_resume' then 'Użytkownik wrócił do aktywnej sesji CRM'
          when 'client_opened' then 'Otwarto kartę klienta'
          when 'offer_calculated' then 'Wykonano kalkulację oferty'
          when 'offer_saved' then 'Zapisano ofertę w CRM'
          when 'offer_sent' then 'Wysłano ofertę'
          else 'Zdarzenie ze starszej wersji modułu logów: ' || legacy.event_type
        end,
        case
          when legacy.client_id is not null then 'clients'
          when legacy.offer_id is not null then 'client_offers'
          when legacy.calculation_id is not null then 'calculation'
          else null
        end,
        coalesce(
          legacy.client_id::text,
          legacy.offer_id::text,
          legacy.calculation_id::text
        ),
        legacy.client_id,
        legacy.offer_id,
        legacy.path,
        legacy.calculation_id::text,
        legacy.visit_id::text,
        coalesce(legacy.metadata, '{}'::jsonb) || jsonb_build_object(
          'imported_from_legacy_log', true,
          'legacy_event_type', legacy.event_type,
          'legacy_received_at', legacy.received_at
        ),
        legacy.user_agent,
        legacy.client_event_id::text
      from public.user_activity_logs legacy
      on conflict (id) do nothing
    $legacy_backfill$;
  end if;
end;
$$;

create or replace function private.crm_audit_sanitize_snapshot(payload jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when payload is null then null
    else payload - array[
      'password',
      'password_hash',
      'access_token',
      'refresh_token',
      'token',
      'api_key',
      'secret',
      'client_secret',
      'source_image_data',
      'file_data',
      'pdf_base64'
    ]::text[]
  end;
$$;

revoke all on function private.crm_audit_sanitize_snapshot(jsonb) from public, anon, authenticated;

create or replace function private.capture_crm_audit_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  old_snapshot jsonb;
  new_snapshot jsonb;
  row_snapshot jsonb;
  changed_columns text[] := '{}';
  actor_id uuid;
  client_uuid uuid;
  sale_uuid uuid;
  offer_uuid uuid;
  record_identifier text;
  action_label text;
begin
  old_snapshot := case
    when tg_op in ('UPDATE', 'DELETE')
      then private.crm_audit_sanitize_snapshot(to_jsonb(old))
    else null
  end;
  new_snapshot := case
    when tg_op in ('INSERT', 'UPDATE')
      then private.crm_audit_sanitize_snapshot(to_jsonb(new))
    else null
  end;
  row_snapshot := coalesce(new_snapshot, old_snapshot, '{}'::jsonb);
  actor_id := auth.uid();

  if actor_id is null and
     coalesce(
       row_snapshot ->> 'updated_by',
       row_snapshot ->> 'created_by',
       row_snapshot ->> 'sent_by'
     ) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    actor_id := coalesce(
      row_snapshot ->> 'updated_by',
      row_snapshot ->> 'created_by',
      row_snapshot ->> 'sent_by'
    )::uuid;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(field_name order by field_name), '{}')
      into changed_columns
    from (
      select key as field_name from jsonb_object_keys(coalesce(old_snapshot, '{}'::jsonb)) as key
      union
      select key as field_name from jsonb_object_keys(coalesce(new_snapshot, '{}'::jsonb)) as key
    ) fields
    where old_snapshot -> field_name is distinct from new_snapshot -> field_name;
  elsif tg_op = 'INSERT' then
    select coalesce(array_agg(key order by key), '{}')
      into changed_columns
    from jsonb_object_keys(coalesce(new_snapshot, '{}'::jsonb)) as key;
  end if;

  record_identifier := coalesce(row_snapshot ->> 'id', row_snapshot ->> 'uuid');

  if tg_table_name = 'clients' then
    client_uuid := case
      when record_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then record_identifier::uuid
      else null
    end;
  elsif coalesce(row_snapshot ->> 'client_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    client_uuid := (row_snapshot ->> 'client_id')::uuid;
  end if;

  if tg_table_name = 'sales' then
    sale_uuid := case
      when record_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then record_identifier::uuid
      else null
    end;
  elsif coalesce(row_snapshot ->> 'sale_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    sale_uuid := (row_snapshot ->> 'sale_id')::uuid;
  end if;

  if tg_table_name = 'client_offers' and
     coalesce(record_identifier, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    offer_uuid := record_identifier::uuid;
  elsif coalesce(row_snapshot ->> 'offer_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    offer_uuid := (row_snapshot ->> 'offer_id')::uuid;
  end if;

  action_label := case tg_op
    when 'INSERT' then 'create'
    when 'UPDATE' then 'update'
    when 'DELETE' then 'delete'
    else lower(tg_op)
  end;

  insert into public.crm_audit_logs (
    actor_user_id,
    event_type,
    action,
    module,
    summary,
    entity_type,
    entity_id,
    client_id,
    sale_id,
    offer_id,
    changed_fields,
    old_values,
    new_values,
    metadata
  )
  values (
    actor_id,
    'data_change',
    action_label,
    tg_table_name,
    case tg_op
      when 'INSERT' then 'Utworzono rekord w tabeli ' || tg_table_name
      when 'UPDATE' then 'Zmieniono rekord w tabeli ' || tg_table_name
      when 'DELETE' then 'Usunięto rekord z tabeli ' || tg_table_name
      else tg_op || ' w tabeli ' || tg_table_name
    end,
    tg_table_name,
    record_identifier,
    client_uuid,
    sale_uuid,
    offer_uuid,
    changed_columns,
    old_snapshot,
    new_snapshot,
    jsonb_build_object('database_operation', tg_op)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.capture_crm_audit_change() from public, anon, authenticated;

do $$
declare
  audited_table record;
begin
  for audited_table in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename <> 'crm_audit_logs'
      and tablename <> 'user_activity_logs'
      and tablename not like 'pg_%'
  loop
    execute format(
      'drop trigger if exists crm_audit_row_change on public.%I',
      audited_table.tablename
    );
    execute format(
      'create trigger crm_audit_row_change after insert or update or delete on public.%I for each row execute function private.capture_crm_audit_change()',
      audited_table.tablename
    );
  end loop;
end;
$$;
