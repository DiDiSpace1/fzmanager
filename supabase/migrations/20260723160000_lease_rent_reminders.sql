alter table public.leases
  add column if not exists rent_reminder_enabled boolean not null default false,
  add column if not exists rent_reminder_day integer,
  add column if not exists rent_reminder_days_before integer not null default 0,
  add column if not exists last_rent_reminder_sent_at timestamptz;

update public.leases
set rent_reminder_day = extract(day from start_date)::integer
where rent_reminder_day is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leases_rent_reminder_day_check'
  ) then
    alter table public.leases
      add constraint leases_rent_reminder_day_check
      check (rent_reminder_day is null or rent_reminder_day between 1 and 31);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'leases_rent_reminder_days_before_check'
  ) then
    alter table public.leases
      add constraint leases_rent_reminder_days_before_check
      check (rent_reminder_days_before in (0, 1, 3, 7));
  end if;
end $$;
