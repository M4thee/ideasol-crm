create extension if not exists pgcrypto;

alter table public.user_permissions
  add column if not exists ideasign_prepare boolean not null default false,
  add column if not exists ideasign_send boolean not null default false;

update public.user_permissions permissions
set
  ideasign_prepare = true,
  ideasign_send = true
from public.profiles profile
where profile.id = permissions.user_id
  and lower(coalesce(profile.role, '')) in ('admin', 'owner');

create table if not exists public.contract_signature_sessions (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null unique,
  sale_id uuid not null references public.sales(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  offeror_name text not null check (char_length(btrim(offeror_name)) between 2 and 160),
  offeror_capacity text not null check (char_length(btrim(offeror_capacity)) between 2 and 160),
  client_name text not null check (char_length(btrim(client_name)) between 2 and 200),
  client_email text not null check (char_length(btrim(client_email)) between 3 and 320),
  client_phone text not null check (char_length(btrim(client_phone)) between 9 and 32),
  status text not null default 'przygotowana'
    check (status in (
      'przygotowana', 'wysłana', 'otwarta', 'uwierzytelniona',
      'oczekuje_na_podpis_klienta', 'częściowo_podpisana', 'zawarta', 'wygasła', 'anulowana'
    )),
  version integer not null default 1 check (version > 0),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  link_token_hash text not null unique check (link_token_hash ~ '^[0-9a-f]{64}$'),
  link_expires_at timestamptz not null,
  link_consumed_at timestamptz,
  offered_at timestamptz not null default now(),
  sent_at timestamptz,
  opened_at timestamptz,
  authenticated_at timestamptz,
  signing_started_at timestamptz,
  concluded_at timestamptz,
  expires_at timestamptz not null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  final_pdf_storage_path text,
  final_pdf_sha256 text check (final_pdf_sha256 is null or final_pdf_sha256 ~ '^[0-9a-f]{64}$'),
  finalizing_signer_id uuid,
  finalizing_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at >= link_expires_at),
  check (status <> 'zawarta' or (concluded_at is not null and final_pdf_sha256 is not null))
);

create table if not exists public.contract_signature_signers (
  id uuid primary key default gen_random_uuid(),
  signature_session_id uuid not null references public.contract_signature_sessions(id) on delete cascade,
  signer_order integer not null check (signer_order between 1 and 2),
  name text not null check (char_length(btrim(name)) between 2 and 200),
  email text not null check (char_length(btrim(email)) between 3 and 320),
  phone text not null check (char_length(btrim(phone)) between 9 and 32),
  status text not null default 'oczekuje'
    check (status in ('oczekuje', 'otwarty', 'uwierzytelniony', 'podpisany')),
  link_token_hash text not null unique check (link_token_hash ~ '^[0-9a-f]{64}$'),
  link_expires_at timestamptz not null,
  link_consumed_at timestamptz,
  opened_at timestamptz,
  authenticated_at timestamptz,
  signed_at timestamptz,
  delivery_password_sha256 text check (delivery_password_sha256 is null or delivery_password_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (signature_session_id, signer_order)
);

create table if not exists public.contract_signature_documents (
  id uuid primary key default gen_random_uuid(),
  signature_session_id uuid not null references public.contract_signature_sessions(id) on delete cascade,
  kind text not null check (kind in ('agreement', 'attachment', 'consumer_information', 'withdrawal_form')),
  title text not null check (char_length(btrim(title)) between 1 and 240),
  file_name text not null check (char_length(btrim(file_name)) between 1 and 240),
  storage_path text not null unique,
  crm_container_key text not null default 'contracts'
    check (crm_container_key in (
      'contracts', 'technical_audit', 'photos', 'osd_invoice',
      'zm_power_of_attorney', 'ppoz', 'pme_grant', 'other'
    )),
  mime_type text not null default 'application/pdf',
  byte_size bigint not null check (byte_size > 0 and byte_size <= 50000000),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  sort_order integer not null default 0,
  acceptance_required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (signature_session_id, sort_order)
);

create table if not exists public.contract_signature_acceptances (
  id uuid primary key default gen_random_uuid(),
  signature_session_id uuid not null references public.contract_signature_sessions(id) on delete cascade,
  signer_id uuid not null references public.contract_signature_signers(id) on delete cascade,
  document_id uuid not null references public.contract_signature_documents(id) on delete restrict,
  document_sha256 text not null check (document_sha256 ~ '^[0-9a-f]{64}$'),
  accepted_at timestamptz not null default now(),
  unique (signature_session_id, signer_id, document_id)
);

create table if not exists public.contract_signature_document_views (
  id uuid primary key default gen_random_uuid(),
  signature_session_id uuid not null references public.contract_signature_sessions(id) on delete cascade,
  signer_id uuid not null references public.contract_signature_signers(id) on delete cascade,
  document_id uuid not null references public.contract_signature_documents(id) on delete restrict,
  first_opened_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  open_count integer not null default 1 check (open_count > 0),
  unique (signature_session_id, signer_id, document_id)
);

create table if not exists public.contract_signature_access_sessions (
  id uuid primary key default gen_random_uuid(),
  signature_session_id uuid not null references public.contract_signature_sessions(id) on delete cascade,
  signer_id uuid not null references public.contract_signature_signers(id) on delete cascade,
  access_token_hash text not null unique check (access_token_hash ~ '^[0-9a-f]{64}$'),
  csrf_token_hash text not null check (csrf_token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  entry_verified_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.contract_signature_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  signature_session_id uuid not null references public.contract_signature_sessions(id) on delete cascade,
  signer_id uuid not null references public.contract_signature_signers(id) on delete cascade,
  access_session_id uuid not null references public.contract_signature_access_sessions(id) on delete cascade,
  purpose text not null check (purpose in ('entry', 'signature')),
  code_hash text not null check (char_length(code_hash) between 40 and 240),
  document_manifest_sha256 text not null check (document_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  sent_at timestamptz not null default now(),
  consumed_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  resend_count integer not null default 0 check (resend_count between 0 and 10),
  recipient_phone_suffix text not null check (recipient_phone_suffix ~ '^[0-9]{3,4}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.contract_signature_audit_events (
  id uuid primary key default gen_random_uuid(),
  signature_session_id uuid not null references public.contract_signature_sessions(id) on delete restrict,
  signer_id uuid references public.contract_signature_signers(id) on delete restrict,
  event_type text not null check (char_length(btrim(event_type)) between 2 and 80),
  occurred_at timestamptz not null default now(),
  ip_address inet,
  user_agent text check (user_agent is null or char_length(user_agent) <= 1000),
  session_metadata jsonb not null default '{}'::jsonb,
  event_data jsonb not null default '{}'::jsonb,
  previous_event_hash text check (previous_event_hash is null or previous_event_hash ~ '^[0-9a-f]{64}$'),
  event_hash text not null unique check (event_hash ~ '^[0-9a-f]{64}$')
);

alter table public.contract_signature_sessions
  add constraint contract_signature_sessions_finalizing_signer_fk
  foreign key (finalizing_signer_id)
  references public.contract_signature_signers(id)
  on delete set null;

create table if not exists public.contract_signature_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  signature_session_id uuid not null references public.contract_signature_sessions(id) on delete cascade,
  signer_id uuid references public.contract_signature_signers(id) on delete cascade,
  job_key text not null check (char_length(btrim(job_key)) between 2 and 120),
  channel text not null check (channel in ('crm', 'sale_status', 'email', 'teams')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 20),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (signature_session_id, job_key),
  check ((channel = 'email' and signer_id is not null) or (channel <> 'email' and signer_id is null))
);

create index if not exists contract_signature_sessions_sale_created_idx
  on public.contract_signature_sessions (sale_id, created_at desc);
create index if not exists contract_signature_sessions_status_expires_idx
  on public.contract_signature_sessions (status, expires_at);
create index if not exists contract_signature_documents_session_order_idx
  on public.contract_signature_documents (signature_session_id, sort_order);
create index if not exists contract_signature_signers_session_order_idx
  on public.contract_signature_signers (signature_session_id, signer_order);
create index if not exists contract_signature_document_views_signer_idx
  on public.contract_signature_document_views (signer_id, document_id);
create index if not exists contract_signature_otp_rate_limit_idx
  on public.contract_signature_otp_challenges (signature_session_id, purpose, sent_at desc);
create index if not exists contract_signature_audit_session_time_idx
  on public.contract_signature_audit_events (signature_session_id, occurred_at, id);
create index if not exists contract_signature_delivery_jobs_pending_idx
  on public.contract_signature_delivery_jobs (status, next_attempt_at, created_at);

alter table public.contract_signature_sessions enable row level security;
alter table public.contract_signature_signers enable row level security;
alter table public.contract_signature_documents enable row level security;
alter table public.contract_signature_acceptances enable row level security;
alter table public.contract_signature_document_views enable row level security;
alter table public.contract_signature_access_sessions enable row level security;
alter table public.contract_signature_otp_challenges enable row level security;
alter table public.contract_signature_audit_events enable row level security;
alter table public.contract_signature_delivery_jobs enable row level security;

revoke all on table public.contract_signature_sessions from public, anon, authenticated, service_role;
revoke all on table public.contract_signature_signers from public, anon, authenticated, service_role;
revoke all on table public.contract_signature_documents from public, anon, authenticated, service_role;
revoke all on table public.contract_signature_acceptances from public, anon, authenticated, service_role;
revoke all on table public.contract_signature_document_views from public, anon, authenticated, service_role;
revoke all on table public.contract_signature_access_sessions from public, anon, authenticated, service_role;
revoke all on table public.contract_signature_otp_challenges from public, anon, authenticated, service_role;
revoke all on table public.contract_signature_audit_events from public, anon, authenticated, service_role;
revoke all on table public.contract_signature_delivery_jobs from public, anon, authenticated, service_role;

grant select, insert, update on table public.contract_signature_sessions to service_role;
grant select, insert, update on table public.contract_signature_signers to service_role;
grant select, insert on table public.contract_signature_documents to service_role;
grant select, insert on table public.contract_signature_acceptances to service_role;
grant select, insert, update on table public.contract_signature_document_views to service_role;
grant select, insert, update on table public.contract_signature_access_sessions to service_role;
grant select, insert, update on table public.contract_signature_otp_challenges to service_role;
grant select, insert on table public.contract_signature_audit_events to service_role;
grant select, insert, update on table public.contract_signature_delivery_jobs to service_role;

create or replace function public.ideasign_append_audit_event(
  p_signature_session_id uuid,
  p_signer_id uuid,
  p_event_type text,
  p_occurred_at timestamptz,
  p_ip_address inet,
  p_user_agent text,
  p_session_metadata jsonb,
  p_event_data jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_previous_event_hash text;
  v_event_hash text;
begin
  perform 1
  from public.contract_signature_sessions
  where id = p_signature_session_id
  for update;

  if not found then
    raise exception 'Nie znaleziono procesu IdeaSign.';
  end if;

  select event_hash
  into v_previous_event_hash
  from public.contract_signature_audit_events
  where signature_session_id = p_signature_session_id
  order by occurred_at desc, id desc
  limit 1;

  v_event_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'signatureSessionId', p_signature_session_id,
          'signerId', p_signer_id,
          'eventType', p_event_type,
          'occurredAt', p_occurred_at,
          'ipAddress', p_ip_address,
          'userAgent', p_user_agent,
          'sessionMetadata', coalesce(p_session_metadata, '{}'::jsonb),
          'eventData', coalesce(p_event_data, '{}'::jsonb),
          'previousEventHash', v_previous_event_hash
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.contract_signature_audit_events (
    signature_session_id,
    signer_id,
    event_type,
    occurred_at,
    ip_address,
    user_agent,
    session_metadata,
    event_data,
    previous_event_hash,
    event_hash
  ) values (
    p_signature_session_id,
    p_signer_id,
    p_event_type,
    p_occurred_at,
    p_ip_address,
    p_user_agent,
    coalesce(p_session_metadata, '{}'::jsonb),
    coalesce(p_event_data, '{}'::jsonb),
    v_previous_event_hash,
    v_event_hash
  );

  return v_event_hash;
end;
$$;

create or replace function public.claim_ideasign_signature(
  p_signature_session_id uuid,
  p_signer_id uuid,
  p_signed_at timestamptz,
  p_delivery_password_sha256 text,
  p_ip_address inet,
  p_user_agent text,
  p_session_metadata jsonb,
  p_event_data jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.contract_signature_sessions%rowtype;
  v_signer public.contract_signature_signers%rowtype;
  v_waiting integer;
  v_effective_signed_at timestamptz;
begin
  select * into v_session
  from public.contract_signature_sessions
  where id = p_signature_session_id
  for update;

  if not found then
    return jsonb_build_object('mode', 'not_found');
  end if;

  if v_session.status in ('zawarta', 'wygasła', 'anulowana') then
    return jsonb_build_object('mode', 'closed', 'status', v_session.status);
  end if;

  select * into v_signer
  from public.contract_signature_signers
  where id = p_signer_id
    and signature_session_id = p_signature_session_id
  for update;

  if not found then
    return jsonb_build_object('mode', 'not_found');
  end if;

  if v_signer.status = 'podpisany' then
    return jsonb_build_object('mode', 'already_signed', 'signedAt', v_signer.signed_at);
  end if;

  if p_delivery_password_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Nieprawidłowy hash hasła dokumentu.';
  end if;

  if v_session.finalizing_signer_id is not null
     and v_session.finalizing_signer_id <> p_signer_id
     and v_session.finalizing_at > now() - interval '15 minutes' then
    return jsonb_build_object('mode', 'busy');
  end if;

  select count(*)::integer
  into v_waiting
  from public.contract_signature_signers
  where signature_session_id = p_signature_session_id
    and id <> p_signer_id
    and status <> 'podpisany';

  if v_waiting > 0 then
    update public.contract_signature_signers
    set
      status = 'podpisany',
      signed_at = p_signed_at,
      delivery_password_sha256 = p_delivery_password_sha256,
      updated_at = p_signed_at
    where id = p_signer_id;

    update public.contract_signature_sessions
    set
      status = 'częściowo_podpisana',
      finalizing_signer_id = null,
      finalizing_at = null,
      updated_at = p_signed_at
    where id = p_signature_session_id;

    perform public.ideasign_append_audit_event(
      p_signature_session_id,
      p_signer_id,
      'signer_signed',
      p_signed_at,
      p_ip_address,
      p_user_agent,
      p_session_metadata,
      p_event_data
    );

    return jsonb_build_object('mode', 'partial', 'signedAt', p_signed_at, 'waitingForSigners', v_waiting);
  end if;

  v_effective_signed_at := case
    when v_session.finalizing_signer_id = p_signer_id and v_session.finalizing_at is not null
      then v_session.finalizing_at
    else p_signed_at
  end;

  update public.contract_signature_sessions
  set
    finalizing_signer_id = p_signer_id,
    finalizing_at = v_effective_signed_at,
    updated_at = p_signed_at
  where id = p_signature_session_id;

  return jsonb_build_object('mode', 'finalizing', 'signedAt', v_effective_signed_at);
end;
$$;

create or replace function public.complete_ideasign_conclusion(
  p_signature_session_id uuid,
  p_signer_id uuid,
  p_delivery_password_sha256 text,
  p_final_pdf_storage_path text,
  p_final_pdf_sha256 text,
  p_ip_address inet,
  p_user_agent text,
  p_session_metadata jsonb,
  p_signer_event_data jsonb,
  p_conclusion_event_data jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.contract_signature_sessions%rowtype;
  v_unsigned integer;
begin
  select * into v_session
  from public.contract_signature_sessions
  where id = p_signature_session_id
  for update;

  if not found then
    return jsonb_build_object('mode', 'not_found');
  end if;

  if v_session.status = 'zawarta' then
    return jsonb_build_object('mode', 'already_concluded', 'concludedAt', v_session.concluded_at);
  end if;

  if v_session.status in ('wygasła', 'anulowana') then
    return jsonb_build_object('mode', 'closed', 'status', v_session.status);
  end if;

  if v_session.finalizing_signer_id is distinct from p_signer_id or v_session.finalizing_at is null then
    return jsonb_build_object('mode', 'not_claimed');
  end if;

  if p_delivery_password_sha256 !~ '^[0-9a-f]{64}$'
     or p_final_pdf_sha256 !~ '^[0-9a-f]{64}$'
     or char_length(btrim(p_final_pdf_storage_path)) < 3 then
    raise exception 'Nieprawidłowe dane końcowego dokumentu.';
  end if;

  update public.contract_signature_signers
  set
    status = 'podpisany',
    signed_at = v_session.finalizing_at,
    delivery_password_sha256 = p_delivery_password_sha256,
    updated_at = v_session.finalizing_at
  where id = p_signer_id
    and signature_session_id = p_signature_session_id
    and status <> 'podpisany';

  if not found then
    return jsonb_build_object('mode', 'already_signed');
  end if;

  select count(*)::integer
  into v_unsigned
  from public.contract_signature_signers
  where signature_session_id = p_signature_session_id
    and status <> 'podpisany';

  if v_unsigned <> 0 then
    raise exception 'Nie wszyscy podpisujący złożyli podpis.';
  end if;

  update public.contract_signature_sessions
  set
    status = 'zawarta',
    concluded_at = v_session.finalizing_at,
    final_pdf_storage_path = p_final_pdf_storage_path,
    final_pdf_sha256 = p_final_pdf_sha256,
    finalizing_signer_id = null,
    finalizing_at = null,
    last_error = null,
    updated_at = v_session.finalizing_at
  where id = p_signature_session_id;

  insert into public.contract_signature_delivery_jobs (
    signature_session_id,
    signer_id,
    job_key,
    channel
  ) values
    (p_signature_session_id, null, 'crm', 'crm'),
    (p_signature_session_id, null, 'sale_status', 'sale_status'),
    (p_signature_session_id, null, 'teams', 'teams')
  on conflict (signature_session_id, job_key) do nothing;

  insert into public.contract_signature_delivery_jobs (
    signature_session_id,
    signer_id,
    job_key,
    channel
  )
  select
    p_signature_session_id,
    signer.id,
    'email:' || signer.id::text,
    'email'
  from public.contract_signature_signers signer
  where signer.signature_session_id = p_signature_session_id
  on conflict (signature_session_id, job_key) do nothing;

  perform public.ideasign_append_audit_event(
    p_signature_session_id,
    p_signer_id,
    'signer_signed',
    v_session.finalizing_at,
    p_ip_address,
    p_user_agent,
    p_session_metadata,
    p_signer_event_data
  );

  perform public.ideasign_append_audit_event(
    p_signature_session_id,
    p_signer_id,
    'contract_concluded',
    v_session.finalizing_at,
    p_ip_address,
    p_user_agent,
    p_session_metadata,
    p_conclusion_event_data
  );

  return jsonb_build_object('mode', 'concluded', 'concludedAt', v_session.finalizing_at);
end;
$$;

create or replace function public.claim_ideasign_delivery_jobs(
  p_signature_session_id uuid,
  p_limit integer
)
returns setof public.contract_signature_delivery_jobs
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  with selected as (
    select job.id
    from public.contract_signature_delivery_jobs job
    where (
        (job.status = 'pending' and job.next_attempt_at <= now())
        or (job.status = 'running' and job.locked_at < now() - interval '15 minutes')
      )
      and (p_signature_session_id is null or job.signature_session_id = p_signature_session_id)
    order by job.created_at, job.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 50))
  )
  update public.contract_signature_delivery_jobs job
  set
    status = 'running',
    attempts = job.attempts + 1,
    locked_at = now(),
    updated_at = now()
  from selected
  where job.id = selected.id
  returning job.*;
end;
$$;

revoke all on function public.ideasign_append_audit_event(uuid, uuid, text, timestamptz, inet, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.claim_ideasign_signature(uuid, uuid, timestamptz, text, inet, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.complete_ideasign_conclusion(uuid, uuid, text, text, text, inet, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.claim_ideasign_delivery_jobs(uuid, integer) from public, anon, authenticated;

grant execute on function public.ideasign_append_audit_event(uuid, uuid, text, timestamptz, inet, text, jsonb, jsonb) to service_role;
grant execute on function public.claim_ideasign_signature(uuid, uuid, timestamptz, text, inet, text, jsonb, jsonb) to service_role;
grant execute on function public.complete_ideasign_conclusion(uuid, uuid, text, text, text, inet, text, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.claim_ideasign_delivery_jobs(uuid, integer) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ideasign-documents',
  'ideasign-documents',
  false,
  50000000,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.contract_signature_sessions is
  'IdeaSign: zamrożone procesy zawarcia umów, dostępne wyłącznie przez zabezpieczoną warstwę serwerową.';
comment on table public.contract_signature_documents is
  'IdeaSign: niezmienne wersje dokumentów i załączników powiązane z manifestem SHA-256.';
comment on table public.contract_signature_otp_challenges is
  'IdeaSign: hashe krótkotrwałych kodów OTP; kody jawne nigdy nie trafiają do bazy.';
comment on table public.contract_signature_audit_events is
  'IdeaSign: append-only hash-chain pełnego śladu dowodowego zawarcia umowy.';
