alter table public.ideatermo_preaudits
  add column if not exists roof_insulation_layers jsonb not null default '[]'::jsonb;

comment on column public.ideatermo_preaudits.roof_insulation_layers is
  'Maksymalnie trzy obecne warstwy izolacji dachu lub stropu; każda zawiera material i thickness_cm.';

update public.ideatermo_preaudits
set roof_insulation_layers = jsonb_build_array(
  jsonb_build_object(
    'material', coalesce(nullif(roof_insulation_material, ''), 'unknown'),
    'thickness_cm', roof_insulation_cm
  )
)
where roof_insulation_layers = '[]'::jsonb
  and (roof_insulation_material is not null or roof_insulation_cm is not null);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ideatermo_preaudits_roof_insulation_layers_array_check'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_roof_insulation_layers_array_check
      check (jsonb_typeof(roof_insulation_layers) = 'array');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ideatermo_preaudits_roof_insulation_layers_max_three_check'
      and conrelid = 'public.ideatermo_preaudits'::regclass
  ) then
    alter table public.ideatermo_preaudits
      add constraint ideatermo_preaudits_roof_insulation_layers_max_three_check
      check (jsonb_array_length(roof_insulation_layers) <= 3);
  end if;
end $$;
