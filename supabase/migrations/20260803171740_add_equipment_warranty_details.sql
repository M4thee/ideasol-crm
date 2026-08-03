alter table public.panels
  add column if not exists warranty_guarantor text,
  add column if not exists warranty_period text;

alter table public.inverters
  add column if not exists warranty_guarantor text,
  add column if not exists warranty_period text;

alter table public.storages
  add column if not exists warranty_guarantor text,
  add column if not exists warranty_period text;

comment on column public.panels.warranty_guarantor is
  'Podmiot udzielający gwarancji, drukowany w tabeli gwarancji umowy.';
comment on column public.panels.warranty_period is
  'Okres gwarancji w brzmieniu drukowanym w umowie.';
comment on column public.inverters.warranty_guarantor is
  'Podmiot udzielający gwarancji, drukowany w tabeli gwarancji umowy.';
comment on column public.inverters.warranty_period is
  'Okres gwarancji w brzmieniu drukowanym w umowie.';
comment on column public.storages.warranty_guarantor is
  'Podmiot udzielający gwarancji, drukowany w tabeli gwarancji umowy.';
comment on column public.storages.warranty_period is
  'Okres gwarancji w brzmieniu drukowanym w umowie.';
