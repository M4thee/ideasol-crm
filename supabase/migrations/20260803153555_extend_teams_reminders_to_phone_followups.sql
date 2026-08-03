drop index if exists public.calendar_events_pending_confirmation_reminders_idx;

create index calendar_events_pending_confirmation_reminders_idx
  on public.calendar_events (confirmation_reminder_at)
  where
    event_type in ('meeting', 'reminder', 'phone_call')
    and confirmation_required = true
    and confirmation_reminder_sent_at is null
    and client_confirmed_at is null;

comment on column public.calendar_events.confirmation_required is
  'Czy wysłać doradcy przypomnienie Teams przed spotkaniem lub kontaktem telefonicznym.';
comment on column public.calendar_events.confirmation_reminder_at is
  'Termin wysłania doradcy przypomnienia Teams przed zdarzeniem.';
