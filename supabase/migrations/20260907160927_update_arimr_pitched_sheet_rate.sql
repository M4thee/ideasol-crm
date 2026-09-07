alter table public.pricing_settings
  alter column arimr_cost_pitched_sheet_net set default 330;

update public.pricing_settings
set arimr_cost_pitched_sheet_net = 330,
    updated_at = now()
where arimr_cost_pitched_sheet_net = 1500;
