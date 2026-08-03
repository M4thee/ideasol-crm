create extension if not exists pgcrypto;

create table if not exists public.sms_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique
    check (template_key ~ '^[a-z0-9_]{3,80}$'),
  title text not null
    check (char_length(btrim(title)) between 1 and 120),
  message_template text not null
    check (char_length(btrim(message_template)) between 1 and 1200),
  tone text not null default 'standard'
    check (tone in ('standard', 'warning', 'danger')),
  required_fields text[] not null default '{}'
    check (
      required_fields <@ array[
        'client_name',
        'contract_number',
        'contract_value',
        'deposit_amount',
        'outstanding_amount',
        'installation_date',
        'installation_time',
        'installer_company_name'
      ]::text[]
    ),
  is_active boolean not null default true,
  is_system boolean not null default false,
  sort_order integer not null default 100
    check (sort_order between 0 and 10000),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sms_templates_active_sort_idx
  on public.sms_templates (is_active, sort_order, created_at);

alter table public.sms_templates enable row level security;

revoke all on table public.sms_templates from anon, authenticated;
grant select, insert, update, delete on table public.sms_templates to service_role;

comment on table public.sms_templates is
  'Szablony ręcznych wiadomości dostępnych w Module SMS. Zarządzane wyłącznie przez zabezpieczone endpointy administratora.';

comment on column public.sms_templates.message_template is
  'Treść z bezpiecznymi znacznikami w formacie {{nazwa_pola}}, uzupełnianymi po stronie serwera.';

insert into public.sms_templates (
  template_key,
  title,
  message_template,
  tone,
  required_fields,
  is_active,
  is_system,
  sort_order
)
values
  (
    'deposit_reminder',
    'Przypomnienie o wpłacie zaliczki',
    'Dzień dobry. Przypominamy o konieczności wpłaty zaliczki w kwocie {{deposit_amount}} PLN, na rachunek bankowy numer {{bank_account}}. Tytułem: {{contract_number}}. Jeżeli dokonali Państwo wpłaty, prosimy o potraktowanie tej wiadomości jako nieaktualnej. Z pozdrowieniami, Zespół IdeaSol.',
    'standard',
    array['contract_number', 'deposit_amount'],
    true,
    true,
    10
  ),
  (
    'payment_reminder_1',
    'Przypomnienie o płatności – I',
    'Dzień dobry. Informujemy, że do tej pory nie zaksięgowaliśmy wpłaty do umowy numer {{contract_number}} w kwocie {{outstanding_amount}} PLN. Numer konta do wpłaty: {{bank_account}}. W tytule proszę podać numer umowy. Jeżeli dokonali Państwo wpłaty, prosimy o potraktowanie tej wiadomości jako nieaktualnej. Z pozdrowieniami, Zespół IdeaSol.',
    'warning',
    array['contract_number', 'outstanding_amount'],
    true,
    true,
    20
  ),
  (
    'payment_reminder_2',
    'Przypomnienie o płatności – II',
    'Szanowny Kliencie. Informujemy, że nadal nie otrzymaliśmy wpłaty do umowy {{contract_number}}. Kwota do zapłaty wynosi {{outstanding_amount}} PLN. Prosimy o pilne dokonanie wpłaty na rachunek {{bank_account}}. W tytule prosimy podać numer umowy. Z pozdrowieniami, Zespół IdeaSol.',
    'warning',
    array['contract_number', 'outstanding_amount'],
    true,
    true,
    30
  ),
  (
    'payment_demand',
    'Wezwanie do zapłaty',
    'Dzień dobry. Ponieważ wciąż nie otrzymaliśmy wpłaty za wykonane usługi, postanowiliśmy przekazać Państwa dane do zewnętrznej firmy windykacyjnej wraz z dokonaniem wpisu do Krajowego Rejestru Długów. Tylko wpłata w ciągu 48 h pozwoli nam uniknąć tego etapu. Wezwanie do zapłaty zostało przesłane na adres e-mail. Pozdrawiamy, Zespół IdeaSol.',
    'danger',
    array['outstanding_amount'],
    true,
    true,
    40
  ),
  (
    'installation_confirmation',
    'Potwierdzenie daty montażu',
    'Dzień dobry. Potwierdzamy montaż w dniu {{installation_date}} około godziny {{installation_time}}. Firma realizująca montaż na zlecenie IdeaSol Sp. z o.o.: {{installer_company_name}}. Infolinia IdeaSol: {{hotline}}.',
    'standard',
    array['installation_date', 'installation_time', 'installer_company_name'],
    true,
    true,
    50
  )
on conflict (template_key) do nothing;
