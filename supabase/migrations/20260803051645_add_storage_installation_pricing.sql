alter table public.pricing_settings
  add column if not exists storage_installation_with_pv_net numeric(12, 2) not null default 1500
    check (storage_installation_with_pv_net >= 0),
  add column if not exists storage_installation_without_pv_net numeric(12, 2) not null default 2500
    check (storage_installation_without_pv_net >= 0);

comment on column public.pricing_settings.storage_installation_with_pv_net is
  'Koszt netto montażu magazynu energii w zestawie z instalacją PV.';

comment on column public.pricing_settings.storage_installation_without_pv_net is
  'Koszt netto montażu magazynu energii bez instalacji PV.';
