alter table public.rent_payments
  add column if not exists revenue_type text not null default 'rent';

alter table public.rent_payments
  drop constraint if exists rent_payments_revenue_type_check;

alter table public.rent_payments
  add constraint rent_payments_revenue_type_check
  check (revenue_type in ('rent', 'deposit', 'other'));
