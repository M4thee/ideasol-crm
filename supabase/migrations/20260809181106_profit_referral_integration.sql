create table if not exists public.profit_referral_links (
  id uuid primary key default gen_random_uuid(),
  profit_referral_id uuid not null unique,
  profit_referrer_idea_id text not null,
  profit_referrer_name text,
  source_seller_id uuid references public.profiles(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  current_owner_id uuid references public.profiles(id) on delete set null,
  qualification_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profit_referral_links
  add column if not exists status text not null default 'processing'
    check (status in ('processing', 'created', 'duplicate', 'failed')),
  add column if not exists is_duplicate boolean not null default false,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists last_error text;

comment on table public.profit_referral_links is
  'Idempotentny, serwerowy rejestr poleceń przekazanych z IdeaSol Profit do CRM.';

create index if not exists profit_referral_links_status_idx
  on public.profit_referral_links (status, updated_at desc);

create index if not exists profit_referral_links_source_seller_id_idx
  on public.profit_referral_links (source_seller_id);

create index if not exists profit_referral_links_client_id_idx
  on public.profit_referral_links (client_id);

create index if not exists profit_referral_links_sale_id_idx
  on public.profit_referral_links (sale_id);

create index if not exists profit_referral_links_current_owner_id_idx
  on public.profit_referral_links (current_owner_id);

alter table public.profit_referral_links enable row level security;
revoke all on table public.profit_referral_links from anon, authenticated;
