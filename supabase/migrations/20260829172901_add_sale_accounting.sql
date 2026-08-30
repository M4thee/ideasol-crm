create table if not exists public.sale_invoices (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  invoice_type text not null check (invoice_type in ('advance', 'final', 'correction')),
  invoice_number text not null,
  gross_amount numeric(12, 2) not null check (gross_amount <> 0),
  issued_at date not null default current_date,
  status text not null default 'issued_local' check (status in ('issued_local')),
  ksef_status text not null default 'not_integrated' check (ksef_status in ('not_integrated')),
  correction_of_invoice_id uuid references public.sale_invoices(id) on delete set null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sale_invoices_number_unique unique (invoice_number),
  constraint sale_invoices_correction_reference_check check (
    (invoice_type = 'correction' and correction_of_invoice_id is not null)
    or (invoice_type <> 'correction' and correction_of_invoice_id is null)
  )
);

create index if not exists sale_invoices_sale_issued_idx
  on public.sale_invoices (sale_id, issued_at desc, created_at desc);

create index if not exists sale_invoices_created_by_idx
  on public.sale_invoices (created_by);

alter table public.sale_invoices enable row level security;

revoke all on table public.sale_invoices from anon, authenticated;
grant select, insert, update, delete on table public.sale_invoices to service_role;

comment on table public.sale_invoices is
  'Lokalna ewidencja faktur sprzedażowych CRM. Integracja i wysyłka do KSeF nie są jeszcze aktywne.';

comment on column public.sale_invoices.status is
  'Stan lokalnej ewidencji faktury; nie oznacza wysyłki do KSeF.';

comment on column public.sale_invoices.ksef_status is
  'Status przyszłej integracji KSeF. Obecnie wyłącznie not_integrated.';

comment on table public.customer_payments is
  'Wspólne źródło zaksięgowanych wpłat klientów dla modułu Księgowość i automatyzacji SMS.';
