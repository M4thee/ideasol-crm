alter table public.pricing_settings
  add column if not exists arimr_cost_pv_installation_net_per_kwp numeric not null default 500 check (arimr_cost_pv_installation_net_per_kwp >= 0),
  add column if not exists arimr_cost_storage_installation_net numeric not null default 1500 check (arimr_cost_storage_installation_net >= 0),
  add column if not exists arimr_cost_flat_roof_net numeric not null default 2200 check (arimr_cost_flat_roof_net >= 0),
  add column if not exists arimr_cost_pitched_sheet_net numeric not null default 330 check (arimr_cost_pitched_sheet_net >= 0),
  add column if not exists arimr_cost_pitched_tile_net numeric not null default 2000 check (arimr_cost_pitched_tile_net >= 0),
  add column if not exists arimr_cost_ground_net numeric not null default 4500 check (arimr_cost_ground_net >= 0),
  add column if not exists arimr_cost_protections_net numeric not null default 1500 check (arimr_cost_protections_net >= 0),
  add column if not exists arimr_cost_wiring_net numeric not null default 800 check (arimr_cost_wiring_net >= 0),
  add column if not exists arimr_cost_transport_electronics_net numeric not null default 250 check (arimr_cost_transport_electronics_net >= 0),
  add column if not exists arimr_cost_transport_panels_net numeric not null default 350 check (arimr_cost_transport_panels_net >= 0),
  add column if not exists arimr_cost_documentation_net numeric not null default 700 check (arimr_cost_documentation_net >= 0),
  add column if not exists arimr_cost_marketing_net numeric not null default 500 check (arimr_cost_marketing_net >= 0),
  add column if not exists arimr_cost_warranty_fund_percent numeric not null default 15 check (arimr_cost_warranty_fund_percent between 0 and 100);
