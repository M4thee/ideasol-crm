begin;

do $$
declare
  test_device_id uuid;
  redeemed_device_id uuid;
  issued_code public.cc_device_pairing_codes;
begin
  insert into public.cc_devices (name, platform, access_token_digest)
  values (
    'Command Center pairing smoke test',
    'google_tv',
    md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text)
  )
  returning id into test_device_id;

  issued_code := public.cc_issue_device_pairing_code(
    test_device_id,
    repeat('b', 64),
    null
  );

  if issued_code.expires_at < now() + interval '2 minutes 50 seconds'
    or issued_code.expires_at > now() + interval '3 minutes 10 seconds' then
    raise exception 'Pairing code expiry is not three minutes.';
  end if;

  redeemed_device_id := public.cc_redeem_device_pairing_code(
    repeat('b', 64),
    repeat('c', 64)
  );
  if redeemed_device_id is distinct from test_device_id then
    raise exception 'Valid pairing code was not redeemed.';
  end if;

  if public.cc_redeem_device_pairing_code(repeat('b', 64), repeat('d', 64)) is not null then
    raise exception 'Pairing code could be used more than once.';
  end if;

  issued_code := public.cc_issue_device_pairing_code(
    test_device_id,
    repeat('e', 64),
    null
  );
  update public.cc_device_pairing_codes
  set created_at = now() - interval '5 minutes',
      expires_at = now() - interval '2 minutes'
  where id = issued_code.id;

  if public.cc_redeem_device_pairing_code(repeat('e', 64), repeat('f', 64)) is not null then
    raise exception 'Expired pairing code was redeemed.';
  end if;
end;
$$;

rollback;
