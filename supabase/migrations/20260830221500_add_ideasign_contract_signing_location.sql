alter table public.contract_signature_sessions
  add column if not exists contract_signing_location text not null default 'distance';

alter table public.contract_signature_sessions
  drop constraint if exists contract_signature_sessions_signing_location_check;

alter table public.contract_signature_sessions
  add constraint contract_signature_sessions_signing_location_check
  check (contract_signing_location in (
    'business_premises',
    'scheduled_home_visit',
    'unscheduled_home_visit',
    'distance'
  ));

comment on column public.contract_signature_sessions.contract_signing_location is
  'Okoliczności zawarcia umowy zamrożone przy utworzeniu procesu IdeaSign.';
