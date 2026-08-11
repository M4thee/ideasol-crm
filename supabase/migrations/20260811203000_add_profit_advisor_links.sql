alter table public.profiles
  add column if not exists profit_enabled boolean not null default false,
  add column if not exists profit_referral_code text;

create unique index if not exists profiles_profit_referral_code_unique
  on public.profiles (profit_referral_code)
  where profit_referral_code is not null;

comment on column public.profiles.profit_enabled is
  'Czy aktywny użytkownik CRM został udostępniony jako doradca programu IdeaSol Profit.';

comment on column public.profiles.profit_referral_code is
  'Stały, unikalny kod używany w indywidualnym linku rejestracyjnym doradcy Profit.';
