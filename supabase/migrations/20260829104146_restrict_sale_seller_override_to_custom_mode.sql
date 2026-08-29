drop policy if exists "sales_seller_override_requires_custom_mode"
on public.sales;

create policy "sales_seller_override_requires_custom_mode"
on public.sales
as restrictive
for insert
to authenticated
with check (
  (
    sales.seller_id is not null
    and sales.seller_id = coalesce(
      (
        select source_offer.created_by
        from public.client_offers source_offer
        where source_offer.id = sales.source_offer_id
      ),
      (select auth.uid())
    )
  )
  or exists (
    select 1
    from public.user_permissions permissions
    where permissions.user_id = (select auth.uid())
      and permissions.custom_mode = true
  )
);

comment on policy "sales_seller_override_requires_custom_mode" on public.sales is
  'Only users with Custom Mode may assign a sale to a seller other than the source offer owner.';
