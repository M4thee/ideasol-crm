alter table public.profiles
  add column if not exists sticky_note_color text not null default 'yellow'
  check (
    sticky_note_color in (
      'yellow', 'mint', 'blue', 'pink', 'lavender', 'peach',
      'coral', 'aqua', 'sage', 'lilac', 'apricot', 'stone'
    )
  );

create table if not exists public.sticky_notes (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(btrim(content)) between 1 and 320),
  author_id uuid not null references public.profiles(id) on delete restrict,
  author_name text not null,
  color text not null check (
    color in (
      'yellow', 'mint', 'blue', 'pink', 'lavender', 'peach',
      'coral', 'aqua', 'sage', 'lilac', 'apricot', 'stone'
    )
  ),
  visibility text not null check (visibility in ('private', 'management', 'public', 'shared', 'user')),
  recipient_ids uuid[] not null default '{}',
  expires_at timestamptz,
  reminder_enabled boolean not null default false,
  reminder_mode text check (reminder_mode in ('relative', 'scheduled', 'recurring')),
  reminder_amount integer check (reminder_amount is null or reminder_amount > 0),
  reminder_unit text check (reminder_unit in ('minutes', 'hours', 'days', 'weeks')),
  reminder_at timestamptz,
  completed_at timestamptz,
  completed_by_id uuid references public.profiles(id) on delete set null,
  completed_by_name text,
  sort_order double precision not null default extract(epoch from clock_timestamp()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (visibility in ('shared', 'user') and cardinality(recipient_ids) > 0)
    or (visibility not in ('shared', 'user') and cardinality(recipient_ids) = 0)
  )
);

create table if not exists public.sticky_note_comments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.sticky_notes(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  author_name text not null,
  content text not null check (char_length(btrim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.sticky_note_mentions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.sticky_notes(id) on delete cascade,
  comment_id uuid references public.sticky_note_comments(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  mentioned_by_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique nulls not distinct (note_id, comment_id, mentioned_user_id)
);

alter table public.notifications
  add column if not exists link_url text,
  add column if not exists sticky_note_id uuid references public.sticky_notes(id) on delete set null;

create index if not exists sticky_notes_created_at_idx
  on public.sticky_notes (created_at desc);

create index if not exists sticky_notes_recipient_ids_idx
  on public.sticky_notes using gin (recipient_ids);

create index if not exists sticky_note_comments_note_id_created_at_idx
  on public.sticky_note_comments (note_id, created_at);

create index if not exists sticky_note_mentions_mentioned_user_idx
  on public.sticky_note_mentions (mentioned_user_id, created_at desc);

create index if not exists notifications_sticky_note_id_idx
  on public.notifications (sticky_note_id);

alter table public.sticky_notes enable row level security;
alter table public.sticky_note_comments enable row level security;
alter table public.sticky_note_mentions enable row level security;

drop policy if exists "sticky_notes_select_visible" on public.sticky_notes;
create policy "sticky_notes_select_visible"
  on public.sticky_notes
  for select
  to authenticated
  using (
    author_id = (select auth.uid())
    or visibility = 'public'
    or (select auth.uid()) = any(recipient_ids)
    or (
      visibility in ('management', 'shared')
      and exists (
        select 1
        from public.profiles viewer
        where viewer.id = (select auth.uid())
          and viewer.role = 'owner'
          and viewer.is_active is not false
      )
    )
  );

drop policy if exists "sticky_note_comments_select_visible" on public.sticky_note_comments;
create policy "sticky_note_comments_select_visible"
  on public.sticky_note_comments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sticky_notes visible_note
      where visible_note.id = sticky_note_comments.note_id
    )
  );

drop policy if exists "sticky_note_mentions_select_involved" on public.sticky_note_mentions;
create policy "sticky_note_mentions_select_involved"
  on public.sticky_note_mentions
  for select
  to authenticated
  using (
    mentioned_user_id = (select auth.uid())
    or mentioned_by_user_id = (select auth.uid())
    or exists (
      select 1
      from public.sticky_notes visible_note
      where visible_note.id = sticky_note_mentions.note_id
    )
  );

grant select on public.sticky_notes to authenticated;
grant select on public.sticky_note_comments to authenticated;
grant select on public.sticky_note_mentions to authenticated;

comment on table public.sticky_notes is
  'Wieloużytkownikowa tablica zadań CRM z prywatnością, terminami i przypomnieniami.';

comment on table public.sticky_note_comments is
  'Komentarze widoczne wyłącznie dla użytkowników mających dostęp do notatki.';

comment on table public.sticky_note_mentions is
  'Jawny rejestr @wzmianek używany do deduplikacji powiadomień CRM i Teams.';
