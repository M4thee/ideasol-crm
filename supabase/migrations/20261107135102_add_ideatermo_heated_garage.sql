-- Allow the integrated garage to be marked as a heated building zone.

alter table public.ideatermo_preaudits
  drop constraint if exists ideatermo_preaudits_heated_levels_check,
  add constraint ideatermo_preaudits_heated_levels_check
    check (
      heated_levels <@ array[
        'basement',
        'ground_floor',
        'floor_1',
        'floor_2',
        'floor_3',
        'attic',
        'garage'
      ]::text[]
      and (has_basement or not ('basement' = any(heated_levels)))
      and (
        roof_type = 'pitched_with_attic'
        or not ('attic' = any(heated_levels))
      )
      and (
        has_integrated_garage
        or not ('garage' = any(heated_levels))
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

comment on column public.ideatermo_preaudits.heated_levels is
  'Building levels and the integrated garage marked as heated in the interactive preview.';
