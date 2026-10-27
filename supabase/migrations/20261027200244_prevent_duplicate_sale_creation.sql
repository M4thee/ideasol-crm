create unique index if not exists sales_creation_request_id_unique
  on public.sales ((customer_data ->> 'creation_request_id'))
  where nullif(customer_data ->> 'creation_request_id', '') is not null;
