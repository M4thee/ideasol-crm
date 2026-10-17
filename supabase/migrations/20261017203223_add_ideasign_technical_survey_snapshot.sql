alter table public.contract_signature_sessions
  add column if not exists technical_survey_snapshot jsonb,
  add column if not exists technical_survey_snapshot_sha256 text,
  add column if not exists technical_survey_photo_versions jsonb not null default '[]'::jsonb,
  add column if not exists technical_survey_declaration_accepted_at timestamptz;

alter table public.contract_signature_sessions
  drop constraint if exists contract_signature_sessions_technical_survey_snapshot_check,
  add constraint contract_signature_sessions_technical_survey_snapshot_check
  check (
    technical_survey_snapshot is null
    or (
      jsonb_typeof(technical_survey_snapshot) = 'object'
      and technical_survey_snapshot_sha256 ~ '^[0-9a-f]{64}$'
      and technical_survey_declaration_accepted_at is not null
    )
  ),
  drop constraint if exists contract_signature_sessions_technical_survey_photo_versions_check,
  add constraint contract_signature_sessions_technical_survey_photo_versions_check
  check (jsonb_typeof(technical_survey_photo_versions) = 'array');

with numbered as (
  select
    id,
    row_number() over (
      partition by sale_id
      order by created_at, id
    ) as package_version
  from public.contract_signature_sessions
)
update public.contract_signature_sessions as session
set version = numbered.package_version
from numbered
where session.id = numbered.id
  and session.version is distinct from numbered.package_version;

create unique index if not exists contract_signature_sessions_sale_version_uidx
  on public.contract_signature_sessions (sale_id, version);

create or replace function public.ideasign_prevent_frozen_package_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.version is distinct from old.version
    or new.manifest_sha256 is distinct from old.manifest_sha256
    or new.technical_survey_snapshot is distinct from old.technical_survey_snapshot
    or new.technical_survey_snapshot_sha256 is distinct from old.technical_survey_snapshot_sha256
    or new.technical_survey_photo_versions is distinct from old.technical_survey_photo_versions
    or new.technical_survey_declaration_accepted_at is distinct from old.technical_survey_declaration_accepted_at
  then
    raise exception 'Frozen IdeaSign package data is immutable; create a new transaction version instead.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.ideasign_prevent_frozen_package_mutation() from public, anon, authenticated, service_role;

drop trigger if exists contract_signature_sessions_frozen_package_immutable
  on public.contract_signature_sessions;
create trigger contract_signature_sessions_frozen_package_immutable
before update on public.contract_signature_sessions
for each row
execute function public.ideasign_prevent_frozen_package_mutation();

comment on column public.contract_signature_sessions.technical_survey_snapshot is
  'Niezmienny snapshot JSON ankiety technicznej zamrożony przed OTP handlowca.';
comment on column public.contract_signature_sessions.technical_survey_snapshot_sha256 is
  'SHA-256 kanonicznego snapshotu ankiety technicznej wraz z wersjami mediów.';
comment on column public.contract_signature_sessions.technical_survey_photo_versions is
  'Identyfikatory, wersje, kategorie i hashe szkicu oraz zdjęć użytych do wygenerowania Załącznika nr 4.';
comment on column public.contract_signature_sessions.technical_survey_declaration_accepted_at is
  'Serwerowy czas przyjęcia wymaganego oświadczenia ankiety technicznej.';
comment on column public.contract_signature_sessions.version is
  'Rosnący numer wersji całego zamrożonego pakietu IdeaSign w ramach sprzedaży.';
