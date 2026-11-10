-- Phone is the primary identity key. E-mail only disambiguates equal-phone
-- cards or acts as a fallback when no normalizable phone was submitted.
create or replace function public.ingest_external_lead(
  p_source text,
  p_external_uid text,
  p_business_area text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_postal_code text,
  p_province text,
  p_client_type text,
  p_assigned_user_id uuid,
  p_note text
)
returns table (
  client_id uuid,
  duplicate boolean,
  assigned_user_id uuid,
  client_status text,
  matched_by text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_phone_key text;
  v_email_key text;
  v_client public.clients%rowtype;
  v_match_method text := 'new';
  v_lock_key text;
begin
  if p_source not in ('meta', 'www') then
    raise exception 'Unsupported external lead source: %', p_source;
  end if;

  v_phone_key := case
    when length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) >= 9
      then right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 9)
    else null
  end;
  v_email_key := nullif(lower(btrim(coalesce(p_email, ''))), '');

  if v_phone_key is null and v_email_key is null then
    raise exception 'External lead requires a normalizable phone or email';
  end if;

  for v_lock_key in
    select value
    from unnest(array[
      case when v_phone_key is not null then coalesce(p_business_area, 'ideasol') || ':phone:' || v_phone_key end,
      case when v_email_key is not null then coalesce(p_business_area, 'ideasol') || ':email:' || v_email_key end
    ]) as keys(value)
    where value is not null
    order by value
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('external-lead:' || v_lock_key, 0));
  end loop;

  select c.*
  into v_client
  from public.clients c
  where c.business_area = coalesce(nullif(p_business_area, ''), 'ideasol')
    and (
      (v_phone_key is not null and c.phone_dedup_key = v_phone_key)
      or (v_phone_key is null and v_email_key is not null and c.email_dedup_key = v_email_key)
    )
  order by
    case when v_phone_key is not null and c.phone_dedup_key = v_phone_key then 0 else 1 end,
    case when v_email_key is not null and c.email_dedup_key = v_email_key then 0 else 1 end,
    c.last_lead_activity_at desc,
    c.created_at asc,
    c.id
  limit 1
  for update;

  if found then
    v_match_method := case
      when v_phone_key is not null and v_client.phone_dedup_key = v_phone_key then 'phone'
      else 'email'
    end;

    update public.clients
    set last_lead_activity_at = now(), updated_at = now()
    where id = v_client.id
    returning * into v_client;
  else
    insert into public.clients (
      full_name,
      email,
      phone,
      postal_code,
      province,
      client_type,
      status,
      assigned_user_id,
      lead_source,
      business_area,
      last_lead_activity_at
    ) values (
      coalesce(nullif(btrim(p_full_name), ''), case when p_source = 'meta' then 'Lead Meta Ads' else 'Lead WWW' end),
      v_email_key,
      nullif(btrim(p_phone), ''),
      nullif(btrim(p_postal_code), ''),
      nullif(btrim(p_province), ''),
      coalesce(nullif(btrim(p_client_type), ''), 'B2C'),
      case when p_assigned_user_id is null then 'Nowy lead' else 'Przypisany' end,
      p_assigned_user_id,
      case when p_source = 'meta' then 'Meta Ads' else 'WWW' end,
      coalesce(nullif(p_business_area, ''), 'ideasol'),
      now()
    )
    returning * into v_client;
  end if;

  if nullif(btrim(coalesce(p_note, '')), '') is not null then
    insert into public.client_notes (client_id, content, created_by)
    values (v_client.id, p_note, null);
  end if;

  if v_match_method <> 'new' and v_client.assigned_user_id is not null then
    insert into public.notifications (user_id, title, body, client_id, link_url)
    values (
      v_client.assigned_user_id,
      'Ponowne zgłoszenie klienta — wykryto duplikat',
      coalesce(nullif(btrim(p_full_name), ''), v_client.full_name, 'Klient') ||
        ' przesłał ponowne zgłoszenie przez ' || upper(p_source) || '. Dodano ankietę do istniejącej karty.',
      v_client.id,
      '/clients/' || v_client.id::text
    );
  end if;

  insert into public.external_lead_dedup_events (
    source, external_uid, client_id, duplicate, matched_by,
    submitted_phone_key, submitted_email_key, assigned_user_id
  ) values (
    p_source, nullif(p_external_uid, ''), v_client.id, v_match_method <> 'new', v_match_method,
    v_phone_key, v_email_key, v_client.assigned_user_id
  );

  return query
  select v_client.id, v_match_method <> 'new', v_client.assigned_user_id,
         v_client.status, v_match_method;
end;
$$;

revoke all on function public.ingest_external_lead(text, text, text, text, text, text, text, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.ingest_external_lead(text, text, text, text, text, text, text, text, text, uuid, text)
  to service_role;
