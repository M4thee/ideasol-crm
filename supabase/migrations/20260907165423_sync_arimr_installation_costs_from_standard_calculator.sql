update public.pricing_settings
set
  arimr_cost_pv_installation_net_per_kwp = installation_pv_per_kw,
  arimr_cost_storage_installation_net = storage_installation_with_pv_net,
  updated_at = now()
where id = 1;

comment on column public.pricing_settings.arimr_cost_pv_installation_net_per_kwp is
  'Koszt montażu PV w kalkulatorze ARiMR 2026, netto za kWp.';

comment on column public.pricing_settings.arimr_cost_storage_installation_net is
  'Stały koszt montażu magazynu energii z PV w kalkulatorze ARiMR 2026, netto.';
