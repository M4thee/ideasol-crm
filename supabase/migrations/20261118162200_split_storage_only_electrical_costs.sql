-- Preserve prices when splitting the two flat fees. Each pricing mode is
-- initialized from its own current values, never from the other mode.
alter table public.pricing_settings
  add column if not exists storage_only_protections_cost numeric(12, 2)
    check (storage_only_protections_cost >= 0 and storage_only_protections_cost <> 'NaN'::numeric),
  add column if not exists storage_only_wiring_cost numeric(12, 2)
    check (storage_only_wiring_cost >= 0 and storage_only_wiring_cost <> 'NaN'::numeric);

update public.pricing_settings
set storage_only_protections_cost = coalesce(storage_only_protections_cost, protections_cost, 1500),
    storage_only_wiring_cost = coalesce(storage_only_wiring_cost, wiring_cost, 800)
where storage_only_protections_cost is null or storage_only_wiring_cost is null;

alter table public.pricing_settings
  alter column storage_only_protections_cost set not null,
  alter column storage_only_wiring_cost set not null;

comment on column public.pricing_settings.storage_only_protections_cost is
  'Stały koszt zabezpieczeń netto dla oferty obejmującej sam magazyn energii, bez nowej instalacji PV.';
comment on column public.pricing_settings.storage_only_wiring_cost is
  'Stały koszt okablowania netto dla oferty obejmującej sam magazyn energii, bez nowej instalacji PV.';

alter table public.incognito_pricing_settings
  add column if not exists storage_only_protections_cost numeric(12, 2)
    check (storage_only_protections_cost >= 0 and storage_only_protections_cost <> 'NaN'::numeric),
  add column if not exists storage_only_wiring_cost numeric(12, 2)
    check (storage_only_wiring_cost >= 0 and storage_only_wiring_cost <> 'NaN'::numeric);

update public.incognito_pricing_settings
set storage_only_protections_cost = coalesce(storage_only_protections_cost, protections_cost, 1500),
    storage_only_wiring_cost = coalesce(storage_only_wiring_cost, wiring_cost, 800)
where storage_only_protections_cost is null or storage_only_wiring_cost is null;

alter table public.incognito_pricing_settings
  alter column storage_only_protections_cost set not null,
  alter column storage_only_wiring_cost set not null;

comment on column public.incognito_pricing_settings.storage_only_protections_cost is
  'Stały koszt zabezpieczeń netto dla oferty obejmującej sam magazyn energii, bez nowej instalacji PV.';
comment on column public.incognito_pricing_settings.storage_only_wiring_cost is
  'Stały koszt okablowania netto dla oferty obejmującej sam magazyn energii, bez nowej instalacji PV.';

notify pgrst, 'reload schema';
