create index if not exists contract_signature_acceptances_document_idx
  on public.contract_signature_acceptances (document_id);
create index if not exists contract_signature_acceptances_signer_idx
  on public.contract_signature_acceptances (signer_id);

create index if not exists contract_signature_access_sessions_session_idx
  on public.contract_signature_access_sessions (signature_session_id);
create index if not exists contract_signature_access_sessions_signer_idx
  on public.contract_signature_access_sessions (signer_id);

create index if not exists contract_signature_audit_events_signer_idx
  on public.contract_signature_audit_events (signer_id)
  where signer_id is not null;

create index if not exists contract_signature_delivery_jobs_signer_idx
  on public.contract_signature_delivery_jobs (signer_id)
  where signer_id is not null;

create index if not exists contract_signature_document_views_document_idx
  on public.contract_signature_document_views (document_id);

create index if not exists contract_signature_otp_challenges_access_session_idx
  on public.contract_signature_otp_challenges (access_session_id);
create index if not exists contract_signature_otp_challenges_signer_idx
  on public.contract_signature_otp_challenges (signer_id);

create index if not exists contract_signature_sessions_cancelled_by_idx
  on public.contract_signature_sessions (cancelled_by)
  where cancelled_by is not null;
create index if not exists contract_signature_sessions_client_idx
  on public.contract_signature_sessions (client_id)
  where client_id is not null;
create index if not exists contract_signature_sessions_created_by_idx
  on public.contract_signature_sessions (created_by);
create index if not exists contract_signature_sessions_finalizing_signer_idx
  on public.contract_signature_sessions (finalizing_signer_id)
  where finalizing_signer_id is not null;
