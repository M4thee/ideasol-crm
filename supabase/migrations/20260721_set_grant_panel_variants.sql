update public.grant_panels
set installation_scope = 'ground', updated_at = now()
where (manufacturer = 'JA Solar' and model = 'JAM54D41-455/LB')
   or (manufacturer = 'Gokin Solar' and model = 'GK-4-54HTBD-500M')
   or (manufacturer = 'JA Solar' and model = 'JAM72D42-650/LB');

update public.grant_panels
set installation_scope = 'roof', updated_at = now()
where (manufacturer = 'AIKO' and model = 'AIKO-A470-MAH54Dw')
   or (manufacturer = 'Trina Solar' and model = 'TSM-465NEG9R.28');

insert into public.grant_panels (
  manufacturer,
  model,
  power_wp,
  price_net,
  installation_scope,
  catalog_card_url,
  active
)
select
  'Trina Solar',
  'TSM-455NEG9R.28',
  455,
  0,
  'roof',
  null,
  false
where not exists (
  select 1
  from public.grant_panels
  where manufacturer = 'Trina Solar'
    and model = 'TSM-455NEG9R.28'
);
