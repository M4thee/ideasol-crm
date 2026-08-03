create index if not exists sms_messages_client_type_status_idx
  on public.sms_messages (client_id, message_type, status)
  where client_id is not null;
