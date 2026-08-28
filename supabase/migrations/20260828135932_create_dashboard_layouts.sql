create table if not exists public.dashboard_layouts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  layout jsonb not null default '[]'::jsonb,
  layout_version integer not null default 1,
  tour_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_layouts_layout_is_array check (jsonb_typeof(layout) = 'array')
);

alter table public.dashboard_layouts
  add column if not exists tour_completed_at timestamptz;

alter table public.dashboard_layouts enable row level security;

revoke all on table public.dashboard_layouts from anon, authenticated;
grant select, insert, update, delete on table public.dashboard_layouts to authenticated;
grant select, insert, update, delete on table public.dashboard_layouts to service_role;

drop policy if exists "Users can read their dashboard layout" on public.dashboard_layouts;
create policy "Users can read their dashboard layout"
on public.dashboard_layouts
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their dashboard layout" on public.dashboard_layouts;
create policy "Users can create their dashboard layout"
on public.dashboard_layouts
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their dashboard layout" on public.dashboard_layouts;
create policy "Users can update their dashboard layout"
on public.dashboard_layouts
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their dashboard layout" on public.dashboard_layouts;
create policy "Users can delete their dashboard layout"
on public.dashboard_layouts
for delete
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.dashboard_layouts is
  'Indywidualny układ widgetów pulpitu CRM dla zalogowanego użytkownika.';
