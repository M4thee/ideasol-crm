alter table public.sticky_notes
  add column if not exists next_reminder_at timestamptz,
  add column if not exists reminder_last_sent_at timestamptz,
  add column if not exists reminder_claimed_at timestamptz,
  add column if not exists reminder_error text,
  add column if not exists reminder_occurrence_count integer not null default 0;

update public.sticky_notes
set next_reminder_at = reminder_at
where reminder_enabled = true
  and completed_at is null
  and reminder_at is not null
  and next_reminder_at is null;

create index if not exists sticky_notes_due_reminders_idx
  on public.sticky_notes (next_reminder_at)
  where reminder_enabled = true and completed_at is null and next_reminder_at is not null;

create table if not exists public.sticky_note_positions (
  note_id uuid not null references public.sticky_notes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sort_order integer not null,
  updated_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

create index if not exists sticky_note_positions_user_order_idx
  on public.sticky_note_positions (user_id, sort_order);

alter table public.sticky_note_positions enable row level security;

drop policy if exists "sticky_note_positions_own" on public.sticky_note_positions;
create policy "sticky_note_positions_own"
  on public.sticky_note_positions
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.sticky_note_positions to authenticated;
grant all on public.sticky_notes to service_role;
grant all on public.sticky_note_comments to service_role;
grant all on public.sticky_note_mentions to service_role;
grant all on public.sticky_note_positions to service_role;

comment on table public.sticky_note_positions is
  'Indywidualna kolejność karteczek na tablicy dla każdego użytkownika CRM.';
