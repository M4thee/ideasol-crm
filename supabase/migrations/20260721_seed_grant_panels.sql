alter table public.grant_panels
add column if not exists price_net numeric(12, 2) not null default 0
check (price_net >= 0);

alter table public.grant_panels
add column if not exists installation_scope text not null default 'roof'
check (installation_scope in ('roof', 'ground', 'both'));

with panel_data(manufacturer, model, power_wp, price_net, installation_scope) as (
  values
    ('JA Solar', 'JAM54D41-455/LB', 455, 281.36, 'ground'),
    ('AIKO', 'AIKO-A470-MAH54Dw', 470, 286.30, 'roof'),
    ('Gokin Solar', 'GK-4-54HTBD-500M', 500, 302.72, 'ground'),
    ('JA Solar', 'JAM72D42-650/LB', 650, 354.14, 'ground')
)
update public.grant_panels as target
set
  power_wp = source.power_wp,
  price_net = source.price_net,
  installation_scope = source.installation_scope,
  active = true,
  updated_at = now()
from panel_data as source
where target.manufacturer = source.manufacturer
  and target.model = source.model;

with panel_data(manufacturer, model, power_wp, price_net, installation_scope) as (
  values
    ('JA Solar', 'JAM54D41-455/LB', 455, 281.36, 'ground'),
    ('AIKO', 'AIKO-A470-MAH54Dw', 470, 286.30, 'roof'),
    ('Gokin Solar', 'GK-4-54HTBD-500M', 500, 302.72, 'ground'),
    ('JA Solar', 'JAM72D42-650/LB', 650, 354.14, 'ground')
)
insert into public.grant_panels (
  manufacturer,
  model,
  power_wp,
  price_net,
  installation_scope,
  active
)
select
  source.manufacturer,
  source.model,
  source.power_wp,
  source.price_net,
  source.installation_scope,
  true
from panel_data as source
where not exists (
  select 1
  from public.grant_panels as target
  where target.manufacturer = source.manufacturer
    and target.model = source.model
);
