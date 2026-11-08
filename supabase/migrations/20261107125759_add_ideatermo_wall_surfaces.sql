-- Store the dimensions and calculated area of every wall selected for
-- insulation. Door rows now carry their own type; the legacy type column is
-- retained so older drafts and API consumers continue to load correctly.

alter table public.ideatermo_preaudits
  add column if not exists wall_insulation_surfaces jsonb not null default '[]'::jsonb;

alter table public.ideatermo_preaudits
  drop constraint if exists ideatermo_preaudits_wall_insulation_surfaces_array_check,
  add constraint ideatermo_preaudits_wall_insulation_surfaces_array_check
    check (jsonb_typeof(wall_insulation_surfaces) = 'array'),
  drop constraint if exists ideatermo_preaudits_external_doors_max_three_check,
  add constraint ideatermo_preaudits_external_doors_max_three_check
    check (jsonb_array_length(external_doors) <= 3);

comment on column public.ideatermo_preaudits.wall_insulation_surfaces is
  'Walls selected for insulation, including dimensions or manually entered area and the calculated area in square metres.';
comment on column public.ideatermo_preaudits.external_doors is
  'Up to three external doors, each with its own type, width and height.';
comment on column public.ideatermo_preaudits.external_door_type is
  'Legacy compatibility value; the current questionnaire stores the type on each external_doors JSON item.';
