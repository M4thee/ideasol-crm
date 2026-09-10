create index if not exists clients_created_at_id_idx
  on public.clients (created_at, id);

create index if not exists client_activities_created_at_id_idx
  on public.client_activities (created_at, id);

create index if not exists calendar_events_event_at_id_idx
  on public.calendar_events (event_at, id);

create index if not exists client_offers_created_at_id_idx
  on public.client_offers (created_at, id);

create index if not exists sales_sale_date_id_idx
  on public.sales (sale_date, id);

comment on index public.clients_created_at_id_idx is
  'Supports bounded Command Center lead aggregation without changing CRM write logic.';
comment on index public.client_activities_created_at_id_idx is
  'Supports bounded Command Center activity aggregation.';
comment on index public.calendar_events_event_at_id_idx is
  'Supports bounded Command Center meeting aggregation.';
comment on index public.client_offers_created_at_id_idx is
  'Supports bounded Command Center funnel aggregation.';
comment on index public.sales_sale_date_id_idx is
  'Supports bounded Command Center sales aggregation.';
