alter table public.calendar_events
  drop constraint if exists calendar_events_confirmation_reminder_before_meeting_check,
  drop constraint if exists calendar_events_confirmation_reminder_not_after_event_check,
  add constraint calendar_events_confirmation_reminder_not_after_event_check
    check (
      confirmation_reminder_at is null
      or event_at is null
      or confirmation_reminder_at < event_at
      or (
        event_type in ('phone_call', 'reminder')
        and confirmation_reminder_at = event_at
      )
    );

comment on constraint calendar_events_confirmation_reminder_not_after_event_check
  on public.calendar_events is
  'Spotkanie wymaga wcześniejszego przypomnienia; kontakt telefoniczny dopuszcza przypomnienie dokładnie w terminie kontaktu.';
