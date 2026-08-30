alter table public.contract_signature_sessions
  add column if not exists offeror_phone text,
  add column if not exists offeror_authorized_at timestamptz,
  add column if not exists offeror_authorization_challenge_id uuid;

alter table public.contract_signature_sessions
  add constraint contract_signature_sessions_offeror_phone_check
  check (
    offeror_phone is null
    or char_length(btrim(offeror_phone)) between 9 and 32
  );

create table if not exists public.contract_signature_offeror_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  signature_session_id uuid not null
    references public.contract_signature_sessions(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  code_hash text not null check (char_length(code_hash) between 40 and 240),
  document_manifest_sha256 text not null
    check (document_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  sent_at timestamptz not null default now(),
  consumed_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  recipient_phone_suffix text not null
    check (recipient_phone_suffix ~ '^[0-9]{3,4}$'),
  created_at timestamptz not null default now()
);

alter table public.contract_signature_sessions
  add constraint contract_signature_sessions_offeror_challenge_fk
  foreign key (offeror_authorization_challenge_id)
  references public.contract_signature_offeror_otp_challenges(id)
  on delete set null;

create index if not exists contract_signature_offeror_otp_session_sent_idx
  on public.contract_signature_offeror_otp_challenges
  (signature_session_id, actor_id, sent_at desc);

alter table public.contract_signature_offeror_otp_challenges enable row level security;

revoke all on table public.contract_signature_offeror_otp_challenges
  from public, anon, authenticated, service_role;

grant select, insert, update
  on table public.contract_signature_offeror_otp_challenges
  to service_role;

comment on column public.contract_signature_sessions.offeror_phone is
  'Numer telefonu handlowca zapisany z profilu CRM w chwili zamrozenia oferty.';

comment on column public.contract_signature_sessions.offeror_authorized_at is
  'Czas poprawnej autoryzacji zamrozonego manifestu przez handlowca kodem SMS.';

comment on table public.contract_signature_offeror_otp_challenges is
  'Haszowane, jednorazowe kody SMS handlowcow zwiazane z konkretnym manifestem IdeaSign.';
