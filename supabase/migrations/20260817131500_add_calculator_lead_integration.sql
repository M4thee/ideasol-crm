create or replace function public.claim_next_lead_integration_candidate(
  p_integration_id uuid,
  p_candidate_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_user_id uuid;
  current_cursor bigint;
  eligible_count integer;
begin
  select round_robin_cursor
  into current_cursor
  from public.lead_integrations
  where id = p_integration_id
  for update;

  if current_cursor is null then
    return null;
  end if;

  select count(*)
  into eligible_count
  from public.lead_integration_users liu
  join public.profiles p on p.id = liu.user_id
  where liu.integration_id = p_integration_id
    and liu.user_id = any(p_candidate_ids)
    and coalesce(p.is_active, true) = true
    and coalesce(p.hidden_from_assignment, false) = false;

  if eligible_count = 0 then
    return null;
  end if;

  select liu.user_id
  into selected_user_id
  from public.lead_integration_users liu
  join public.profiles p on p.id = liu.user_id
  where liu.integration_id = p_integration_id
    and liu.user_id = any(p_candidate_ids)
    and coalesce(p.is_active, true) = true
    and coalesce(p.hidden_from_assignment, false) = false
  order by array_position(p_candidate_ids, liu.user_id), liu.position, liu.user_id
  offset mod(current_cursor, eligible_count)
  limit 1;

  update public.lead_integrations
  set round_robin_cursor = current_cursor + 1,
      updated_at = now()
  where id = p_integration_id;

  return selected_user_id;
end;
$$;

revoke all on function public.claim_next_lead_integration_candidate(uuid, uuid[]) from public;
grant execute on function public.claim_next_lead_integration_candidate(uuid, uuid[]) to service_role;

insert into public.client_tags (name, color, is_system, is_active)
values ('KALKULATOR ME', '#0f766e', true, true)
on conflict (name) do update
set color = excluded.color,
    is_active = true;

insert into public.lead_integrations (
  slug,
  name,
  source_type,
  campaign_name,
  assignment_rule,
  tag_names,
  field_mapping,
  notify_assigned_user,
  notify_owners
)
values (
  'calculator-energy-storage',
  'Kalkulator magazynu energii',
  'calculator',
  'Kalkulator ME',
  'postal_code',
  array['KALKULATOR ME'],
  '{}'::jsonb,
  true,
  true
)
on conflict (slug) do update
set name = excluded.name,
    source_type = excluded.source_type,
    campaign_name = excluded.campaign_name,
    assignment_rule = excluded.assignment_rule,
    tag_names = excluded.tag_names,
    notify_assigned_user = excluded.notify_assigned_user,
    notify_owners = excluded.notify_owners,
    is_active = true,
    updated_at = now();

insert into public.lead_integration_users (integration_id, user_id, position)
select integration.id,
       profile.id,
       row_number() over (order by profile.display_name, profile.id)::integer
from public.lead_integrations integration
join public.profiles profile
  on coalesce(profile.is_active, true) = true
 and coalesce(profile.hidden_from_assignment, false) = false
where integration.slug = 'calculator-energy-storage'
  and exists (
    select 1
    from public.user_service_locations location
    where location.user_id = profile.id
  )
on conflict (integration_id, user_id) do nothing;
