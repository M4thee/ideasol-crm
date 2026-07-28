alter table public.inverters
  add column if not exists is_eu boolean not null default false;

alter table public.storages
  add column if not exists is_eu boolean not null default false;

alter table public.pricing_settings
  add column if not exists pme_qualify_vat boolean not null default false;

alter table public.client_offers
  add column if not exists subsidy_eu_bonus numeric(12, 2);

comment on column public.inverters.is_eu is
  'Produkt wyprodukowany na terenie UE; kwalifikuje konfigurację do bonusu PME.';

comment on column public.storages.is_eu is
  'Produkt wyprodukowany na terenie UE; kwalifikuje konfigurację do bonusu PME.';

comment on column public.pricing_settings.pme_qualify_vat is
  'Czy VAT jest kosztem kwalifikowanym w programie PME. Domyślnie false.';
