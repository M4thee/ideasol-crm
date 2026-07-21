alter table public.grant_panels add column if not exists price_net numeric(12, 2) not null default 0 check (price_net >= 0);
alter table public.grant_inverters add column if not exists price_net numeric(12, 2) not null default 0 check (price_net >= 0);
alter table public.grant_heat_pumps add column if not exists price_net numeric(12, 2) not null default 0 check (price_net >= 0);

update public.grant_panels
set price_net = round(price_gross / 1.23, 2)
where price_net = 0 and price_gross > 0;

update public.grant_inverters
set price_net = round(price_gross / 1.23, 2)
where price_net = 0 and price_gross > 0;

update public.grant_heat_pumps
set price_net = round(price_gross / 1.23, 2)
where price_net = 0 and price_gross > 0;

alter table public.grant_settings alter column vat_rate set default 8;
update public.grant_settings set vat_rate = 8 where id = 1 and vat_rate = 23;
