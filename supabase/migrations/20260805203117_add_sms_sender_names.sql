create table if not exists public.sms_sender_names (
  sender_name text primary key,
  provider_status text not null default 'UNKNOWN',
  provider_checked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sms_sender_names_length_check
    check (char_length(sender_name) between 1 and 11),
  constraint sms_sender_names_provider_status_check
    check (provider_status in ('ACTIVE', 'INACTIVE', 'NOT_FOUND', 'UNKNOWN'))
);

create table if not exists public.sms_sender_settings (
  id smallint primary key default 1,
  sender_name text not null references public.sms_sender_names(sender_name),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint sms_sender_settings_singleton_check check (id = 1)
);

alter table public.sms_sender_names enable row level security;
alter table public.sms_sender_settings enable row level security;

revoke all on table public.sms_sender_names from anon, authenticated;
revoke all on table public.sms_sender_settings from anon, authenticated;
grant select, insert, update, delete on table public.sms_sender_names to service_role;
grant select, insert, update on table public.sms_sender_settings to service_role;

insert into public.sms_sender_names (
  sender_name,
  provider_status,
  provider_checked_at
)
values
  ('Test', 'ACTIVE', now()),
  ('2WAY', 'ACTIVE', now())
on conflict (sender_name) do update
set
  provider_status = excluded.provider_status,
  provider_checked_at = excluded.provider_checked_at,
  updated_at = now();

insert into public.sms_sender_settings (id, sender_name)
values (1, 'Test')
on conflict (id) do nothing;

comment on table public.sms_sender_names is
  'Pola nadawcy dostępne w IdeaSol CRM wraz z ostatnim statusem pobranym z SMSAPI.';

comment on table public.sms_sender_settings is
  'Pojedyncze globalne ustawienie pola nadawcy używanego przez wszystkie SMS-y.';
