alter table public.pricing_settings
  add column if not exists arimr_sale_pv_flat_roof_net_per_kwp numeric not null default 2500 check (arimr_sale_pv_flat_roof_net_per_kwp >= 0),
  add column if not exists arimr_sale_pv_pitched_sheet_net_per_kwp numeric not null default 2500 check (arimr_sale_pv_pitched_sheet_net_per_kwp >= 0),
  add column if not exists arimr_sale_pv_pitched_tile_net_per_kwp numeric not null default 2500 check (arimr_sale_pv_pitched_tile_net_per_kwp >= 0),
  add column if not exists arimr_sale_pv_ground_net_per_kwp numeric not null default 2500 check (arimr_sale_pv_ground_net_per_kwp >= 0),
  add column if not exists arimr_seller_monthly_plan_kw numeric not null default 40 check (arimr_seller_monthly_plan_kw > 0),
  add column if not exists arimr_seller_pv_plan_kw_per_kwp numeric not null default 1 check (arimr_seller_pv_plan_kw_per_kwp >= 0),
  add column if not exists arimr_seller_storage_plan_kw_per_unit numeric not null default 5 check (arimr_seller_storage_plan_kw_per_unit >= 0),
  add column if not exists arimr_seller_pv_compensation_net_per_kwp numeric not null default 200 check (arimr_seller_pv_compensation_net_per_kwp >= 0),
  add column if not exists arimr_seller_storage_compensation_net_per_kwh numeric not null default 150 check (arimr_seller_storage_compensation_net_per_kwh >= 0),
  add column if not exists arimr_seller_max_multiplier_percent numeric not null default 150 check (arimr_seller_max_multiplier_percent >= 0);
