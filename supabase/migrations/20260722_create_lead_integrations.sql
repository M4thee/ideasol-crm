create extension if not exists pgcrypto;

create table if not exists public.lead_integrations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  source_type text not null,
  campaign_name text not null,
  external_form_id text,
  is_active boolean not null default true,
  assignment_rule text not null default 'round_robin'
    check (assignment_rule in ('random', 'postal_code', 'round_robin')),
  tag_names text[] not null default '{}',
  field_mapping jsonb not null default '{}'::jsonb,
  notify_assigned_user boolean not null default true,
  notify_owners boolean not null default true,
  round_robin_cursor bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_integration_users (
  integration_id uuid not null references public.lead_integrations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (integration_id, user_id)
);

create index if not exists lead_integrations_source_type_idx
  on public.lead_integrations(source_type, is_active);

create index if not exists lead_integration_users_order_idx
  on public.lead_integration_users(integration_id, position, user_id);

alter table if exists public.meta_leads
  add column if not exists integration_id uuid references public.lead_integrations(id) on delete set null;

alter table public.lead_integrations enable row level security;
alter table public.lead_integration_users enable row level security;

drop policy if exists "Admins manage lead integrations" on public.lead_integrations;
create policy "Admins manage lead integrations"
on public.lead_integrations
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

drop policy if exists "Admins manage lead integration users" on public.lead_integration_users;
create policy "Admins manage lead integration users"
on public.lead_integration_users
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create or replace function public.claim_next_lead_integration_user(p_integration_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_user_id uuid;
  current_cursor bigint;
  eligible_count integer;
begin
  select round_robin_cursor
  into current_cursor
  from public.lead_integrations
  where id = p_integration_id
  for update;

  select count(*)
  into eligible_count
  from public.lead_integration_users liu
  join public.profiles p on p.id = liu.user_id
  where liu.integration_id = p_integration_id
    and coalesce(p.is_active, true) = true
    and coalesce(p.hidden_from_assignment, false) = false;

  if eligible_count = 0 then
    return null;
  end if;

  select liu.user_id
  into selected_user_id
  from public.lead_integration_users liu
  join public.profiles p on p.id = liu.user_id
  where liu.integration_id = p_integration_id
    and coalesce(p.is_active, true) = true
    and coalesce(p.hidden_from_assignment, false) = false
  order by liu.position, liu.user_id
  offset mod(current_cursor, eligible_count)
  limit 1;

  update public.lead_integrations
  set round_robin_cursor = current_cursor + 1,
      updated_at = now()
  where id = p_integration_id;

  return selected_user_id;
end;
$$;

revoke all on function public.claim_next_lead_integration_user(uuid) from public;
grant execute on function public.claim_next_lead_integration_user(uuid) to service_role;

insert into public.client_tags (name, color, is_system, is_active)
values ('GRANT', '#16a34a', true, true)
on conflict (name) do update set is_active = true;

insert into public.lead_integrations (
  slug,
  name,
  source_type,
  campaign_name,
  assignment_rule,
  tag_names,
  field_mapping,
  notify_assigned_user,
  notify_owners
)
values (
  'meta-grant-radzionkow',
  'Meta Ads — Grant Radzionków',
  'meta',
  'Grant Radzionków',
  'round_robin',
  array['GRANT'],
  '{"fullName":["full_name","imie_i_nazwisko"],"phone":["phone_number","phone","numer_telefonu","telefon"],"postalCode":["postal_code","kod_pocztowy"]}'::jsonb,
  true,
  true
)
on conflict (slug) do nothing;

insert into public.lead_integration_users (integration_id, user_id, position)
select integration.id,
       profile.id,
       row_number() over (order by profile.display_name, profile.id)::integer
from public.lead_integrations integration
cross join public.profiles profile
where integration.slug = 'meta-grant-radzionkow'
  and profile.role in ('seller', 'manager', 'owner')
  and coalesce(profile.is_active, true) = true
  and coalesce(profile.hidden_from_assignment, false) = false
on conflict (integration_id, user_id) do nothing;
