-- IdeaTermo lives in the existing CRM, but its data is isolated from IdeaSol
-- at the database boundary.  Existing users and records remain IdeaSol-only.

alter table public.user_permissions
  add column if not exists ideasol boolean not null default true,
  add column if not exists ideatermo boolean not null default false;

insert into public.user_permissions (user_id)
select profile.id
from public.profiles as profile
on conflict (user_id) do nothing;

comment on column public.user_permissions.ideasol is
  'Allows access to the IdeaSol (PV / energy storage) business area.';
comment on column public.user_permissions.ideatermo is
  'Allows access to the IdeaTermo (thermal retrofit) business area.';

alter table public.clients
  add column if not exists business_area text not null default 'ideasol';

alter table public.clients
  drop constraint if exists clients_business_area_check,
  add constraint clients_business_area_check
    check (business_area in ('ideasol', 'ideatermo'));

create index if not exists clients_business_area_assigned_created_idx
  on public.clients (business_area, assigned_user_id, created_at desc);

alter table public.lead_integrations
  add column if not exists business_area text not null default 'ideasol';

alter table public.lead_integrations
  drop constraint if exists lead_integrations_business_area_check,
  add constraint lead_integrations_business_area_check
    check (business_area in ('ideasol', 'ideatermo'));

create index if not exists lead_integrations_business_area_active_idx
  on public.lead_integrations (business_area, is_active, created_at);

comment on column public.lead_integrations.business_area is
  'Business area assigned by an administrator to every lead campaign.';

alter table public.calendar_events
  add column if not exists business_area text not null default 'ideasol';

alter table public.calendar_events
  drop constraint if exists calendar_events_business_area_check,
  add constraint calendar_events_business_area_check
    check (business_area in ('ideasol', 'ideatermo'));

update public.calendar_events as event
set business_area = client.business_area
from public.clients as client
where event.client_id = client.id
  and event.business_area is distinct from client.business_area;

create index if not exists calendar_events_area_assigned_at_idx
  on public.calendar_events (business_area, assigned_user_id, event_at);

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.user_has_business_area_access(required_area text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    (select auth.uid()) is not null
    and required_area in ('ideasol', 'ideatermo')
    and exists (
      select 1
      from public.user_permissions as permission
      where permission.user_id = (select auth.uid())
        and case required_area
          when 'ideasol' then permission.ideasol
          when 'ideatermo' then permission.ideatermo
          else false
        end
    );
$$;

revoke all on function private.user_has_business_area_access(text) from public, anon;
grant execute on function private.user_has_business_area_access(text) to authenticated, service_role;

create or replace function private.user_can_access_ideatermo_owner(
  row_assigned_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles as actor
    where actor.id = (select auth.uid())
      and (
        actor.role in ('admin', 'owner', 'cc')
        or row_assigned_user_id = actor.id
        or (
          actor.role = 'manager'
          and (
            row_assigned_user_id = actor.id
            or exists (
              select 1
              from public.profiles as assigned_profile
              where assigned_profile.id = row_assigned_user_id
                and assigned_profile.manager_id = actor.id
            )
          )
        )
      )
  );
$$;

revoke all on function private.user_can_access_ideatermo_owner(uuid) from public, anon;
grant execute on function private.user_can_access_ideatermo_owner(uuid) to authenticated, service_role;

drop policy if exists clients_business_area_gate on public.clients;
create policy clients_business_area_gate
on public.clients
as restrictive
for all
to authenticated
using (private.user_has_business_area_access(business_area))
with check (private.user_has_business_area_access(business_area));

drop policy if exists clients_ideatermo_owner_gate on public.clients;
create policy clients_ideatermo_owner_gate
on public.clients
as restrictive
for all
to authenticated
using (
  business_area <> 'ideatermo'
  or private.user_can_access_ideatermo_owner(assigned_user_id)
)
with check (
  business_area <> 'ideatermo'
  or private.user_can_access_ideatermo_owner(assigned_user_id)
);

create or replace function private.user_can_access_client(client_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.clients as client
    where client.id = client_uuid
      and private.user_has_business_area_access(client.business_area)
      and (
        client.business_area <> 'ideatermo'
        or private.user_can_access_ideatermo_owner(client.assigned_user_id)
      )
  );
$$;

revoke all on function private.user_can_access_client(uuid) from public, anon;
grant execute on function private.user_can_access_client(uuid) to authenticated, service_role;

create or replace function private.validate_lead_integration_participant_area()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  integration_area text;
  participant_allowed boolean;
begin
  select integration.business_area
    into integration_area
    from public.lead_integrations as integration
    where integration.id = new.integration_id;

  select case integration_area
      when 'ideatermo' then permission.ideatermo
      else permission.ideasol
    end
    into participant_allowed
    from public.user_permissions as permission
    where permission.user_id = new.user_id;

  if coalesce(participant_allowed, false) is not true then
    raise exception 'Lead integration participant lacks access to business area %', integration_area;
  end if;

  return new;
end;
$$;

drop trigger if exists lead_integration_participant_area_gate
on public.lead_integration_users;
create trigger lead_integration_participant_area_gate
before insert or update of integration_id, user_id
on public.lead_integration_users
for each row
execute function private.validate_lead_integration_participant_area();

create or replace function private.sync_calendar_event_business_area()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  client_area text;
begin
  if new.client_id is not null then
    select client.business_area
      into client_area
      from public.clients as client
      where client.id = new.client_id;

    if client_area is null then
      raise exception 'Calendar event client does not exist or is not accessible';
    end if;

    new.business_area := client_area;
  end if;

  return new;
end;
$$;

drop trigger if exists calendar_events_sync_business_area on public.calendar_events;
create trigger calendar_events_sync_business_area
before insert or update of client_id, business_area
on public.calendar_events
for each row
execute function private.sync_calendar_event_business_area();

drop policy if exists calendar_events_business_area_gate on public.calendar_events;
create policy calendar_events_business_area_gate
on public.calendar_events
as restrictive
for all
to authenticated
using (private.user_has_business_area_access(business_area))
with check (private.user_has_business_area_access(business_area));

drop policy if exists calendar_events_ideatermo_owner_gate on public.calendar_events;
create policy calendar_events_ideatermo_owner_gate
on public.calendar_events
as restrictive
for all
to authenticated
using (
  business_area <> 'ideatermo'
  or private.user_can_access_ideatermo_owner(coalesce(assigned_user_id, created_by))
)
with check (
  business_area <> 'ideatermo'
  or private.user_can_access_ideatermo_owner(coalesce(assigned_user_id, created_by))
);

-- Child records inherit access from their client. Restrictive policies are
-- additive to the existing ownership policies and therefore cannot broaden access.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'client_notes',
    'client_activities',
    'client_tag_links'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop policy if exists %I on public.%I', table_name || '_business_area_gate', table_name);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated using (private.user_can_access_client(client_id)) with check (private.user_can_access_client(client_id))',
        table_name || '_business_area_gate',
        table_name
      );
    end if;
  end loop;
end;
$$;

-- Commercial records belong exclusively to IdeaSol. This prevents bypassing
-- the IdeaTermo UI by inserting an offer or sale directly through the API.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['client_offers', 'sales']
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop policy if exists %I on public.%I', table_name || '_business_area_gate', table_name);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated using (private.user_can_access_client(client_id) and exists (select 1 from public.clients as client where client.id = client_id and client.business_area = ''ideasol'')) with check (private.user_can_access_client(client_id) and exists (select 1 from public.clients as client where client.id = client_id and client.business_area = ''ideasol''))',
        table_name || '_business_area_gate',
        table_name
      );
    end if;
  end loop;
end;
$$;

create table if not exists public.ideatermo_preaudits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  status text not null default 'draft'
    check (status in ('draft', 'completed')),
  audit_date date not null default current_date,
  building_type text,
  building_year integer check (building_year is null or building_year between 1800 and 2100),
  heated_area_m2 numeric(10, 2) check (heated_area_m2 is null or heated_area_m2 >= 0),
  household_members integer check (household_members is null or household_members >= 0),
  current_heat_source text,
  annual_fuel_consumption text,
  annual_heating_cost numeric(12, 2) check (annual_heating_cost is null or annual_heating_cost >= 0),
  wall_material text,
  wall_insulation_cm numeric(6, 2) check (wall_insulation_cm is null or wall_insulation_cm >= 0),
  roof_insulation_cm numeric(6, 2) check (roof_insulation_cm is null or roof_insulation_cm >= 0),
  floor_insulation_cm numeric(6, 2) check (floor_insulation_cm is null or floor_insulation_cm >= 0),
  window_type text,
  planned_scope text[] not null default '{}',
  recommended_scope text[] not null default '{}',
  notes text,
  calculation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id)
);

comment on table public.ideatermo_preaudits is
  'IdeaTermo pre-audit forms. They intentionally do not contain pricing, contracts, sales or commission data.';

create index if not exists ideatermo_preaudits_created_by_idx
  on public.ideatermo_preaudits (created_by, updated_at desc);

alter table public.ideatermo_preaudits enable row level security;
grant select, insert, update, delete on public.ideatermo_preaudits to authenticated;
grant select, insert, update, delete on public.ideatermo_preaudits to service_role;

drop policy if exists ideatermo_preaudits_select on public.ideatermo_preaudits;
create policy ideatermo_preaudits_select
on public.ideatermo_preaudits
for select
to authenticated
using (
  private.user_has_business_area_access('ideatermo')
  and private.user_can_access_client(client_id)
);

drop policy if exists ideatermo_preaudits_insert on public.ideatermo_preaudits;
create policy ideatermo_preaudits_insert
on public.ideatermo_preaudits
for insert
to authenticated
with check (
  private.user_has_business_area_access('ideatermo')
  and private.user_can_access_client(client_id)
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

drop policy if exists ideatermo_preaudits_update on public.ideatermo_preaudits;
create policy ideatermo_preaudits_update
on public.ideatermo_preaudits
for update
to authenticated
using (
  private.user_has_business_area_access('ideatermo')
  and private.user_can_access_client(client_id)
)
with check (
  private.user_has_business_area_access('ideatermo')
  and private.user_can_access_client(client_id)
  and updated_by = (select auth.uid())
);

drop policy if exists ideatermo_preaudits_delete on public.ideatermo_preaudits;
create policy ideatermo_preaudits_delete
on public.ideatermo_preaudits
for delete
to authenticated
using (
  private.user_has_business_area_access('ideatermo')
  and private.user_can_access_client(client_id)
);
