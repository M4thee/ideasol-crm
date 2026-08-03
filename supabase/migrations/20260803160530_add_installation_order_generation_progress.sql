create table if not exists public.installation_order_generation_jobs (
  id uuid primary key,
  sale_id uuid not null references public.sales(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  progress smallint not null default 0 check (progress between 0 and 100),
  stage text not null default 'Uruchamianie generatora',
  error text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists installation_order_generation_jobs_user_id_idx
  on public.installation_order_generation_jobs(user_id, updated_at desc);

create index if not exists installation_order_generation_jobs_sale_id_idx
  on public.installation_order_generation_jobs(sale_id, updated_at desc);

alter table public.installation_order_generation_jobs enable row level security;

revoke all on public.installation_order_generation_jobs from anon, authenticated;
grant all on public.installation_order_generation_jobs to service_role;

comment on table public.installation_order_generation_jobs is
  'Stan rzeczywistego postępu generowania kompletnego zlecenia montażu wraz z załącznikami.';
