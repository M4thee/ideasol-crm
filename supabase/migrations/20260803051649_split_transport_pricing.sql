alter table public.pricing_settings
  add column if not exists transport_electronics_net numeric(12, 2) not null default 250
    check (transport_electronics_net >= 0),
  add column if not exists transport_panels_net numeric(12, 2) not null default 350
    check (transport_panels_net >= 0);

comment on column public.pricing_settings.transport_electronics_net is
  'Koszt netto jednej dostawy falownika i/lub magazynu energii.';

comment on column public.pricing_settings.transport_panels_net is
  'Koszt netto dostawy paneli fotowoltaicznych.';
