create table if not exists public.sms_automations (
  id uuid primary key default gen_random_uuid(),
  automation_key text not null unique,
  message_type text not null unique,
  title text not null check (char_length(title) between 1 and 120),
  trigger_type text not null check (
    trigger_type in ('meeting_created', 'before_meeting', 'before_installation')
  ),
  message_template text not null check (char_length(message_template) between 1 and 1200),
  offset_minutes integer not null default 0 check (offset_minutes between 0 and 43200),
  is_active boolean not null default true,
  is_system boolean not null default false,
  sort_order integer not null default 100 check (sort_order between 0 and 10000),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sms_automations_trigger_offset_check check (
    trigger_type <> 'meeting_created' or offset_minutes = 0
  )
);

create index if not exists sms_automations_active_trigger_idx
  on public.sms_automations (trigger_type, offset_minutes, sort_order)
  where is_active = true;

alter table public.sms_automations enable row level security;

revoke all on table public.sms_automations from anon, authenticated;
grant select, insert, update, delete on table public.sms_automations to service_role;

comment on table public.sms_automations is
  'Globalne automatyczne wiadomości SMS konfigurowane przez administratora.';

comment on column public.sms_automations.offset_minutes is
  'Liczba minut przed terminem spotkania lub montażu; dla utworzenia spotkania zawsze 0.';

insert into public.sms_automations (
  automation_key,
  message_type,
  title,
  trigger_type,
  message_template,
  offset_minutes,
  is_active,
  is_system,
  sort_order
)
values
  (
    'meeting_created_confirmation',
    'meeting_created',
    'Potwierdzenie utworzenia spotkania',
    'meeting_created',
    'Dzień dobry. Potwierdzamy datę spotkania z naszym doradcą w dniu {{event_date}} o godzinie {{event_time}}. W przypadku zmiany planów prosimy o kontakt bezpośrednio z doradcą. Kontakt do doradcy: {{advisor_name}} tel. {{advisor_phone}}. Pozdrawiamy, Zespół IdeaSol.',
    0,
    true,
    true,
    10
  ),
  (
    'meeting_reminder',
    'meeting_reminder_24h',
    'Przypomnienie przed spotkaniem',
    'before_meeting',
    'Przypominamy o spotkaniu w dniu {{event_date}} o godzinie {{event_time}}. W przypadku zmiany planów prosimy o bezpośredni kontakt z doradcą: {{advisor_name}}, tel. {{advisor_phone}}. Pozdrawiamy, Zespół IdeaSol.',
    1440,
    true,
    true,
    20
  ),
  (
    'installation_reminder',
    'installation_reminder_24h',
    'Przypomnienie przed montażem',
    'before_installation',
    'Dzień dobry. Przypominamy, że {{installation_date}} o godzinie {{installation_time}} odbędzie się montaż do umowy nr {{contract_number}}. Montaż realizuje firma {{installer_company_name}}. W razie nagłej zmiany planów prosimy o kontakt pod nr infolinii {{hotline}} lub bezpośrednio z instalatorem: {{installer_contact_name}}, tel. {{installer_phone}}. Pozdrawiamy, Zespół IdeaSol.',
    1440,
    true,
    true,
    30
  )
on conflict (automation_key) do nothing;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'meeting-sms-reminders'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end
$$;

select cron.schedule(
  'meeting-sms-reminders',
  '*/15 * * * *',
  $cron$
    select net.http_get(
      url := 'https://crm.ideasol.pl/api/cron/meeting-sms-reminders',
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
