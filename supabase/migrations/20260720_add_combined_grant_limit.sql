alter table public.grant_settings
add column if not exists combined_grant_limit_gross numeric(12, 2) not null default 55000
check (combined_grant_limit_gross >= 0);
