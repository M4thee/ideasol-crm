begin;

do $$
declare
  owner_id uuid;
  admin_id uuid;
  standard_owners numeric;
  incognito_owners numeric;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales'
      and column_name = 'is_incognito' and column_default = 'false'
  ) then
    raise exception 'sales.is_incognito must exist and default to false';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_permissions'
      and column_name = 'incognito_sales' and column_default = 'false'
  ) then
    raise exception 'user_permissions.incognito_sales must default to false';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sales'
      and policyname = 'sales_incognito_gate' and permissive = 'RESTRICTIVE'
  ) then
    raise exception 'restrictive incognito policy is missing on sales';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sales'
      and policyname = 'sales_incognito_server_insert_only' and permissive = 'RESTRICTIVE'
  ) then
    raise exception 'direct browser inserts of incognito sales are not blocked';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'incognito_sale_storage_gate' and permissive = 'RESTRICTIVE'
  ) then
    raise exception 'incognito storage gate is missing';
  end if;

  select owners_count into standard_owners from public.pricing_settings where id = 1;
  select owners_count into incognito_owners from public.incognito_pricing_settings where id = 1;
  if incognito_owners is distinct from greatest(0, standard_owners - 1) then
    raise exception 'incognito calculator must start with exactly one owner margin less';
  end if;

  select id into owner_id from public.profiles where role = 'owner' limit 1;
  select id into admin_id from public.profiles where role = 'admin' limit 1;
  if owner_id is not null then
    insert into public.user_permissions (user_id, incognito_sales, updated_by)
    values (owner_id, false, coalesce(admin_id, owner_id))
    on conflict (user_id) do update
      set incognito_sales = excluded.incognito_sales,
          updated_by = excluded.updated_by;

    perform set_config('request.jwt.claim.sub', owner_id::text, true);
    if public.has_incognito_sales_access() then
      raise exception 'owner without individual permission can access incognito';
    end if;

    update public.user_permissions set incognito_sales = true where user_id = owner_id;
    if not public.has_incognito_sales_access() then
      raise exception 'granted user cannot access incognito';
    end if;
  end if;

  if admin_id is not null then
    perform set_config('request.jwt.claim.sub', admin_id::text, true);
    if not public.has_incognito_sales_access() then
      raise exception 'administrator must retain incognito management access';
    end if;
  end if;
end;
$$;

select 'incognito_sales_security_ok' as result;

rollback;
