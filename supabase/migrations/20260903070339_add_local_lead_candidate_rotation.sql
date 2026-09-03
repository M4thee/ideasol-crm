create table public.lead_integration_candidate_rotations (
  integration_id uuid not null
    references public.lead_integrations(id) on delete cascade,
  candidate_key text not null,
  candidate_user_ids uuid[] not null,
  last_assigned_user_id uuid
    references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (integration_id, candidate_key)
);

comment on table public.lead_integration_candidate_rotations is
  'Atomic round-robin state for each distinct local group of lead candidates.';

alter table public.lead_integration_candidate_rotations enable row level security;

revoke all on table public.lead_integration_candidate_rotations
from public, anon, authenticated;

grant select, insert, update, delete
on table public.lead_integration_candidate_rotations
to service_role;

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
  ranked_candidate_ids uuid[];
  rotation_candidate_ids uuid[];
  candidate_group_key text;
  last_assigned_user_id uuid;
  last_assigned_position integer;
  selected_user_id uuid;
begin
  if coalesce(cardinality(p_candidate_ids), 0) = 0 then
    return null;
  end if;

  select coalesce(
    array_agg(
      candidate.user_id
      order by candidate.input_position, candidate.integration_position, candidate.user_id
    ),
    '{}'::uuid[]
  )
  into ranked_candidate_ids
  from (
    select
      liu.user_id,
      min(input_candidate.ordinality) as input_position,
      liu.position as integration_position
    from unnest(p_candidate_ids) with ordinality
      as input_candidate(user_id, ordinality)
    join public.lead_integration_users liu
      on liu.integration_id = p_integration_id
     and liu.user_id = input_candidate.user_id
    join public.profiles profile
      on profile.id = liu.user_id
    where coalesce(profile.is_active, true) = true
      and coalesce(profile.hidden_from_assignment, false) = false
    group by liu.user_id, liu.position
  ) candidate;

  if cardinality(ranked_candidate_ids) = 0 then
    return null;
  end if;

  select array_agg(
    liu.user_id
    order by liu.position, liu.user_id
  )
  into rotation_candidate_ids
  from public.lead_integration_users liu
  where liu.integration_id = p_integration_id
    and liu.user_id = any(ranked_candidate_ids);

  select array_to_string(
    array_agg(candidate_id order by candidate_id::text),
    ','
  )
  into candidate_group_key
  from unnest(ranked_candidate_ids) as candidate_id;

  insert into public.lead_integration_candidate_rotations (
    integration_id,
    candidate_key,
    candidate_user_ids
  )
  values (
    p_integration_id,
    candidate_group_key,
    rotation_candidate_ids
  )
  on conflict (integration_id, candidate_key) do nothing;

  select rotation.last_assigned_user_id
  into last_assigned_user_id
  from public.lead_integration_candidate_rotations rotation
  where rotation.integration_id = p_integration_id
    and rotation.candidate_key = candidate_group_key
  for update;

  last_assigned_position := array_position(
    rotation_candidate_ids,
    last_assigned_user_id
  );

  if last_assigned_position is null then
    -- The first lead for a new local group goes to the geographically nearest user.
    selected_user_id := ranked_candidate_ids[1];
  else
    -- Later leads rotate in a stable order, even if one user is slightly nearer.
    selected_user_id := rotation_candidate_ids[
      mod(last_assigned_position, cardinality(rotation_candidate_ids)) + 1
    ];
  end if;

  update public.lead_integration_candidate_rotations
  set candidate_user_ids = rotation_candidate_ids,
      last_assigned_user_id = selected_user_id,
      updated_at = now()
  where integration_id = p_integration_id
    and candidate_key = candidate_group_key;

  return selected_user_id;
end;
$$;

revoke all on function public.claim_next_lead_integration_candidate(uuid, uuid[])
from public, anon, authenticated;

grant execute on function public.claim_next_lead_integration_candidate(uuid, uuid[])
to service_role;
