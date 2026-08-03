alter table public.installation_orders
  add column if not exists supply_sources jsonb not null default '{
    "panels": "ideasol",
    "inverter": "ideasol",
    "energy_storage": "ideasol",
    "construction": "ideasol",
    "materials": "ideasol"
  }'::jsonb;

alter table public.installation_orders
  drop constraint if exists installation_orders_supply_sources_check,
  add constraint installation_orders_supply_sources_check
    check (
      jsonb_typeof(supply_sources) = 'object'
      and supply_sources ?& array[
        'panels',
        'inverter',
        'energy_storage',
        'construction',
        'materials'
      ]
      and supply_sources ->> 'panels' in ('ideasol', 'installer')
      and supply_sources ->> 'inverter' in ('ideasol', 'installer')
      and supply_sources ->> 'energy_storage' in ('ideasol', 'installer')
      and supply_sources ->> 'construction' in ('ideasol', 'installer')
      and supply_sources ->> 'materials' in ('ideasol', 'installer')
    );

comment on column public.installation_orders.supply_sources is
  'Źródło dostawy paneli, falownika, magazynu, konstrukcji i materiałów: IdeaSol albo instalator.';

drop policy if exists "installation_orders_select_realization"
  on public.installation_orders;
create policy "installation_orders_select_realization"
on public.installation_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
  or exists (
    select 1
    from public.user_permissions
    where user_permissions.user_id = (select auth.uid())
      and user_permissions.realization = true
  )
);

drop policy if exists "installation_orders_insert_realization"
  on public.installation_orders;
create policy "installation_orders_insert_realization"
on public.installation_orders
for insert
to authenticated
with check (
  generated_by = (select auth.uid())
  and (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
    or exists (
      select 1
      from public.user_permissions
      where user_permissions.user_id = (select auth.uid())
        and user_permissions.realization = true
    )
  )
);

drop policy if exists "installation_orders_update_realization"
  on public.installation_orders;
create policy "installation_orders_update_realization"
on public.installation_orders
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
  or exists (
    select 1
    from public.user_permissions
    where user_permissions.user_id = (select auth.uid())
      and user_permissions.realization = true
  )
)
with check (
  generated_by = (select auth.uid())
  and (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
    or exists (
      select 1
      from public.user_permissions
      where user_permissions.user_id = (select auth.uid())
        and user_permissions.realization = true
    )
  )
);
