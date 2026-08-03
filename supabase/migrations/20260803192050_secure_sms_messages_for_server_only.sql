alter table public.sms_messages enable row level security;

drop policy if exists "authenticated can create sms messages" on public.sms_messages;
drop policy if exists "authenticated can read sms messages" on public.sms_messages;

revoke all on table public.sms_messages from anon, authenticated;
grant select, insert, update, delete on table public.sms_messages to service_role;

create index if not exists sms_messages_meeting_type_status_idx
  on public.sms_messages (meeting_id, message_type, status);

comment on table public.sms_messages is
  'Historia wysyłek SMS dostępna wyłącznie przez zabezpieczone endpointy serwerowe.';
