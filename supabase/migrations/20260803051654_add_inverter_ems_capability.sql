alter table public.inverters
  add column if not exists has_ems boolean not null default false;

comment on column public.inverters.has_ems is
  'Czy falownik udostępnia funkcjonalność EMS zaznaczaną w umowie.';
