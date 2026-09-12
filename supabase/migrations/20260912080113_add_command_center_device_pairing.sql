create table public.cc_device_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.cc_devices(id) on delete cascade,
  code_digest text not null unique
    check (code_digest ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint cc_device_pairing_codes_expiry_after_creation
    check (expires_at > created_at),
  constraint cc_device_pairing_codes_single_terminal_state
    check (used_at is null or revoked_at is null)
);

create index cc_device_pairing_codes_device_idx
  on public.cc_device_pairing_codes (device_id, created_at desc);

create unique index cc_device_pairing_codes_one_active_per_device_idx
  on public.cc_device_pairing_codes (device_id)
  where used_at is null and revoked_at is null;

create or replace function public.cc_issue_device_pairing_code(
  p_device_id uuid,
  p_code_digest text,
  p_created_by uuid
)
returns public.cc_device_pairing_codes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  issued_code public.cc_device_pairing_codes;
begin
  update public.cc_device_pairing_codes
  set revoked_at = now()
  where device_id = p_device_id
    and used_at is null
    and revoked_at is null;

  insert into public.cc_device_pairing_codes (
    device_id,
    code_digest,
    expires_at,
    created_by
  ) values (
    p_device_id,
    p_code_digest,
    now() + interval '3 minutes',
    p_created_by
  )
  returning * into issued_code;

  return issued_code;
end;
$$;

create or replace function public.cc_redeem_device_pairing_code(
  p_code_digest text,
  p_access_token_digest text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  paired_device_id uuid;
begin
  update public.cc_device_pairing_codes
  set used_at = now()
  where code_digest = p_code_digest
    and used_at is null
    and revoked_at is null
    and expires_at > now()
  returning device_id into paired_device_id;

  if paired_device_id is null then
    return null;
  end if;

  update public.cc_devices
  set access_token_digest = p_access_token_digest,
      last_seen_at = null
  where id = paired_device_id;

  return paired_device_id;
end;
$$;

alter table public.cc_device_pairing_codes enable row level security;

revoke all on table public.cc_device_pairing_codes from anon, authenticated;
grant select, insert, update, delete on table public.cc_device_pairing_codes to service_role;

revoke all on function public.cc_issue_device_pairing_code(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.cc_redeem_device_pairing_code(text, text) from public, anon, authenticated;
grant execute on function public.cc_issue_device_pairing_code(uuid, text, uuid) to service_role;
grant execute on function public.cc_redeem_device_pairing_code(text, text) to service_role;

comment on table public.cc_device_pairing_codes is
  'Single-use Command Center device pairing codes. Codes expire after three minutes and are stored only as SHA-256 digests.';
