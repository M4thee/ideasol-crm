drop policy if exists "client_offers_custom_mode_insert_restricted"
on public.client_offers;

drop policy if exists "client_offers_custom_mode_update_restricted"
on public.client_offers;

create policy "client_offers_custom_mode_insert_restricted"
on public.client_offers
as restrictive
for insert
to authenticated
with check (
  (
    coalesce(lower(offer_data ->> 'customMode') = 'true', false) = false
    and coalesce(
      lower(offer_data #>> '{customPaymentSchedule,enabled}') = 'true',
      false
    ) = false
    and coalesce(
      lower(offer_data #>> '{form,customPaymentSchedule,enabled}') = 'true',
      false
    ) = false
  )
  or exists (
    select 1
    from public.user_permissions permissions
    where permissions.user_id = (select auth.uid())
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
  (
    coalesce(lower(offer_data ->> 'customMode') = 'true', false) = false
    and coalesce(
      lower(offer_data #>> '{customPaymentSchedule,enabled}') = 'true',
      false
    ) = false
    and coalesce(
      lower(offer_data #>> '{form,customPaymentSchedule,enabled}') = 'true',
      false
    ) = false
  )
  or exists (
    select 1
    from public.user_permissions permissions
    where permissions.user_id = (select auth.uid())
      and permissions.custom_mode = true
  )
);

comment on column public.user_permissions.custom_mode is
  'Allows the user to create calculator offers with one-off custom equipment or a custom payment schedule.';
