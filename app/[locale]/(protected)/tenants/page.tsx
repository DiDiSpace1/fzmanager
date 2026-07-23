import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {canUseRentReminders, getWorkspaceBilling} from '@/lib/billing/limits';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {createTenantAction} from './actions';
import {TenantTableClient} from './tenant-table-client';

type TenantRow = {
  id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  phone: string | null;
  notes: string | null;
  leases: {
    id: string;
    status: string;
    start_date: string;
    end_date: string | null;
    charges_amount: number;
    monthly_rent: number;
    properties: {name: string} | null;
    units: {name: string} | null;
    rent_charges: {status: string; period_month: string}[];
    rent_reminder_day: number | null;
    rent_reminder_days_before: number;
    rent_reminder_enabled: boolean;
  }[];
};

type TenantsPageProps = {
  searchParams: Promise<{
    error?: string;
    month?: string;
    new?: string;
    q?: string;
    success?: string;
    view?: string;
  }>;
};

const MONTH_PARAM_PATTERN = /^\d{4}-\d{2}$/;
const TENANT_VIEWS = new Set(['all', 'active', 'unassigned', 'expiring', 'overdue']);
const errorMessageKeys = new Set(['plan_limit']);
const successMessageKeys = new Set(['rent_status_updated_receipt_created', 'rent_status_updated_receipt_exists', 'rent_status_updated_receipt_failed']);

function isoMonth(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthStart(month: string) {
  return `${month}-01`;
}

function parseMonthParam(month?: string) {
  if (month && MONTH_PARAM_PATTERN.test(month)) {
    return month;
  }

  return isoMonth(new Date());
}

function addMonths(month: string, offset: number) {
  const [year, monthIndex] = month.split('-').map(Number);
  return isoMonth(new Date(Date.UTC(year, monthIndex - 1 + offset, 1)));
}

function viewHref(view: string, month: string, queryText: string) {
  const params = new URLSearchParams({month, view});

  if (queryText) {
    params.set('q', queryText);
  }

  return `/tenants?${params.toString()}`;
}

function leaseCoversMonth(lease: TenantRow['leases'][number], month: string) {
  const start = monthStart(month);
  const nextMonth = monthStart(addMonths(month, 1));
  return lease.start_date < nextMonth && (!lease.end_date || lease.end_date >= start);
}

function activeLease(tenant: TenantRow, month: string) {
  return tenant.leases.find((lease) => lease.status === 'active' && leaseCoversMonth(lease, month)) ?? null;
}

function hasAssignedLease(tenant: TenantRow) {
  return tenant.leases.some((lease) => lease.status === 'active' || lease.status === 'draft');
}

function hasOverdueRent(tenant: TenantRow, month: string) {
  const currentPeriod = monthStart(month);

  return tenant.leases.some((lease) =>
    lease.rent_charges.some((rentCharge) => lease.start_date <= currentPeriod && rentCharge.period_month <= currentPeriod && ['partial', 'unpaid'].includes(rentCharge.status))
  );
}

function earliestOverdueMonth(tenants: TenantRow[], month: string) {
  const currentPeriod = monthStart(month);
  const overdueMonths = tenants.flatMap((tenant) =>
    tenant.leases.flatMap((lease) =>
      lease.rent_charges
        .filter((rentCharge) => rentCharge.period_month <= currentPeriod && ['partial', 'unpaid'].includes(rentCharge.status))
        .map((rentCharge) => rentCharge.period_month.slice(0, 7))
    )
  );

  return overdueMonths.sort()[0] ?? month;
}

function leaseExpiresSoon(tenant: TenantRow, month: string) {
  const lease = activeLease(tenant, month);

  if (!lease?.end_date) {
    return false;
  }

  const start = monthStart(month);
  const limit = monthStart(addMonths(month, 3));
  return lease.end_date >= start && lease.end_date < limit;
}

export default async function TenantsPage({searchParams}: TenantsPageProps) {
  const t = await getTranslations('tenants');
  const locale = await getLocale();
  const params = await searchParams;
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const queryText = (params.q ?? '').trim();
  const selectedMonth = parseMonthParam(params.month);
  const selectedView = TENANT_VIEWS.has(params.view ?? '') ? params.view ?? 'active' : 'active';
  const showCreate = params.new === '1';

  const query = supabase
    .from('tenants')
    .select(
      'id, full_name, email, is_active, phone, notes, leases(id, status, start_date, end_date, monthly_rent, charges_amount, rent_reminder_enabled, rent_reminder_day, rent_reminder_days_before, properties(name), units(name), rent_charges(status, period_month))'
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false});

  const {data: tenants, error} = await query.returns<TenantRow[]>();
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const hasReminderAccess = canUseRentReminders(billing);
  const allRows = tenants ?? [];
  const activeTenantRows = allRows.filter((tenant) => tenant.is_active);
  const summaryMonth = isoMonth(new Date());
  const summaryActiveRows = activeTenantRows.filter((tenant) => activeLease(tenant, summaryMonth));
  const summaryUnassignedRows = activeTenantRows.filter((tenant) => !hasAssignedLease(tenant));
  const summaryExpiringRows = activeTenantRows.filter((tenant) => leaseExpiresSoon(tenant, summaryMonth));
  const summaryOverdueRows = activeTenantRows.filter((tenant) => hasOverdueRent(tenant, summaryMonth));
  const summaryOverdueMonth = earliestOverdueMonth(activeTenantRows, summaryMonth);
  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">{t('title')}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('subtitle')}</p>
        </div>
        {showCreate ? (
          <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--line)] px-5 text-sm font-semibold text-[#171d1c]" href="/tenants">
            {t('backToList')}
          </Link>
        ) : (
          <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white" href="/tenants?new=1" style={{color: '#ffffff'}}>
            + {t('addTenant')}
          </Link>
        )}
      </div>

      {error ? (
        <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          {t('errors.loadFailed')}
        </div>
      ) : null}

      {params.error && errorMessageKeys.has(params.error) ? (
        <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          {t(`errors.${params.error}`)}
        </div>
      ) : null}

      {params.success && successMessageKeys.has(params.success) ? (
        <div className="mt-6 rounded-lg border border-[#b8e5cf] bg-[#edf8f1] p-4 text-sm leading-6 text-[#087a55]">
          {t(`success.${params.success}`)}
        </div>
      ) : null}

      {showCreate ? (
        <CreateTenantView locale={locale} />
      ) : (
        <>
          <section className="mt-8 grid gap-3">
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryCard
                active={selectedView === 'unassigned'}
                href={viewHref('unassigned', summaryMonth, queryText)}
                icon="person_edit"
                iconTone="muted"
                label={t('summary.unassigned')}
                note={t('summary.unassignedNote')}
                tone="neutral"
                value={summaryUnassignedRows.length.toString()}
              />
              <SummaryCard
                active={selectedView === 'expiring'}
                href={viewHref('expiring', summaryMonth, queryText)}
                icon="notifications_active"
                iconTone="warning"
                label={t('summary.expiring')}
                note={t('summary.expiringNote')}
                tone="warning"
                value={summaryExpiringRows.length.toString()}
              />
              <SummaryCard
                active={selectedView === 'overdue'}
                href={viewHref('overdue', summaryOverdueMonth, queryText)}
                icon="warning"
                iconTone="danger"
                label={t('summary.overdue')}
                note={t('summary.overdueNote')}
                tone="danger"
                value={summaryOverdueRows.length.toString()}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <SummaryCard active={selectedView === 'all'} href={viewHref('all', summaryMonth, queryText)} icon="person" iconTone="primary" label={t('summary.allTenants')} note={t('summary.allTenantsNote')} value={allRows.length.toString()} />
              <SummaryCard active={selectedView === 'active'} href={viewHref('active', summaryMonth, queryText)} icon="person_check" iconTone="primary" label={t('summary.activeLeases')} note={t('summary.activeLeasesNote')} value={summaryActiveRows.length.toString()} />
            </div>
          </section>

          <TenantTableClient hasReminderAccess={hasReminderAccess} initialMonth={selectedMonth} initialQuery={queryText} initialView={selectedView} locale={locale} tenants={allRows} />
        </>
      )}
    </>
  );
}

function SummaryCard({
  active = false,
  href,
  icon,
  iconTone = 'primary',
  label,
  note,
  tone = 'neutral',
  value
}: {
  active?: boolean;
  href: string;
  icon: string;
  iconTone?: 'danger' | 'muted' | 'primary' | 'warning';
  label: string;
  note: string;
  tone?: 'danger' | 'neutral' | 'warning';
  value: string;
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-[#fecaca] text-[#ba1a1a]'
      : tone === 'warning'
        ? 'border-[#fed7aa] text-[#b45309]'
        : 'border-[var(--line-soft)] text-[var(--muted)]';
  const iconToneClass =
    iconTone === 'danger'
      ? 'bg-[#ffdad6] text-[#ba1a1a]'
      : iconTone === 'warning'
        ? 'bg-[#fff4db] text-[#9a5a00]'
        : iconTone === 'muted'
          ? 'bg-gray-100 text-gray-600'
          : 'bg-[var(--accent-soft)] text-[var(--accent)]';

  return (
    <Link className={['focus-ring rounded-lg border bg-white p-5 shadow-sm transition hover:bg-[#f8fbfa]', toneClass, active ? 'ring-2 ring-[var(--accent)]' : ''].join(' ')} href={href}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase">{label}</p>
          <p className="mt-3 text-xl font-semibold tabular-nums text-[#171d1c]">{value}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{note}</p>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconToneClass}`}>
          <span className="material-symbols-outlined" data-icon={icon}>
            {icon}
          </span>
        </div>
      </div>
    </Link>
  );
}

async function CreateTenantView({locale}: {locale: string}) {
  const common = await getTranslations('common');
  const t = await getTranslations('tenants.form');

  return (
    <form action={createTenantAction} className="mt-8 grid gap-5">
      <input name="locale" type="hidden" value={locale} />
      <SectionCard title={t('identityTitle')}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            {t('fullName')}
            <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="full_name" placeholder={t('fullNamePlaceholder')} required />
          </label>
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            {t('email')}
            <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="email" placeholder={t('emailPlaceholder')} type="email" />
          </label>
        </div>
      </SectionCard>
      <SectionCard title={t('contactTitle')}>
        <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
          {t('phone')}
          <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="phone" placeholder="+33 ..." />
        </label>
      </SectionCard>
      <SectionCard title={t('notesTitle')}>
        <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
          {t('notes')}
          <textarea className="focus-ring min-h-28 rounded-md border border-[var(--line)] px-3 py-3 text-sm font-normal" name="notes" placeholder={t('notesPlaceholder')} />
        </label>
      </SectionCard>
      <div className="flex justify-end gap-3">
        <Link className="focus-ring inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-5 text-sm font-semibold cursor-pointer" href="/tenants">
          {common('cancel')}
        </Link>
        <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white cursor-pointer" style={{color: '#ffffff'}} type="submit">
          {common('add')}
        </button>
      </div>
    </form>
  );
}

function SectionCard({children, title}: {children: React.ReactNode; title: string}) {
  return (
    <section className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
      <h2 className="mb-5 text-base font-semibold">{title}</h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
