-- Store the interactive building shape from the preliminary IdeaTermo survey.
-- The defaults preserve existing drafts and give new audits a valid base shape.

alter table public.ideatermo_preaudits
  add column if not exists building_storeys text not null default 'ground_only',
  add column if not exists roof_type text not null default 'pitched_without_attic',
  add column if not exists has_basement boolean not null default false,
  add column if not exists has_integrated_garage boolean not null default false,
  add column if not exists heated_levels text[] not null default array['ground_floor']::text[];

alter table public.ideatermo_preaudits
  drop constraint if exists ideatermo_preaudits_building_storeys_check,
  add constraint ideatermo_preaudits_building_storeys_check
    check (
      building_storeys in (
        'ground_only',
        'ground_plus_1',
        'ground_plus_2',
        'ground_plus_3'
      )
    ),
  drop constraint if exists ideatermo_preaudits_roof_type_check,
  add constraint ideatermo_preaudits_roof_type_check
    check (
      roof_type in (
        'flat',
        'pitched_with_attic',
        'pitched_without_attic'
      )
    ),
  drop constraint if exists ideatermo_preaudits_heated_levels_check,
  add constraint ideatermo_preaudits_heated_levels_check
    check (
      heated_levels <@ array[
        'basement',
        'ground_floor',
        'floor_1',
        'floor_2',
        'floor_3',
        'attic'
      ]::text[]
      and (has_basement or not ('basement' = any(heated_levels)))
      and (
        roof_type = 'pitched_with_attic'
        or not ('attic' = any(heated_levels))
      )
      and (
        building_storeys <> 'ground_only'
        or not ('floor_1' = any(heated_levels))
      )
      and (
        building_storeys in ('ground_plus_2', 'ground_plus_3')
        or not ('floor_2' = any(heated_levels))
      )
      and (
        building_storeys = 'ground_plus_3'
        or not ('floor_3' = any(heated_levels))
      )
    );

comment on column public.ideatermo_preaudits.building_storeys is
  'Above-ground building configuration selected in the preliminary survey.';
comment on column public.ideatermo_preaudits.roof_type is
  'Roof shape and whether a pitched roof contains an attic.';
comment on column public.ideatermo_preaudits.has_basement is
  'Whether the building has a basement.';
comment on column public.ideatermo_preaudits.has_integrated_garage is
  'Whether a garage is integrated into the building body.';
comment on column public.ideatermo_preaudits.heated_levels is
  'Building levels marked as heated in the interactive building preview.';
