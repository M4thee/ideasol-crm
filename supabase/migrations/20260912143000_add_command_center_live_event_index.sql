create index if not exists sales_created_at_id_idx
  on public.sales (created_at, id);

comment on index public.sales_created_at_id_idx is
  'Supports low-latency Command Center polling for newly created sales.';
