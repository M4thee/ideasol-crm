create table if not exists public.meta_capi_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_name text not null check (event_name in ('Schedule', 'QualifiedLead', 'Purchase')),
  source_type text not null check (source_type in ('client_activity', 'calendar_event', 'sale')),
  source_id uuid not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 1,
  last_error text,
  meta_trace_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meta_capi_events_client_id_idx
  on public.meta_capi_events (client_id);

alter table public.meta_capi_events enable row level security;

comment on table public.meta_capi_events is
  'Techniczny rejestr idempotencji i diagnostyki zdarzeń CRM wysyłanych do Meta CAPI.';
