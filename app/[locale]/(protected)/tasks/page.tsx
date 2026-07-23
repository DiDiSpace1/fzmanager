import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {localizedPath} from '@/lib/navigation';
import {getCurrentUserWorkspace} from '@/lib/workspace';

type Relation<T> = T | T[] | null;

type LeaseRow = {
  end_date: string | null;
  id: string;
  property_id: string | null;
  start_date: string;
  tenant_id: string | null;
  tenants: Relation<{email: string | null; full_name: string}>;
  properties: Relation<{name: string}>;
  rent_charges: {period_month: string; status: string; total_due: number}[];
  rent_reminder_logs: {created_at: string; error_message: string | null; status: string}[];
};

type ReceiptDocument = {
  period_month: string | null;
  property_id: string | null;
  tenant_id: string | null;
};

type PortfolioTask = {
  actionHref: string;
  actionLabel: string;
  description: string;
  id: string;
  meta: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  type: 'document' | 'lease' | 'payment' | 'reminder' | 'tenant';
};

function relationOne<T>(value: Relation<T>) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function currentMonthStart() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatMonth(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {month: 'long', timeZone: 'UTC', year: 'numeric'}).format(new Date(`${value.slice(0, 7)}-01T00:00:00.000Z`));
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeZone: 'UTC'}).format(new Date(`${value}T00:00:00.000Z`));
}

function latestLog(lease: LeaseRow) {
  return [...(lease.rent_reminder_logs ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

function receiptKey(document: ReceiptDocument) {
  return [document.property_id ?? '', document.tenant_id ?? '', document.period_month ?? ''].join(':');
}

function chargeReceiptKey(lease: LeaseRow, periodMonth: string) {
  return [lease.property_id ?? '', lease.tenant_id ?? '', periodMonth].join(':');
}

function taskPriorityValue(priority: PortfolioTask['priority']) {
  return priority === 'high' ? 0 : priority === 'medium' ? 1 : 2;
}

export default async function TasksPage() {
  const t = await getTranslations('tasks');
  const locale = await getLocale();
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

  const [{data: leases, error: leasesError}, {data: receipts}] = await Promise.all([
    supabase
      .from('leases')
      .select('id, tenant_id, property_id, start_date, end_date, tenants(full_name, email), properties(name), rent_charges(period_month, status, total_due), rent_reminder_logs(status, error_message, created_at)')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .returns<LeaseRow[]>(),
    supabase
      .from('documents')
      .select('tenant_id, property_id, period_month')
      .eq('workspace_id', workspaceId)
      .eq('document_type', 'rent_receipt')
      .returns<ReceiptDocument[]>()
  ]);
  const receiptKeys = new Set((receipts ?? []).map(receiptKey));
  const currentPeriod = currentMonthStart();
  const today = new Date();
  const soonLimit = isoDate(addDays(today, 90));
  const tasks: PortfolioTask[] = [];

  for (const lease of leases ?? []) {
    const tenant = relationOne(lease.tenants);
    const property = relationOne(lease.properties);
    const tenantName = tenant?.full_name ?? t('unknownTenant');
    const propertyName = property?.name ?? t('unknownProperty');
    const tenantHref = lease.tenant_id ? localizedPath(locale, `/tenants/${lease.tenant_id}/edit`) : localizedPath(locale, '/tenants');
    const latest = latestLog(lease);

    if (latest?.status === 'failed') {
      tasks.push({
        actionHref: localizedPath(locale, '/reminders'),
        actionLabel: t('actions.retryReminder'),
        description: latest.error_message || t('descriptions.failedReminder'),
        id: `failed-reminder-${lease.id}`,
        meta: `${tenantName} · ${propertyName}`,
        priority: 'high',
        title: t('titles.failedReminder'),
        type: 'reminder'
      });
    }

    if (!tenant?.email) {
      tasks.push({
        actionHref: tenantHref,
        actionLabel: t('actions.completeTenant'),
        description: t('descriptions.missingEmail'),
        id: `missing-email-${lease.id}`,
        meta: `${tenantName} · ${propertyName}`,
        priority: 'medium',
        title: t('titles.missingEmail'),
        type: 'tenant'
      });
    }

    if (lease.end_date && lease.end_date >= isoDate(today) && lease.end_date <= soonLimit) {
      tasks.push({
        actionHref: localizedPath(locale, `/bail/${lease.id}`),
        actionLabel: t('actions.reviewLease'),
        description: t('descriptions.leaseExpiring', {date: formatDate(lease.end_date, locale)}),
        id: `lease-expiring-${lease.id}`,
        meta: `${tenantName} · ${propertyName}`,
        priority: 'medium',
        title: t('titles.leaseExpiring'),
        type: 'lease'
      });
    }

    for (const charge of lease.rent_charges ?? []) {
      if (charge.period_month <= currentPeriod && ['partial', 'unpaid'].includes(charge.status)) {
        tasks.push({
          actionHref: localizedPath(locale, `/collections?month=${charge.period_month.slice(0, 7)}&view=open`),
          actionLabel: t('actions.openRent'),
          description: t(`descriptions.${charge.status === 'partial' ? 'partialPayment' : 'unpaidRent'}`, {month: formatMonth(charge.period_month, locale)}),
          id: `rent-${charge.period_month}-${lease.id}`,
          meta: `${tenantName} · ${propertyName}`,
          priority: 'high',
          title: t('titles.overdueRent'),
          type: 'payment'
        });
      }

      if (charge.status === 'paid' && !receiptKeys.has(chargeReceiptKey(lease, charge.period_month))) {
        tasks.push({
          actionHref: localizedPath(locale, '/documents/quittance'),
          actionLabel: t('actions.generateReceipt'),
          description: t('descriptions.missingReceipt', {month: formatMonth(charge.period_month, locale)}),
          id: `missing-receipt-${charge.period_month}-${lease.id}`,
          meta: `${tenantName} · ${propertyName}`,
          priority: 'low',
          title: t('titles.missingReceipt'),
          type: 'document'
        });
      }
    }
  }

  const sortedTasks = tasks.sort((a, b) => taskPriorityValue(a.priority) - taskPriorityValue(b.priority) || a.title.localeCompare(b.title));
  const highCount = sortedTasks.filter((task) => task.priority === 'high').length;
  const mediumCount = sortedTasks.filter((task) => task.priority === 'medium').length;
  const lowCount = sortedTasks.filter((task) => task.priority === 'low').length;

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="inline-flex rounded-md bg-[#e4f7ed] px-3 py-1 text-xs font-semibold text-[var(--accent)]">Portfolio</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#171d1c]">{t('title')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t('subtitle')}</p>
        </div>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--line)] bg-white px-5 text-sm font-semibold shadow-sm hover:bg-[#f5faf8]" href={localizedPath(locale, '/reminders')}>
          {t('openReminders')}
        </Link>
      </div>

      {leasesError ? <StatusBanner text={t('loadFailed')} /> : null}

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <MetricCard label={t('metrics.total')} value={sortedTasks.length.toString()} />
        <MetricCard label={t('metrics.high')} tone={highCount ? 'danger' : 'neutral'} value={highCount.toString()} />
        <MetricCard label={t('metrics.medium')} tone={mediumCount ? 'warning' : 'neutral'} value={mediumCount.toString()} />
        <MetricCard label={t('metrics.low')} value={lowCount.toString()} />
      </section>

      <section className="mt-8 overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white shadow-sm">
        <div className="border-b border-[var(--line-soft)] p-5">
          <h2 className="text-lg font-semibold text-[#171d1c]">{t('listTitle')}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('listCopy')}</p>
        </div>
        <div className="divide-y divide-[var(--line-soft)]">
          {sortedTasks.length ? (
            sortedTasks.map((task) => (
              <TaskRow key={task.id} priorityLabel={t(`priority.${task.priority}`)} task={task} typeLabel={t(`types.${task.type}`)} />
            ))
          ) : (
            <div className="p-8 text-center text-sm text-[var(--muted)]">{t('empty')}</div>
          )}
        </div>
      </section>
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

function StatusBanner({text}: {text: string}) {
  return <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">{text}</div>;
}

function TaskRow({priorityLabel, task, typeLabel}: {priorityLabel: string; task: PortfolioTask; typeLabel: string}) {
  const priorityClass = task.priority === 'high' ? 'bg-[#fdecec] text-[#ba1a1a]' : task.priority === 'medium' ? 'bg-[#fff4de] text-[#9a5a00]' : 'bg-[#e4f7ed] text-[#087a55]';

  return (
    <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${priorityClass}`}>{priorityLabel}</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{typeLabel}</span>
        </div>
        <h3 className="mt-3 text-base font-semibold text-[#171d1c]">{task.title}</h3>
        <p className="mt-1 text-sm leading-6 text-[#33413f]">{task.description}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{task.meta}</p>
      </div>
      <Link className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--line)] px-4 text-sm font-semibold text-[var(--accent)] hover:bg-[#f0f5f2]" href={task.actionHref}>
        {task.actionLabel}
      </Link>
    </div>
  );
}
