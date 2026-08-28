create table if not exists public.sticky_call_task_states (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  completed_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

comment on table public.sticky_call_task_states is
  'Prywatny stan wykonanych i usuniętych pozycji na stałej karcie Telefony do wykonania.';

create index if not exists sticky_call_task_states_user_visible_idx
  on public.sticky_call_task_states (user_id, dismissed_at, completed_at desc);

alter table public.sticky_call_task_states enable row level security;

revoke all on table public.sticky_call_task_states from anon;
grant select, insert, update, delete on table public.sticky_call_task_states to authenticated;
grant select, insert, update, delete on table public.sticky_call_task_states to service_role;

create policy "Users can read their own sticky call task state"
  on public.sticky_call_task_states
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own sticky call task state"
  on public.sticky_call_task_states
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own sticky call task state"
  on public.sticky_call_task_states
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own sticky call task state"
  on public.sticky_call_task_states
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
