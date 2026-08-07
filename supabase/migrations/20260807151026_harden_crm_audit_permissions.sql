revoke all on table public.crm_audit_logs from anon, authenticated, service_role;
grant select, insert on table public.crm_audit_logs to service_role;
