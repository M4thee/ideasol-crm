-- Run only after rolling the application back to a version that does not use
-- the external-lead RPCs or the standard PV rate columns.
-- The guard deliberately refuses to remove audit tables once they contain data.

do $$
begin
  if to_regclass('public.external_lead_dedup_events') is not null
     and exists (select 1 from public.external_lead_dedup_events) then
    raise exception 'Rollback blocked: external_lead_dedup_events contains audit data';
  end if;

  if to_regclass('public.client_merge_audit') is not null
     and exists (select 1 from public.client_merge_audit) then
    raise exception 'Rollback blocked: client_merge_audit contains audit data';
  end if;
end;
$$;

drop function if exists public.merge_duplicate_client(uuid, uuid, uuid, text);
drop function if exists public.ingest_external_lead(text, text, text, text, text, text, text, text, text, uuid, text);

drop table if exists public.client_merge_audit;
drop table if exists public.external_lead_dedup_events;

drop index if exists public.clients_business_activity_idx;
drop index if exists public.clients_business_email_dedup_idx;
drop index if exists public.clients_business_phone_dedup_idx;

alter table public.clients
  drop column if exists last_lead_activity_at,
  drop column if exists email_dedup_key,
  drop column if exists phone_dedup_key;

alter table public.pricing_settings
  drop column if exists pv_structure_ground_rate_per_kwp,
  drop column if exists pv_structure_felt_rate_per_kwp,
  drop column if exists pv_structure_tile_rate_per_kwp,
  drop column if exists pv_structure_sheet_rate_per_kwp,
  drop column if exists pv_installation_rate_above_100,
  drop column if exists pv_installation_rate_40_100,
  drop column if exists pv_installation_rate_20_40,
  drop column if exists pv_installation_rate_10_20,
  drop column if exists pv_installation_rate_1_10;
