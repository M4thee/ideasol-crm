alter table public.user_permissions
  add column if not exists arimr_calculator boolean not null default false;

comment on column public.user_permissions.arimr_calculator is
  'Allows the user to enter the ARiMR calculator and view the separate ARiMR program report.';

insert into public.user_permissions (user_id, arimr_calculator)
select profiles.id, true
from public.profiles
where profiles.role in ('admin', 'owner')
on conflict (user_id) do update
set arimr_calculator = excluded.arimr_calculator,
    updated_at = now();

create policy "client_offers_arimr_calculator_insert_restricted"
on public.client_offers
as restrictive
for insert
to authenticated
with check (
  lower(coalesce(
    offer_data ->> 'calculatorProgram',
    offer_data #>> '{form,calculatorProgram}',
    offer_data #>> '{result,calculatorProgram}',
    ''
  )) <> 'arimr2026'
  or exists (
    select 1
    from public.user_permissions permissions
    where permissions.user_id = (select auth.uid())
      and permissions.arimr_calculator = true
  )
);

create policy "client_offers_arimr_calculator_update_restricted"
on public.client_offers
as restrictive
for update
to authenticated
using (true)
with check (
  lower(coalesce(
    offer_data ->> 'calculatorProgram',
    offer_data #>> '{form,calculatorProgram}',
    offer_data #>> '{result,calculatorProgram}',
    ''
  )) <> 'arimr2026'
  or exists (
    select 1
    from public.user_permissions permissions
    where permissions.user_id = (select auth.uid())
      and permissions.arimr_calculator = true
  )
);
