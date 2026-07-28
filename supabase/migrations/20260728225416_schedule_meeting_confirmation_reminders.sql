create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'meeting-confirmation-reminders'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end
$$;

select cron.schedule(
  'meeting-confirmation-reminders',
  '* * * * *',
  $cron$
    select net.http_get(
      url := 'https://crm.ideasol.pl/api/cron/meeting-confirmation-reminders',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'meeting_confirmation_cron_secret'
          limit 1
        )
      ),
      timeout_milliseconds := 10000
    );
  $cron$
);
