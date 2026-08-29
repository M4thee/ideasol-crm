do $$
begin
  if to_regclass('public.profit_integration_outbox') is not null then
    alter table public.profit_integration_outbox enable row level security;

    revoke all privileges
    on table public.profit_integration_outbox
    from anon, authenticated;

    grant all privileges
    on table public.profit_integration_outbox
    to service_role;

    comment on table public.profit_integration_outbox is
      'Server-only outbox for IdeaSol Profit integration. Browser roles have no access.';
  end if;
end;
$$;
