alter table public.pricing_settings
  add column if not exists arimr_pv_reference_rate_net_per_kwp numeric not null default 3940 check (arimr_pv_reference_rate_net_per_kwp >= 0),
  add column if not exists arimr_storage_reference_rate_net_per_kwh numeric not null default 2250 check (arimr_storage_reference_rate_net_per_kwh >= 0),
  add column if not exists arimr_support_percent numeric not null default 65 check (arimr_support_percent between 0 and 100),
  add column if not exists arimr_area_b_grant_limit numeric not null default 200000 check (arimr_area_b_grant_limit >= 0),
  add column if not exists arimr_min_storage_kwh_per_pv_kwp numeric not null default 0.5 check (arimr_min_storage_kwh_per_pv_kwp >= 0),
  add column if not exists arimr_default_vat_rate numeric not null default 23 check (arimr_default_vat_rate between 0 and 100),
  add column if not exists arimr_default_pv_sale_rate_net_per_kwp numeric not null default 2500 check (arimr_default_pv_sale_rate_net_per_kwp >= 0),
  add column if not exists arimr_default_storage_sale_rate_net_per_kwh numeric not null default 2250 check (arimr_default_storage_sale_rate_net_per_kwh >= 0);
