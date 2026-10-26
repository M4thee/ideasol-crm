-- Sprzedaż incognito is opt-in. Existing users and sales remain standard.
alter table public.user_permissions
  add column if not exists incognito_sales boolean not null default false;

alter table public.sales
  add column if not exists is_incognito boolean not null default false;

comment on column public.user_permissions.incognito_sales is
  'Indywidualne uprawnienie do tworzenia i odczytu sprzedaży incognito. Administrator ma dostęp niezależnie od flagi.';

comment on column public.sales.is_incognito is
  'Sprzedaż poufna: dostępna tylko administratorowi i użytkownikom z uprawnieniem incognito_sales.';

create index if not exists sales_incognito_created_at_idx
  on public.sales (created_at desc)
  where is_incognito = true;

drop function if exists public.has_incognito_sales_access(uuid);

create or replace function public.has_incognito_sales_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  ) or exists (
    select 1
    from public.user_permissions permission
    where permission.user_id = auth.uid()
      and permission.incognito_sales = true
  );
$$;

revoke all on function public.has_incognito_sales_access() from public, anon;
grant execute on function public.has_incognito_sales_access() to authenticated, service_role;

create or replace function public.can_access_incognito_sale(p_sale_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select not sale.is_incognito or public.has_incognito_sales_access()
    from public.sales sale
    where sale.id = p_sale_id
  ), false);
$$;

revoke all on function public.can_access_incognito_sale(uuid) from public, anon;
grant execute on function public.can_access_incognito_sale(uuid) to authenticated, service_role;

drop policy if exists sales_incognito_gate on public.sales;
create policy sales_incognito_gate
  on public.sales
  as restrictive
  for all
  to authenticated
  using (not is_incognito or public.has_incognito_sales_access())
  with check (not is_incognito or public.has_incognito_sales_access());

-- Incognito prices are calculated by the authenticated server endpoint. This
-- blocks a browser from bypassing that calculation with a direct table insert.
drop policy if exists sales_incognito_server_insert_only on public.sales;
create policy sales_incognito_server_insert_only
  on public.sales
  as restrictive
  for insert
  to authenticated
  with check (not is_incognito);

-- A restrictive policy composes with every existing role/seller policy and
-- prevents related records from disclosing that an incognito sale exists.
do $$
declare
  related_table text;
begin
  foreach related_table in array array[
    'contract_signature_sessions',
    'customer_payments',
    'installation_order_generation_jobs',
    'installation_orders',
    'profit_integration_outbox',
    'profit_referral_links',
    'sale_document_containers',
    'sale_documents',
    'sale_invoices',
    'sale_notes',
    'sms_messages'
  ]
  loop
    if to_regclass(format('public.%I', related_table)) is not null then
      execute format('drop policy if exists incognito_sale_gate on public.%I', related_table);
      execute format(
        'create policy incognito_sale_gate on public.%I as restrictive for all to authenticated using (public.can_access_incognito_sale(sale_id)) with check (public.can_access_incognito_sale(sale_id))',
        related_table
      );
    end if;
  end loop;
end;
$$;

create or replace function public.can_access_sale_storage_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  object_sale_id uuid;
begin
  if split_part(p_name, '/', 1) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  object_sale_id := split_part(p_name, '/', 1)::uuid;
  return public.can_access_incognito_sale(object_sale_id);
end;
$$;

create or replace function public.can_access_ideasign_storage_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  signature_session_id uuid;
  related_sale_id uuid;
begin
  if split_part(p_name, '/', 1) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  signature_session_id := split_part(p_name, '/', 1)::uuid;
  select session.sale_id
    into related_sale_id
  from public.contract_signature_sessions session
  where session.id = signature_session_id;

  return related_sale_id is not null
    and public.can_access_incognito_sale(related_sale_id);
end;
$$;

revoke all on function public.can_access_sale_storage_object(text) from public, anon;
revoke all on function public.can_access_ideasign_storage_object(text) from public, anon;
grant execute on function public.can_access_sale_storage_object(text) to authenticated, service_role;
grant execute on function public.can_access_ideasign_storage_object(text) to authenticated, service_role;

drop policy if exists incognito_sale_storage_gate on storage.objects;
create policy incognito_sale_storage_gate
  on storage.objects
  as restrictive
  for all
  to authenticated
  using (
    bucket_id not in ('sale-documents', 'ideasign-documents')
    or (bucket_id = 'sale-documents' and public.can_access_sale_storage_object(name))
    or (bucket_id = 'ideasign-documents' and public.can_access_ideasign_storage_object(name))
  )
  with check (
    bucket_id not in ('sale-documents', 'ideasign-documents')
    or (bucket_id = 'sale-documents' and public.can_access_sale_storage_object(name))
    or (bucket_id = 'ideasign-documents' and public.can_access_ideasign_storage_object(name))
  );

-- Only the administrator may view or change the independent incognito price
-- configuration. LIKE keeps the complete calculator schema in sync at the
-- point this migration is applied; the seed is a safe copy of standard prices.
create table if not exists public.incognito_pricing_settings
  (like public.pricing_settings including all);

insert into public.incognito_pricing_settings overriding system value
select * from public.pricing_settings
on conflict do nothing;

-- Potwierdzona reguła biznesowa: ten sam algorytm co standardowy, ale jedna
-- marża ownera mniej (przed funduszem gwarancyjnym i VAT).
update public.incognito_pricing_settings incognito
set owners_count = greatest(0, standard.owners_count - 1)
from public.pricing_settings standard
where incognito.id = standard.id;

alter table public.incognito_pricing_settings enable row level security;

drop policy if exists incognito_pricing_settings_admin_select on public.incognito_pricing_settings;
create policy incognito_pricing_settings_admin_select
  on public.incognito_pricing_settings
  for select
  to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists incognito_pricing_settings_admin_update on public.incognito_pricing_settings;
create policy incognito_pricing_settings_admin_update
  on public.incognito_pricing_settings
  for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

revoke all on table public.incognito_pricing_settings from anon;
grant select, update on table public.incognito_pricing_settings to authenticated;
grant all on table public.incognito_pricing_settings to service_role;

drop trigger if exists crm_audit_row_change on public.incognito_pricing_settings;
create trigger crm_audit_row_change
after insert or update or delete on public.incognito_pricing_settings
for each row execute function private.capture_crm_audit_change();

-- Owners must not be able to enumerate other users' incognito permission.
drop policy if exists user_permissions_select_own_or_admin on public.user_permissions;
create policy user_permissions_select_own_or_admin
  on public.user_permissions
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

create or replace function public.update_sale_status(p_sale_id uuid, p_status text)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_role text;
  v_sale public.sales%rowtype;
begin
  select role into v_user_role from public.profiles where id = v_user_id;

  if v_user_role not in ('admin', 'owner') then
    raise exception 'Tylko owner albo admin może zmieniać status sprzedaży.';
  end if;

  if not public.can_access_incognito_sale(p_sale_id) then
    raise exception 'Nie znaleziono sprzedaży albo brak dostępu.' using errcode = '42501';
  end if;

  if p_status not in (
    'Oczekuje na sprawdzenie dokumentów', 'Oczekiwanie na zaliczkę',
    'Oczekuje na umówienie montażu', 'Montaż umówiony', 'W trakcie montażu',
    'Montaż zakończony - oczekiwanie na pełną wpłatę', 'Zakończony - procesowanie ZM',
    'Zakończony - ZM wysłane', 'Zakończony - procesowanie dotacji', 'Zakończony',
    'Anulowana', 'Odstępienie - utrzymanie', 'Utrzymanie - nieuratowana',
    'Utrzymanie - uratowana'
  ) then
    raise exception 'Nieprawidłowy status sprzedaży: %', p_status;
  end if;

  update public.sales set status = p_status where id = p_sale_id returning * into v_sale;
  if not found then raise exception 'Nie znaleziono sprzedaży albo status nie został zmieniony.'; end if;
  return v_sale;
end;
$$;

create or replace function public.submit_sale_document_containers(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_role text;
  v_seller_id uuid;
begin
  select role into v_user_role from public.profiles where id = v_user_id;
  select seller_id into v_seller_id from public.sales where id = p_sale_id;

  if not public.can_access_incognito_sale(p_sale_id) then
    raise exception 'Nie znaleziono sprzedaży albo brak dostępu.' using errcode = '42501';
  end if;
  if v_user_role is null then raise exception 'Brak profilu użytkownika.'; end if;
  if v_user_role <> 'admin' and v_seller_id is distinct from v_user_id then
    raise exception 'Tylko sprzedawca przypisany do sprzedaży albo admin może wysłać dokumenty do sprawdzenia.';
  end if;

  insert into public.sale_document_containers (sale_id, container_key)
  select p_sale_id, container.key
  from (values ('contracts'), ('technical_audit'), ('photos'), ('osd_invoice'),
    ('zm_power_of_attorney'), ('ppoz'), ('pme_grant'), ('other')) as container(key)
  on conflict (sale_id, container_key) do nothing;

  update public.sale_document_containers
  set status = 'submitted', submitted_by = v_user_id, submitted_at = now(),
      reviewed_by = null, reviewed_at = null, review_note = null, updated_at = now()
  where sale_id = p_sale_id and status in ('draft', 'rejected');
end;
$$;

create or replace function public.review_sale_document_container(
  p_sale_id uuid,
  p_container_key text,
  p_status text,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_role text;
  v_seller_id uuid;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'Status review może być tylko approved albo rejected.';
  end if;
  select role into v_user_role from public.profiles where id = v_user_id;
  select seller_id into v_seller_id from public.sales where id = p_sale_id;

  if not public.can_access_incognito_sale(p_sale_id) then
    raise exception 'Nie znaleziono sprzedaży albo brak dostępu.' using errcode = '42501';
  end if;
  if v_user_role not in ('admin', 'owner') then
    raise exception 'Tylko owner albo admin może zatwierdzać dokumenty.';
  end if;
  if v_user_role = 'owner' and v_seller_id = v_user_id then
    raise exception 'Owner nie może zatwierdzić własnych dokumentów.';
  end if;

  insert into public.sale_document_containers (sale_id, container_key)
  values (p_sale_id, p_container_key)
  on conflict (sale_id, container_key) do nothing;

  update public.sale_document_containers
  set status = p_status, reviewed_by = v_user_id, reviewed_at = now(),
      review_note = p_review_note, updated_at = now()
  where sale_id = p_sale_id and container_key = p_container_key;
end;
$$;
