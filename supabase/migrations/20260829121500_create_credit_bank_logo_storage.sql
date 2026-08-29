insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'credit-bank-logos',
  'credit-bank-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can read credit bank logo objects" on storage.objects;
create policy "Admins can read credit bank logo objects"
on storage.objects for select
to authenticated
using (
  bucket_id = 'credit-bank-logos'
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role in ('owner', 'admin')
  )
);

drop policy if exists "Admins can upload credit bank logos" on storage.objects;
create policy "Admins can upload credit bank logos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'credit-bank-logos'
  and storage.extension(name) in ('png', 'jpg', 'jpeg')
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role in ('owner', 'admin')
  )
);

drop policy if exists "Admins can update credit bank logos" on storage.objects;
create policy "Admins can update credit bank logos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'credit-bank-logos'
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role in ('owner', 'admin')
  )
)
with check (
  bucket_id = 'credit-bank-logos'
  and storage.extension(name) in ('png', 'jpg', 'jpeg')
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role in ('owner', 'admin')
  )
);

drop policy if exists "Admins can delete credit bank logos" on storage.objects;
create policy "Admins can delete credit bank logos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'credit-bank-logos'
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role in ('owner', 'admin')
  )
);
