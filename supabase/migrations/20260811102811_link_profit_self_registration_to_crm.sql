create index if not exists clients_phone_last_9_digits_idx
  on public.clients ((right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 9)))
  where length(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) >= 9;

create index if not exists clients_contact_phone_last_9_digits_idx
  on public.clients ((right(regexp_replace(coalesce(contact_phone, ''), '[^0-9]', '', 'g'), 9)))
  where length(regexp_replace(coalesce(contact_phone, ''), '[^0-9]', '', 'g')) >= 9;

create or replace function public.find_crm_client_ids_by_phone(p_phone text)
returns table(client_id uuid)
language sql
stable
security invoker
set search_path = public
as $function$
  with normalized_input as (
    select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as digits
  )
  select distinct clients.id
  from public.clients
  cross join normalized_input
  where length(normalized_input.digits) >= 9
    and (
      (
        length(regexp_replace(coalesce(clients.phone, ''), '[^0-9]', '', 'g')) >= 9
        and right(regexp_replace(coalesce(clients.phone, ''), '[^0-9]', '', 'g'), 9)
          = right(normalized_input.digits, 9)
      )
      or (
        length(regexp_replace(coalesce(clients.contact_phone, ''), '[^0-9]', '', 'g')) >= 9
        and right(regexp_replace(coalesce(clients.contact_phone, ''), '[^0-9]', '', 'g'), 9)
          = right(normalized_input.digits, 9)
      )
    )
  order by clients.id;
$function$;

comment on function public.find_crm_client_ids_by_phone(text) is
  'Serwerowe, odporne na format zapisu telefonu dopasowanie konta Profit do klienta CRM.';

revoke all on function public.find_crm_client_ids_by_phone(text) from public;
revoke execute on function public.find_crm_client_ids_by_phone(text) from anon, authenticated;
grant execute on function public.find_crm_client_ids_by_phone(text) to service_role;
