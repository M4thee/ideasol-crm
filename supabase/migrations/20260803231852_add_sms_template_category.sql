alter table public.sms_templates
  add column if not exists category text not null default 'sale';

alter table public.sms_templates
  drop constraint if exists sms_templates_category_check;

alter table public.sms_templates
  add constraint sms_templates_category_check
  check (category in ('sale', 'marketing', 'relationship'));

update public.sms_templates
set category = 'relationship'
where is_system = false
  and category = 'sale';

comment on column public.sms_templates.category is
  'Kategoria szablonu: sale wymaga sprzedaży, marketing i relationship mogą być wysyłane bez sprzedaży.';
