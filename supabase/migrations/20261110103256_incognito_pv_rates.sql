-- Incognito keeps an independent price list, but uses the same whole-power
-- installation thresholds and per-kWp structure calculation as standard PV.
-- This is additive and backward-compatible: the previous application ignores
-- these columns, so the database may be migrated before the code deployment.

alter table public.incognito_pricing_settings
  add column if not exists pv_installation_rate_1_10 numeric(12, 2) not null default 600 check (pv_installation_rate_1_10 >= 0),
  add column if not exists pv_installation_rate_10_20 numeric(12, 2) not null default 570 check (pv_installation_rate_10_20 >= 0),
  add column if not exists pv_installation_rate_20_40 numeric(12, 2) not null default 480 check (pv_installation_rate_20_40 >= 0),
  add column if not exists pv_installation_rate_40_100 numeric(12, 2) not null default 360 check (pv_installation_rate_40_100 >= 0),
  add column if not exists pv_installation_rate_above_100 numeric(12, 2) not null default 320 check (pv_installation_rate_above_100 >= 0),
  add column if not exists pv_structure_sheet_rate_per_kwp numeric(12, 2) not null default 175 check (pv_structure_sheet_rate_per_kwp >= 0),
  add column if not exists pv_structure_tile_rate_per_kwp numeric(12, 2) not null default 260 check (pv_structure_tile_rate_per_kwp >= 0),
  add column if not exists pv_structure_felt_rate_per_kwp numeric(12, 2) not null default 325 check (pv_structure_felt_rate_per_kwp >= 0),
  add column if not exists pv_structure_ground_rate_per_kwp numeric(12, 2) not null default 325 check (pv_structure_ground_rate_per_kwp >= 0);

comment on column public.incognito_pricing_settings.pv_installation_rate_1_10 is
  'Incognito calculator: whole-installation PV mounting rate for power <= 10 kWp.';
comment on column public.incognito_pricing_settings.pv_installation_rate_10_20 is
  'Incognito calculator: whole-installation PV mounting rate for power > 10 and <= 20 kWp.';
comment on column public.incognito_pricing_settings.pv_installation_rate_20_40 is
  'Incognito calculator: whole-installation PV mounting rate for power > 20 and <= 40 kWp.';
comment on column public.incognito_pricing_settings.pv_installation_rate_40_100 is
  'Incognito calculator: whole-installation PV mounting rate for power > 40 and <= 100 kWp.';
comment on column public.incognito_pricing_settings.pv_installation_rate_above_100 is
  'Incognito calculator: whole-installation PV mounting rate for power > 100 kWp.';
comment on column public.incognito_pricing_settings.pv_structure_sheet_rate_per_kwp is
  'Incognito calculator: editable sheet-roof structure rate in PLN net per kWp.';
comment on column public.incognito_pricing_settings.pv_structure_tile_rate_per_kwp is
  'Incognito calculator: editable tile-roof structure rate in PLN net per kWp.';
comment on column public.incognito_pricing_settings.pv_structure_felt_rate_per_kwp is
  'Incognito calculator: editable flat felt/membrane-roof structure rate in PLN net per kWp.';
comment on column public.incognito_pricing_settings.pv_structure_ground_rate_per_kwp is
  'Incognito calculator: editable ground-structure rate in PLN net per kWp.';
