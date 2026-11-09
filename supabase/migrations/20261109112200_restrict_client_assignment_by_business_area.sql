-- Expose only the assignment-safe part of user permissions to authenticated CRM
-- users. Other permission flags remain protected by user_permissions RLS.
create or replace function public.list_assignable_crm_users()
returns table (
  id uuid,
  display_name text,
  role text,
  ideasol_access boolean,
  ideatermo_access boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    profile.display_name,
    profile.role,
    coalesce(permission.ideasol, false) as ideasol_access,
    coalesce(permission.ideatermo, false) as ideatermo_access
  from public.profiles as profile
  left join public.user_permissions as permission
    on permission.user_id = profile.id
  where (select auth.uid()) is not null
    and profile.role in ('seller', 'manager', 'owner', 'admin', 'cc')
    and coalesce(profile.hidden_from_assignment, false) = false
  order by profile.display_name asc nulls last;
$$;

revoke all on function public.list_assignable_crm_users() from public, anon;
grant execute on function public.list_assignable_crm_users() to authenticated, service_role;

comment on function public.list_assignable_crm_users() is
  'Lists active CRM assignment targets with only their IdeaSol and IdeaTermo access flags.';

create or replace function private.enforce_client_assignee_business_area()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignee_has_access boolean := false;
begin
  if new.assigned_user_id is null then
    return new;
  end if;

  select
    case new.business_area
      when 'ideatermo' then coalesce(permission.ideatermo, false)
      else coalesce(permission.ideasol, false)
    end
  into assignee_has_access
  from public.user_permissions as permission
  where permission.user_id = new.assigned_user_id;

  if not coalesce(assignee_has_access, false) then
    raise exception 'Wybrany użytkownik nie ma uprawnień do obszaru %.', new.business_area
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_client_assignee_business_area()
  from public, anon, authenticated;

drop trigger if exists clients_enforce_assignee_business_area on public.clients;
create trigger clients_enforce_assignee_business_area
before insert or update of assigned_user_id, business_area on public.clients
for each row
execute function private.enforce_client_assignee_business_area();
