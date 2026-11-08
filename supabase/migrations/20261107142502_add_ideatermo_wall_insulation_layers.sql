alter table public.ideatermo_preaudits
  add column if not exists wall_insulation_layers jsonb not null default '[]'::jsonb;

comment on column public.ideatermo_preaudits.wall_insulation_layers is
  'Maksymalnie cztery obecne warstwy izolacji ścian; każda zawiera material i thickness_cm.';

update public.ideatermo_preaudits
set wall_insulation_layers = jsonb_build_array(
  jsonb_build_object(
    'material', coalesce(nullif(wall_insulation_material, ''), 'unknown'),
    'thickness_cm', wall_insulation_cm
  )
)
where wall_insulation_layers = '[]'::jsonb
  and (wall_insulation_material is not null or wall_insulation_cm is not null);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ideatermo_preaudits_wall_insulation_layers_array_check'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_wall_insulation_layers_array_check
      check (jsonb_typeof(wall_insulation_layers) = 'array');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ideatermo_preaudits_wall_insulation_layers_max_four_check'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_wall_insulation_layers_max_four_check
      check (jsonb_array_length(wall_insulation_layers) <= 4);
  end if;
end $$;
