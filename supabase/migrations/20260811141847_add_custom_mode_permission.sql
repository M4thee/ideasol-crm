alter table public.user_permissions
  add column if not exists custom_mode boolean not null default false;

comment on column public.user_permissions.custom_mode is
  'Allows the user to create calculator offers with one-off custom equipment.';

create policy "client_offers_custom_mode_insert_restricted"
on public.client_offers
as restrictive
for insert
to authenticated
with check (
  coalesce(lower(offer_data ->> 'customMode') = 'true', false) = false
  or exists (
    select 1
    from public.user_permissions permissions
    where permissions.user_id = auth.uid()
      and permissions.custom_mode = true
  )
);

create policy "client_offers_custom_mode_update_restricted"
on public.client_offers
as restrictive
for update
to authenticated
using (true)
with check (
  coalesce(lower(offer_data ->> 'customMode') = 'true', false) = false
  or exists (
    select 1
    from public.user_permissions permissions
    where permissions.user_id = auth.uid()
      and permissions.custom_mode = true
  )
);
