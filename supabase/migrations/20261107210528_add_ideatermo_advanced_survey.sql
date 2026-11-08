alter table public.ideatermo_preaudits
  add column if not exists total_building_area_m2 numeric(8, 1),
  add column if not exists advanced_survey jsonb not null default '{}'::jsonb;

comment on column public.ideatermo_preaudits.total_building_area_m2 is
  'Approximate total floor area of all heated and unheated parts of the building.';

comment on column public.ideatermo_preaudits.advanced_survey is
  'Optional IdeaTermo advanced-mode answers. Exact income amounts are not stored; only the selected programme band.';

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ideatermo_preaudits_total_area_range'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_total_area_range
      check (
        total_building_area_m2 is null
        or total_building_area_m2 between 1 and 10000
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ideatermo_preaudits_advanced_survey_object'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_advanced_survey_object
      check (jsonb_typeof(advanced_survey) = 'object');
  end if;
end
$migration$;
