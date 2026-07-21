alter table public.grant_panels
add column if not exists price_net numeric(12, 2) not null default 0
check (price_net >= 0);

alter table public.grant_panels
add column if not exists installation_scope text not null default 'roof'
check (installation_scope in ('roof', 'ground', 'both'));

update public.grant_panels
set
  power_wp = 465,
  installation_scope = 'roof',
  updated_at = now()
where manufacturer = 'Trina Solar'
  and model = 'TSM-465NEG9R.28';

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
  'TSM-465NEG9R.28',
  465,
  0,
  'roof',
  null,
  false
where not exists (
  select 1
  from public.grant_panels
  where manufacturer = 'Trina Solar'
    and model = 'TSM-465NEG9R.28'
);
