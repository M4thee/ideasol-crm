alter table public.user_permissions
  add column if not exists sms boolean not null default false;

comment on column public.user_permissions.sms is
  'Dostęp do ręcznego modułu SMS oraz historii wpłat klientów.';

alter table public.installation_orders
  add column if not exists installation_time time,
  add column if not exists installation_at timestamptz;

alter table public.sales
  add column if not exists installation_date date,
  add column if not exists installation_time time,
  add column if not exists installation_at timestamptz,
  add column if not exists installation_installer_id uuid references public.installers(id) on delete set null,
  add column if not exists installation_sms_reminder_attempted_at timestamptz,
  add column if not exists installation_sms_reminder_sent_at timestamptz,
  add column if not exists installation_sms_reminder_error text;

update public.sales as sales
set
  installation_date = coalesce(sales.installation_date, orders.installation_date),
  installation_time = coalesce(sales.installation_time, orders.installation_time),
  installation_at = coalesce(sales.installation_at, orders.installation_at),
  installation_installer_id = coalesce(sales.installation_installer_id, orders.installer_id)
from public.installation_orders as orders
where orders.sale_id = sales.id;

create index if not exists sales_installation_reminder_due_idx
  on public.sales (installation_at)
  where installation_at is not null
    and installation_sms_reminder_sent_at is null;

create index if not exists sales_installation_installer_id_idx
  on public.sales (installation_installer_id);

create table if not exists public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  paid_at date not null default current_date,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists customer_payments_sale_paid_at_idx
  on public.customer_payments (sale_id, paid_at desc, created_at desc);

create index if not exists customer_payments_created_by_idx
  on public.customer_payments (created_by);

alter table public.customer_payments enable row level security;

revoke all on table public.customer_payments from anon, authenticated;
grant select, insert, update, delete on table public.customer_payments to service_role;

comment on table public.customer_payments is
  'Wpłaty klientów rejestrowane w module SMS przez zabezpieczone endpointy serwerowe.';

create index if not exists sms_messages_sale_type_created_idx
  on public.sms_messages (sale_id, message_type, created_at desc);

alter table public.sms_messages
  add column if not exists deduplication_key text;

create unique index if not exists sms_messages_active_deduplication_key_idx
  on public.sms_messages (deduplication_key)
  where deduplication_key is not null
    and status in ('pending', 'sent');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'installation-sms-reminders'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end
$$;

select cron.schedule(
  'installation-sms-reminders',
  '*/15 * * * *',
  $cron$
    select net.http_get(
      url := 'https://crm.ideasol.pl/api/cron/installation-sms-reminders',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'meeting_confirmation_cron_secret'
          limit 1
        )
      ),
      timeout_milliseconds := 60000
    );
  $cron$
);
