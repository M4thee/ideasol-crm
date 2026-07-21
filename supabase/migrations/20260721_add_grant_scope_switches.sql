alter table public.grant_settings
  add column if not exists enable_pv boolean not null default true,
  add column if not exists enable_heat_pump boolean not null default true,
  add column if not exists enable_combined boolean not null default true;
