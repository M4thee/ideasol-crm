alter table public.meta_capi_events
  drop constraint if exists meta_capi_events_event_name_check;

alter table public.meta_capi_events
  add constraint meta_capi_events_event_name_check
  check (event_name in ('Lead', 'Schedule', 'QualifiedLead', 'Purchase'));

alter table public.meta_capi_events
  drop constraint if exists meta_capi_events_source_type_check;

alter table public.meta_capi_events
  add constraint meta_capi_events_source_type_check
  check (source_type in ('calculator_lead', 'client_activity', 'calendar_event', 'sale'));
