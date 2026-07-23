import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {localizedPath} from '@/lib/navigation';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {ReminderCenterClient, type ReminderCenterRow} from './reminder-center-client';

type Relation<T> = T | T[] | null;

type ReminderLeaseRow = {
  id: string;
  rent_reminder_day: number | null;
  rent_reminder_days_before: number;
  rent_reminder_enabled: boolean;
  start_date: string;
  end_date: string | null;
  tenant_id: string;
  tenants: Relation<{email: string | null; full_name: string}>;
  properties: Relation<{name: string}>;
  units: Relation<{name: string}>;
  rent_reminder_logs: {
    created_at: string;
    error_message: string | null;
    sent_at: string | null;
    status: string;
  }[];
};

type RemindersPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

function relationOne<T>(value: Relation<T>) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dueDateForMonth(year: number, month: number, preferredDay: number) {
  const day = Math.min(Math.max(preferredDay, 1), daysInMonth(year, month));
  return new Date(Date.UTC(year, month - 1, day));
}

function addMonths(year: number, month: number, offset: number) {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return {month: date.getUTCMonth() + 1, year: date.getUTCFullYear()};
}

function nextReminderDate(lease: ReminderLeaseRow) {
  if (!lease.rent_reminder_enabled || !lease.rent_reminder_day) {
    return null;
  }

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  for (let offset = 0; offset < 14; offset += 1) {
    const {month, year} = addMonths(today.getUTCFullYear(), today.getUTCMonth() + 1, offset);
    const dueDate = dueDateForMonth(year, month, lease.rent_reminder_day);
    const scheduledFor = addDays(dueDate, -lease.rent_reminder_days_before);
    const scheduledIso = isoDate(scheduledFor);

    if (scheduledFor < today) {
      continue;
    }

    if (lease.start_date <= isoDate(dueDate) && (!lease.end_date || lease.end_date >= isoDate(dueDate))) {
      return scheduledIso;
    }
  }

  return null;
}

function latestLog(lease: ReminderLeaseRow) {
  return [...(lease.rent_reminder_logs ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

function rowFromLease(lease: ReminderLeaseRow): ReminderCenterRow {
  const tenant = relationOne(lease.tenants);
  const property = relationOne(lease.properties);
  const unit = relationOne(lease.units);
  const latest = latestLog(lease);

  return {
    daysBefore: lease.rent_reminder_days_before,
    enabled: lease.rent_reminder_enabled,
    errorMessage: latest?.error_message ?? null,
    id: lease.id,
    lastSentAt: latest?.sent_at ?? null,
    latestStatus: latest?.status ?? null,
    nextReminderAt: nextReminderDate(lease),
    propertyLabel: [property?.name, unit?.name].filter(Boolean).join(' - ') || '-',
    reminderDay: lease.rent_reminder_day,
    tenantEmail: tenant?.email ?? null,
    tenantId: lease.tenant_id,
    tenantName: tenant?.full_name ?? '-'
  };
}

export default async function RemindersPage({searchParams}: RemindersPageProps) {
  const t = await getTranslations('reminders');
  const locale = await getLocale();
  const params = await searchParams;
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const hasPortfolioAccess = hasPaidAccess(billing) && normalizeBillingPlan(billing?.plan) === 'portfolio';

  if (!hasPortfolioAccess) {
    return (
      <section className="rounded-xl border border-[var(--line-soft)] bg-white p-8 shadow-sm">
        <span className="inline-flex rounded-md bg-[#e4f7ed] px-3 py-1 text-xs font-semibold text-[var(--accent)]">Portfolio</span>
        <h1 className="mt-4 text-3xl font-semibold tracking-normal text-[#171d1c]">{t('lockedTitle')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t('lockedCopy')}</p>
        <Link className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white" href={localizedPath(locale, '/settings?tab=abonnement')} style={{color: '#ffffff'}}>
          {t('upgradeAction')}
        </Link>
      </section>
    );
  }

  const {data: leases, error} = await supabase
    .from('leases')
    .select(
      'id, tenant_id, start_date, end_date, rent_reminder_enabled, rent_reminder_day, rent_reminder_days_before, tenants(full_name, email), properties(name), units(name), rent_reminder_logs(status, sent_at, error_message, created_at)'
    )
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .order('start_date', {ascending: false})
    .returns<ReminderLeaseRow[]>();
  const rows = (leases ?? []).map(rowFromLease).sort((a, b) => a.tenantName.localeCompare(b.tenantName));
  const enabledCount = rows.filter((row) => row.enabled).length;
  const failedCount = rows.filter((row) => row.latestStatus === 'failed').length;
  const missingEmailCount = rows.filter((row) => !row.tenantEmail).length;

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="inline-flex rounded-md bg-[#e4f7ed] px-3 py-1 text-xs font-semibold text-[var(--accent)]">Portfolio</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#171d1c]">{t('title')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t('subtitle')}</p>
        </div>
      </div>

      {params.success ? <StatusBanner tone="success" text={t(`success.${params.success}`)} /> : null}
      {params.error ? <StatusBanner tone="error" text={t(`errors.${params.error}`)} /> : null}
      {error ? <StatusBanner tone="error" text={t('errors.loadFailed')} /> : null}

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <MetricCard label={t('metrics.activeLeases')} value={rows.length.toString()} />
        <MetricCard label={t('metrics.enabled')} value={enabledCount.toString()} />
        <MetricCard label={t('metrics.failed')} tone={failedCount ? 'danger' : 'neutral'} value={failedCount.toString()} />
        <MetricCard label={t('metrics.missingEmail')} tone={missingEmailCount ? 'warning' : 'neutral'} value={missingEmailCount.toString()} />
      </section>

      <ReminderCenterClient locale={locale} rows={rows} />
    </>
  );
}

function MetricCard({label, tone = 'neutral', value}: {label: string; tone?: 'danger' | 'neutral' | 'warning'; value: string}) {
  const toneClass = tone === 'danger' ? 'text-[#ba1a1a]' : tone === 'warning' ? 'text-[#9a5a00]' : 'text-[#171d1c]';

  return (
    <div className="rounded-xl border border-[var(--line-soft)] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className={`mt-3 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function StatusBanner({text, tone}: {text: string; tone: 'error' | 'success'}) {
  const className = tone === 'success' ? 'border-[#b8e5cf] bg-[#edf8f1] text-[#087a55]' : 'border-[#f0d6b6] bg-[#fff8ec] text-[#7a4a11]';

  return <div className={`mt-6 rounded-lg border p-4 text-sm leading-6 ${className}`}>{text}</div>;
}
