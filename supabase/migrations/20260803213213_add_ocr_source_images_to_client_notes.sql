alter table public.client_notes
  add column if not exists source_image_bucket text,
  add column if not exists source_image_path text,
  add column if not exists source_image_original_name text,
  add column if not exists source_image_mime_type text,
  add column if not exists source_image_size bigint,
  add column if not exists source_image_import_key text;

alter table public.client_notes
  drop constraint if exists client_notes_source_image_pair_check,
  add constraint client_notes_source_image_pair_check check (
    (source_image_bucket is null and source_image_path is null)
    or
    (
      source_image_bucket = 'ocr-source-images'
      and source_image_path is not null
      and char_length(source_image_path) between 10 and 1000
    )
  ),
  drop constraint if exists client_notes_source_image_size_check,
  add constraint client_notes_source_image_size_check check (
    source_image_size is null or source_image_size between 0 and 20971520
  );

create unique index if not exists client_notes_source_image_import_key_idx
  on public.client_notes (source_image_import_key)
  where source_image_import_key is not null;

comment on column public.client_notes.source_image_path is
  'Prywatny plik źródłowy, z którego OCR utworzył notatkę.';
