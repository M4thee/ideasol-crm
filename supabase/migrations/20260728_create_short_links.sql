create table if not exists public.short_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  destination_url text not null,
  is_active boolean not null default true,
  click_count bigint not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_clicked_at timestamptz,
  constraint short_links_code_format check (code ~ '^[A-Za-z0-9]{4,10}$'),
  constraint short_links_destination_length check (
    char_length(destination_url) between 1 and 4096
  ),
  constraint short_links_click_count_nonnegative check (click_count >= 0)
);

create index if not exists short_links_created_at_idx
  on public.short_links (created_at desc);

alter table public.short_links enable row level security;

revoke all on table public.short_links from anon, authenticated;

create or replace function public.resolve_short_link(p_code text)
returns table (destination_url text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.short_links
  set
    click_count = click_count + 1,
    last_clicked_at = now()
  where code = p_code
    and is_active = true
  returning short_links.destination_url;
end;
$$;

revoke all on function public.resolve_short_link(text) from public, anon, authenticated;
grant execute on function public.resolve_short_link(text) to service_role;
