create index if not exists user_permissions_updated_by_idx
on public.user_permissions(updated_by);

create index if not exists installers_created_by_idx
on public.installers(created_by);

create index if not exists installers_updated_by_idx
on public.installers(updated_by);

create index if not exists installation_orders_generated_by_idx
on public.installation_orders(generated_by);
