alter table public.ideatermo_preaudits
  add column if not exists current_source_power_kw numeric(6, 2),
  add column if not exists current_fuel_type text,
  add column if not exists annual_fuel_quantity numeric(8, 2),
  add column if not exists annual_fuel_unit text,
  add column if not exists fuel_calorific_value_mj_per_kg numeric(5, 2),
  add column if not exists wood_type text,
  add column if not exists wood_seasoning text,
  add column if not exists fuel_consumption_basis text,
  add column if not exists current_heating_performance text,
  add column if not exists supplemental_heating_used boolean,
  add column if not exists current_source_heats_dhw boolean,
  add column if not exists planned_heat_source text,
  add column if not exists planned_source_heats_dhw boolean,
  add column if not exists heating_distribution_type text,
  add column if not exists heating_supply_temperature_c numeric(4, 1),
  add column if not exists desired_indoor_temperature_c numeric(4, 1) default 21.0;

comment on column public.ideatermo_preaudits.current_source_power_kw is
  'Nominal power of the current source; used only as an oversizing cross-check.';
comment on column public.ideatermo_preaudits.annual_fuel_quantity is
  'Annual fuel consumption in annual_fuel_unit, used for a fuel-energy heat-load estimate.';
comment on column public.ideatermo_preaudits.fuel_consumption_basis is
  'Origin and reliability of the annual fuel-consumption value.';
comment on column public.ideatermo_preaudits.heating_supply_temperature_c is
  'Required heating-system supply temperature during cold weather.';

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_current_source_power_range'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_current_source_power_range
      check (current_source_power_kw is null or current_source_power_kw > 0 and current_source_power_kw <= 200);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_current_fuel_type_valid'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_current_fuel_type_valid
      check (current_fuel_type is null or current_fuel_type in ('pellet', 'hard_coal', 'eco_pea_coal', 'firewood'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_annual_fuel_quantity_range'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_annual_fuel_quantity_range
      check (annual_fuel_quantity is null or annual_fuel_quantity > 0 and annual_fuel_quantity <= 1000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_annual_fuel_unit_valid'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_annual_fuel_unit_valid
      check (annual_fuel_unit is null or annual_fuel_unit in ('t', 'm3'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_fuel_unit_matches_type'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_fuel_unit_matches_type
      check (
        current_fuel_type is null
        or annual_fuel_unit is null
        or current_fuel_type = 'firewood' and annual_fuel_unit = 'm3'
        or current_fuel_type in ('pellet', 'hard_coal', 'eco_pea_coal') and annual_fuel_unit = 't'
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_calorific_value_range'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_calorific_value_range
      check (
        fuel_calorific_value_mj_per_kg is null
        or fuel_calorific_value_mj_per_kg between 5 and 40
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_wood_type_valid'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_wood_type_valid
      check (wood_type is null or wood_type in ('hardwood', 'softwood', 'mixed', 'unknown'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_wood_seasoning_valid'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_wood_seasoning_valid
      check (wood_seasoning is null or wood_seasoning in ('fresh', 'seasoned', 'dry', 'unknown'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_fuel_basis_valid'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_fuel_basis_valid
      check (fuel_consumption_basis is null or fuel_consumption_basis in ('average_2_3_years', 'last_complete_season', 'estimate'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_heating_performance_valid'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_heating_performance_valid
      check (current_heating_performance is null or current_heating_performance in ('maintains_temperature', 'sometimes_underheated', 'frequently_underheated', 'unknown'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_planned_heat_source_valid'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_planned_heat_source_valid
      check (planned_heat_source is null or planned_heat_source in ('air_to_water_heat_pump', 'ground_source_heat_pump', 'pellet_boiler', 'wood_gasification_boiler', 'electric_boiler', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_distribution_type_valid'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_distribution_type_valid
      check (heating_distribution_type is null or heating_distribution_type in ('radiators', 'underfloor', 'mixed', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_supply_temperature_range'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_supply_temperature_range
      check (heating_supply_temperature_c is null or heating_supply_temperature_c between 20 and 95);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_indoor_temperature_range'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_indoor_temperature_range
      check (desired_indoor_temperature_c is null or desired_indoor_temperature_c between 16 and 26);
  end if;
end
$migration$;
