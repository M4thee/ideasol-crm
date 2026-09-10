create extension if not exists pgcrypto with schema extensions;

create table public.cc_dashboards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  default_rotation_seconds integer not null default 30
    check (default_rotation_seconds between 10 and 3600),
  draft_snapshot jsonb not null default '{"schemaVersion":1,"pages":[]}'::jsonb,
  published_version_id uuid,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cc_dashboards_snapshot_object check (
    jsonb_typeof(draft_snapshot) = 'object'
    and jsonb_typeof(draft_snapshot -> 'pages') = 'array'
  )
);

create table public.cc_dashboard_versions (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.cc_dashboards(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  constraint cc_dashboard_versions_dashboard_number_key unique (dashboard_id, version_number),
  constraint cc_dashboard_versions_snapshot_object check (
    jsonb_typeof(snapshot) = 'object'
    and jsonb_typeof(snapshot -> 'pages') = 'array'
  )
);

alter table public.cc_dashboards
  add constraint cc_dashboards_published_version_fk
  foreign key (published_version_id)
  references public.cc_dashboard_versions(id)
  on delete set null;

create table public.cc_radio_stations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  stream_url text not null check (stream_url ~ '^https://'),
  homepage_url text,
  is_active boolean not null default true,
  sort_order integer not null default 100 check (sort_order between 0 and 10000),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cc_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  platform text not null default 'browser'
    check (platform in ('browser', 'android_tv', 'google_tv', 'apple_tv', 'fire_tv', 'other')),
  access_token_digest text not null unique
    check (access_token_digest ~ '^[a-f0-9]{64}$'),
  dashboard_id uuid references public.cc_dashboards(id) on delete set null,
  theme text not null default 'auto' check (theme in ('light', 'dark', 'auto')),
  timezone text not null default 'Europe/Warsaw',
  auto_dark_from smallint not null default 19 check (auto_dark_from between 0 and 23),
  auto_light_from smallint not null default 7 check (auto_light_from between 0 and 23),
  radio_station_id uuid references public.cc_radio_stations(id) on delete set null,
  radio_volume smallint not null default 35 check (radio_volume between 0 and 100),
  radio_autoplay boolean not null default false,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  last_seen_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cc_dashboard_versions_dashboard_published_idx
  on public.cc_dashboard_versions (dashboard_id, published_at desc);
create index cc_devices_dashboard_idx on public.cc_devices (dashboard_id);
create index cc_devices_last_seen_idx on public.cc_devices (last_seen_at desc);
create index cc_radio_stations_active_order_idx
  on public.cc_radio_stations (is_active, sort_order, name);

create or replace function public.cc_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cc_dashboards_set_updated_at
before update on public.cc_dashboards
for each row execute function public.cc_set_updated_at();

create trigger cc_radio_stations_set_updated_at
before update on public.cc_radio_stations
for each row execute function public.cc_set_updated_at();

create trigger cc_devices_set_updated_at
before update on public.cc_devices
for each row execute function public.cc_set_updated_at();

create or replace function public.cc_publish_dashboard(
  p_dashboard_id uuid,
  p_snapshot jsonb,
  p_published_by uuid
)
returns public.cc_dashboard_versions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_version integer;
  published_row public.cc_dashboard_versions;
begin
  if jsonb_typeof(p_snapshot) <> 'object'
    or jsonb_typeof(p_snapshot -> 'pages') <> 'array'
    or jsonb_array_length(p_snapshot -> 'pages') = 0 then
    raise exception 'Dashboard snapshot must contain at least one page.';
  end if;

  perform 1
  from public.cc_dashboards
  where id = p_dashboard_id and archived_at is null
  for update;

  if not found then
    raise exception 'Active dashboard not found.';
  end if;

  select coalesce(max(version_number), 0) + 1
  into next_version
  from public.cc_dashboard_versions
  where dashboard_id = p_dashboard_id;

  insert into public.cc_dashboard_versions (
    dashboard_id,
    version_number,
    snapshot,
    published_by
  ) values (
    p_dashboard_id,
    next_version,
    p_snapshot,
    p_published_by
  )
  returning * into published_row;

  update public.cc_dashboards
  set draft_snapshot = p_snapshot,
      published_version_id = published_row.id,
      updated_by = p_published_by
  where id = p_dashboard_id;

  return published_row;
end;
$$;

alter table public.cc_dashboards enable row level security;
alter table public.cc_dashboard_versions enable row level security;
alter table public.cc_devices enable row level security;
alter table public.cc_radio_stations enable row level security;

revoke all on table public.cc_dashboards from anon, authenticated;
revoke all on table public.cc_dashboard_versions from anon, authenticated;
revoke all on table public.cc_devices from anon, authenticated;
revoke all on table public.cc_radio_stations from anon, authenticated;

grant select, insert, update, delete on table public.cc_dashboards to service_role;
grant select, insert, update, delete on table public.cc_dashboard_versions to service_role;
grant select, insert, update, delete on table public.cc_devices to service_role;
grant select, insert, update, delete on table public.cc_radio_stations to service_role;

revoke all on function public.cc_set_updated_at() from public, anon, authenticated;
revoke all on function public.cc_publish_dashboard(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.cc_publish_dashboard(uuid, jsonb, uuid) to service_role;

comment on table public.cc_dashboards is
  'Command Center dashboard definitions. Drafts are mutable; TV clients only receive immutable published versions.';
comment on table public.cc_dashboard_versions is
  'Immutable snapshots published to Command Center devices.';
comment on table public.cc_devices is
  'Registered TV/browser display devices. Raw access tokens are never stored.';
comment on table public.cc_radio_stations is
  'Administrator-managed official HTTPS radio streams; station selection remains per device.';
