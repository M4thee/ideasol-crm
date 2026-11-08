alter table public.ideatermo_preaudits
  add column if not exists floor_insulation_layers jsonb not null default '[]'::jsonb;

comment on column public.ideatermo_preaudits.floor_insulation_layers is
  'Maksymalnie trzy obecne warstwy izolacji podłogi na gruncie albo stropu nad nieogrzewaną piwnicą.';

update public.ideatermo_preaudits
set floor_insulation_layers = jsonb_build_array(
  jsonb_build_object(
    'material', 'unknown',
    'thickness_cm', floor_insulation_cm
  )
)
where floor_insulation_layers = '[]'::jsonb
  and floor_insulation_cm is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ideatermo_preaudits_floor_insulation_layers_array_check'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_floor_insulation_layers_array_check
      check (jsonb_typeof(floor_insulation_layers) = 'array');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ideatermo_preaudits_floor_insulation_layers_max_three_check'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_floor_insulation_layers_max_three_check
      check (jsonb_array_length(floor_insulation_layers) <= 3);
  end if;
end $$;
