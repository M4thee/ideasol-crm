alter table public.ideatermo_preaudits
  add column if not exists building_length_m numeric(7, 2),
  add column if not exists building_width_m numeric(7, 2),
  add column if not exists average_storey_height_m numeric(4, 2) not null default 2.70,
  add column if not exists climate_zone text not null default 'III',
  add column if not exists ventilation_type text not null default 'natural',
  add column if not exists air_change_rate_per_hour numeric(4, 2),
  add column if not exists planned_wall_insulation_material text,
  add column if not exists planned_wall_insulation_cm numeric(5, 1),
  add column if not exists planned_roof_insulation_material text,
  add column if not exists planned_roof_insulation_cm numeric(5, 1),
  add column if not exists planned_floor_insulation_material text,
  add column if not exists planned_floor_insulation_cm numeric(5, 1),
  add column if not exists planned_window_u_value numeric(4, 2),
  add column if not exists planned_door_u_value numeric(4, 2);

comment on column public.ideatermo_preaudits.climate_zone is
  'Polish design-temperature zone I-V used by the preliminary heat-loss model.';
comment on column public.ideatermo_preaudits.air_change_rate_per_hour is
  'Optional measured or user-supplied air-change rate. When null, the model uses the ventilation-type default.';
comment on column public.ideatermo_preaudits.planned_window_u_value is
  'Target whole-window Uw used only in the post-modernization scenario.';
comment on column public.ideatermo_preaudits.planned_door_u_value is
  'Target whole-door Ud used only in the post-modernization scenario.';

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_building_dimensions_range'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_building_dimensions_range
      check (
        (building_length_m is null or building_length_m between 2 and 100)
        and (building_width_m is null or building_width_m between 2 and 100)
        and average_storey_height_m between 2 and 5
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_climate_zone_valid'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_climate_zone_valid
      check (climate_zone in ('I', 'II', 'III', 'IV', 'V'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_ventilation_valid'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_ventilation_valid
      check (
        ventilation_type in (
          'natural',
          'mechanical_exhaust',
          'balanced_without_heat_recovery',
          'balanced_with_heat_recovery'
        )
        and (
          air_change_rate_per_hour is null
          or air_change_rate_per_hour between 0.1 and 2.5
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_planned_insulation_range'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_planned_insulation_range
      check (
        (planned_wall_insulation_cm is null or planned_wall_insulation_cm between 1 and 60)
        and (planned_roof_insulation_cm is null or planned_roof_insulation_cm between 1 and 80)
        and (planned_floor_insulation_cm is null or planned_floor_insulation_cm between 1 and 50)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideatermo_preaudits_target_u_values_range'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_target_u_values_range
      check (
        (planned_window_u_value is null or planned_window_u_value between 0.3 and 3)
        and (planned_door_u_value is null or planned_door_u_value between 0.3 and 4)
      );
  end if;
end
$migration$;
