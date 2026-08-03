create table if not exists public.user_permissions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  realization boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_permissions enable row level security;

grant select, insert, update, delete on public.user_permissions to authenticated;
grant all on public.user_permissions to service_role;

create policy "user_permissions_select_own_or_admin"
on public.user_permissions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role in ('admin', 'owner')
  )
);

create policy "user_permissions_admin_insert"
on public.user_permissions
for insert
to authenticated
with check (
  updated_by = (select auth.uid())
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

create policy "user_permissions_admin_update"
on public.user_permissions
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
)
with check (
  updated_by = (select auth.uid())
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

create table if not exists public.installers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (char_length(btrim(company_name)) > 0),
  address text,
  nip text check (nip is null or nip ~ '^[0-9]{10}$'),
  contact_name text,
  phone text,
  email text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists installers_nip_unique
on public.installers(nip)
where nip is not null;

alter table public.installers enable row level security;

grant select, insert, update, delete on public.installers to authenticated;
grant all on public.installers to service_role;

create policy "installers_select_realization"
on public.installers
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role in ('admin', 'owner')
  )
  or exists (
    select 1
    from public.user_permissions
    where user_permissions.user_id = (select auth.uid())
      and user_permissions.realization = true
  )
);

create policy "installers_admin_insert"
on public.installers
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

create policy "installers_admin_update"
on public.installers
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
)
with check (
  updated_by = (select auth.uid())
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

create policy "installers_admin_delete"
on public.installers
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

create table if not exists public.installation_orders (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null unique references public.sales(id) on delete cascade,
  installer_id uuid not null references public.installers(id) on delete restrict,
  installation_date date not null,
  installer_snapshot jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists installation_orders_installer_id_idx
on public.installation_orders(installer_id);

alter table public.installation_orders enable row level security;

grant select, insert, update on public.installation_orders to authenticated;
grant all on public.installation_orders to service_role;

create policy "installation_orders_select_realization"
on public.installation_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role in ('admin', 'owner')
  )
  or exists (
    select 1
    from public.user_permissions
    where user_permissions.user_id = (select auth.uid())
      and user_permissions.realization = true
  )
);

create policy "installation_orders_insert_realization"
on public.installation_orders
for insert
to authenticated
with check (
  generated_by = (select auth.uid())
  and (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role in ('admin', 'owner')
    )
    or exists (
      select 1
      from public.user_permissions
      where user_permissions.user_id = (select auth.uid())
        and user_permissions.realization = true
    )
  )
);

create policy "installation_orders_update_realization"
on public.installation_orders
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role in ('admin', 'owner')
  )
  or exists (
    select 1
    from public.user_permissions
    where user_permissions.user_id = (select auth.uid())
      and user_permissions.realization = true
  )
)
with check (
  generated_by = (select auth.uid())
  and (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role in ('admin', 'owner')
    )
    or exists (
      select 1
      from public.user_permissions
      where user_permissions.user_id = (select auth.uid())
        and user_permissions.realization = true
    )
  )
);
