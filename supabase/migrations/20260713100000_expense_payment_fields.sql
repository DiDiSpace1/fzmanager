alter table public.expenses
add column if not exists payment_method text not null default 'card',
add column if not exists payment_status text not null default 'paid';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_payment_method_check'
  ) then
    alter table public.expenses
    add constraint expenses_payment_method_check
    check (payment_method in ('bank_transfer', 'cash', 'cheque', 'card', 'other'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_payment_status_check'
  ) then
    alter table public.expenses
    add constraint expenses_payment_status_check
    check (payment_status in ('paid', 'pending'));
  end if;
end $$;
