-- Refine the IdeaTermo preaudit questionnaire without deleting legacy data.
-- Removed UI fields remain in the table for backwards compatibility with any
-- drafts created before this questionnaire version.

alter table public.ideatermo_preaudits
  add column if not exists heat_source_other text,
  add column if not exists wall_thickness_cm numeric(6, 2),
  add column if not exists wall_insulation_material text,
  add column if not exists roof_insulation_material text,
  add column if not exists windows jsonb not null default '[]'::jsonb,
  add column if not exists external_door_type text,
  add column if not exists external_doors jsonb not null default '[]'::jsonb;

update public.ideatermo_preaudits
set building_type = case
  when building_type in (
    'lokal',
    'dom_wielorodzinny',
    'lokal_mieszkalny_w_budynku_wielorodzinnym'
  ) then 'lokal_mieszkalny_w_budynku_wielorodzinnym'
  else 'dom_jednorodzinny'
end
where building_type is not null;

update public.ideatermo_preaudits
set
  heat_source_other = coalesce(heat_source_other, current_heat_source),
  current_heat_source = 'other'
where current_heat_source is not null
  and current_heat_source not in (
    'solid_fuel_below_class_5',
    'solid_fuel_class_5',
    'gas',
    'electric',
    'other'
  );

alter table public.ideatermo_preaudits
  drop constraint if exists ideatermo_preaudits_building_type_check,
  add constraint ideatermo_preaudits_building_type_check
    check (
      building_type is null
      or building_type in (
        'dom_jednorodzinny',
        'lokal_mieszkalny_w_budynku_wielorodzinnym'
      )
    ),
  drop constraint if exists ideatermo_preaudits_heat_source_check,
  add constraint ideatermo_preaudits_heat_source_check
    check (
      current_heat_source is null
      or current_heat_source in (
        'solid_fuel_below_class_5',
        'solid_fuel_class_5',
        'gas',
        'electric',
        'other'
      )
    ),
  drop constraint if exists ideatermo_preaudits_wall_thickness_check,
  add constraint ideatermo_preaudits_wall_thickness_check
    check (wall_thickness_cm is null or wall_thickness_cm >= 0),
  drop constraint if exists ideatermo_preaudits_windows_array_check,
  add constraint ideatermo_preaudits_windows_array_check
    check (jsonb_typeof(windows) = 'array'),
  drop constraint if exists ideatermo_preaudits_external_doors_array_check,
  add constraint ideatermo_preaudits_external_doors_array_check
    check (jsonb_typeof(external_doors) = 'array'),
  drop constraint if exists ideatermo_preaudits_external_door_type_check,
  add constraint ideatermo_preaudits_external_door_type_check
    check (
      external_door_type is null
      or external_door_type in (
        'old_wooden',
        'old_metal',
        'new_wooden',
        'new_metal',
        'new_plastic'
      )
    );

comment on column public.ideatermo_preaudits.windows is
  'Selected window kinds with the width and height of each individual window.';
comment on column public.ideatermo_preaudits.external_doors is
  'Width and height of each external door included in the planned replacement.';
comment on column public.ideatermo_preaudits.building_year is
  'Legacy field retained for compatibility; the current questionnaire does not collect it.';
comment on column public.ideatermo_preaudits.annual_fuel_consumption is
  'Legacy field retained for compatibility; the current questionnaire does not collect it.';
comment on column public.ideatermo_preaudits.annual_heating_cost is
  'Legacy field retained for compatibility; the current questionnaire does not collect it.';
