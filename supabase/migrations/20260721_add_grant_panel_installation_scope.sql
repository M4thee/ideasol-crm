alter table public.grant_panels
add column if not exists installation_scope text not null default 'roof'
check (installation_scope in ('roof', 'ground', 'both'));
