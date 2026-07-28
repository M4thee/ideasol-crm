alter table public.calendar_events
  add column if not exists confirmation_required boolean not null default false,
  add column if not exists confirmation_reminder_at timestamptz,
  add column if not exists confirmation_reminder_attempted_at timestamptz,
  add column if not exists confirmation_reminder_sent_at timestamptz,
  add column if not exists confirmation_reminder_error text,
  add column if not exists client_confirmed_at timestamptz,
  add column if not exists client_confirmed_by uuid references public.profiles(id) on delete set null;

alter table public.calendar_events
  drop constraint if exists calendar_events_confirmation_reminder_required_check,
  add constraint calendar_events_confirmation_reminder_required_check
    check (not confirmation_required or confirmation_reminder_at is not null),
  drop constraint if exists calendar_events_confirmation_reminder_before_meeting_check,
  add constraint calendar_events_confirmation_reminder_before_meeting_check
    check (
      confirmation_reminder_at is null
      or event_at is null
      or confirmation_reminder_at < event_at
    );

create index if not exists calendar_events_pending_confirmation_reminders_idx
  on public.calendar_events (confirmation_reminder_at)
  where
    event_type = 'meeting'
    and confirmation_required = true
    and confirmation_reminder_sent_at is null
    and client_confirmed_at is null;

create index if not exists calendar_events_client_confirmed_by_idx
  on public.calendar_events (client_confirmed_by)
  where client_confirmed_by is not null;

comment on column public.calendar_events.confirmation_required is
  'Czy doradca ma potwierdzić termin spotkania z klientem.';
comment on column public.calendar_events.confirmation_reminder_at is
  'Termin wysłania doradcy przypomnienia Teams o konieczności potwierdzenia.';
comment on column public.calendar_events.confirmation_reminder_attempted_at is
  'Termin ostatniej próby wysłania przypomnienia Teams.';
comment on column public.calendar_events.confirmation_reminder_sent_at is
  'Termin skutecznego wysłania lub zarezerwowania przypomnienia Teams.';
comment on column public.calendar_events.confirmation_reminder_error is
  'Ostatni błąd wysyłki przypomnienia Teams.';
comment on column public.calendar_events.client_confirmed_at is
  'Termin oznaczenia przez doradcę, że klient potwierdził spotkanie.';
comment on column public.calendar_events.client_confirmed_by is
  'Użytkownik, który oznaczył potwierdzenie spotkania przez klienta.';
