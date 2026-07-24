'use client';

import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {useMemo, useState} from 'react';

import {leaseHasOverdueRent} from '@/lib/rent/overdue';

import {deleteTenantAction, updateLeaseReminderAction, updateTenantActiveAction, updateTenantBatchActiveAction} from './actions';
import {DeleteTenantButton} from './delete-tenant-button';
import {TenantActionDetails} from './tenant-action-details';

export type TenantTableRow = {
  id: string;
  email: string | null;
  full_name: string;
  is_active: boolean;
  leases: {
    charges_amount: number;
    end_date: string | null;
    id: string;
    monthly_rent: number;
    properties: {name: string} | null;
    rent_charges: {period_month: string; status: string}[];
    rent_reminder_day: number | null;
    rent_reminder_days_before: number;
    rent_reminder_enabled: boolean;
    start_date: string;
    status: string;
    units: {name: string} | null;
  }[];
  notes: string | null;
  phone: string | null;
};

const MONTH_PARAM_PATTERN = /^\d{4}-\d{2}$/;

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? 'L') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '');
}

function isoMonth(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthStart(month: string) {
  return `${month}-01`;
}

function addMonths(month: string, offset: number) {
  const [year, monthIndex] = month.split('-').map(Number);
  return isoMonth(new Date(Date.UTC(year, monthIndex - 1 + offset, 1)));
}

function formatMonthLabel(month: string, locale: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  const formatted = new Intl.DateTimeFormat(locale, {month: 'long', year: 'numeric'}).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function leaseCoversMonth(lease: TenantTableRow['leases'][number], month: string) {
  const start = monthStart(month);
  const nextMonth = monthStart(addMonths(month, 1));
  return lease.start_date < nextMonth && (!lease.end_date || lease.end_date >= start);
}

function displayLease(tenant: TenantTableRow, month: string) {
  const leasesInMonth = tenant.leases.filter((lease) => leaseCoversMonth(lease, month));
  const nextActiveLease = tenant.leases
    .filter((lease) => lease.status === 'active')
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  return leasesInMonth.find((lease) => lease.status === 'active') ?? leasesInMonth[0] ?? nextActiveLease ?? null;
}

function activeLease(tenant: TenantTableRow, month: string) {
  return tenant.leases.find((lease) => lease.status === 'active' && leaseCoversMonth(lease, month)) ?? null;
}

function hasAssignedLease(tenant: TenantTableRow) {
  return tenant.leases.some((lease) => lease.status === 'active' || lease.status === 'draft');
}

function paymentStatus(lease: TenantTableRow['leases'][number] | null, month: string) {
  if (!lease) {
    return {className: 'bg-[#eef2ff] text-[#3755c3]', labelKey: 'noLease'};
  }

  const charge = lease.rent_charges.find((rentCharge) => rentCharge.period_month === monthStart(month));

  if (!charge) {
    return {className: 'bg-[#eef2ff] text-[#3755c3]', labelKey: lease.status === 'active' ? 'active' : 'raw', rawLabel: lease.status};
  }

  if (charge.status === 'paid') {
    return {className: 'bg-[#ecfdf5] text-[#047857]', labelKey: 'paid'};
  }

  if (charge.status === 'partial') {
    return {className: 'bg-[#fff7ed] text-[#b45309]', labelKey: 'partial'};
  }

  return {className: 'bg-[#fee2e2] text-[#ba1a1a]', labelKey: 'unpaid'};
}

function hasOverdueRent(tenant: TenantTableRow, month: string) {
  const today = new Date().toISOString().slice(0, 10);
  return tenant.leases.some((lease) => leaseHasOverdueRent(lease, month, today));
}

function leaseExpiresSoon(tenant: TenantTableRow, month: string) {
  const lease = activeLease(tenant, month);

  if (!lease?.end_date) {
    return false;
  }

  const start = monthStart(month);
  const limit = monthStart(addMonths(month, 3));
  return lease.end_date >= start && lease.end_date < limit;
}

function tenantMatches(tenant: TenantTableRow, query: string) {
  if (!query) {
    return true;
  }

  const searchable = [tenant.full_name, tenant.email, tenant.phone].filter(Boolean).join(' ').toLowerCase();
  return searchable.includes(query.toLowerCase());
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="m15 18-6-6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function sanitizeMonth(month: string) {
  return MONTH_PARAM_PATTERN.test(month) ? month : isoMonth(new Date());
}

export function TenantTableClient({
  hasPortfolioAccess,
  hasReminderAccess,
  initialMonth,
  initialQuery,
  initialView,
  locale,
  tenants
}: {
  hasPortfolioAccess: boolean;
  hasReminderAccess: boolean;
  initialMonth: string;
  initialQuery: string;
  initialView: string;
  locale: string;
  tenants: TenantTableRow[];
}) {
  const common = useTranslations('common');
  const t = useTranslations('tenants');
  const [selectedMonth, setSelectedMonth] = useState(sanitizeMonth(initialMonth));
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [appliedQuery, setAppliedQuery] = useState(initialQuery);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [pendingBatchOperation, setPendingBatchOperation] = useState<'activate' | 'deactivate' | null>(null);
  const selectedView = initialView;

  const rows = useMemo(() => {
    const activeTenantRows = tenants.filter((tenant) => tenant.is_active);
    const activeRows = activeTenantRows.filter((tenant) => activeLease(tenant, selectedMonth));
    const unassignedRows = activeTenantRows.filter((tenant) => !hasAssignedLease(tenant));
    const expiringRows = activeTenantRows.filter((tenant) => leaseExpiresSoon(tenant, selectedMonth));
    const overdueRows = activeTenantRows.filter((tenant) => hasOverdueRent(tenant, selectedMonth));
    const viewRows =
      selectedView === 'all'
        ? tenants
        : selectedView === 'unassigned'
          ? unassignedRows
          : selectedView === 'expiring'
            ? expiringRows
            : selectedView === 'overdue'
              ? overdueRows
              : activeRows;

    return viewRows.filter((tenant) => tenantMatches(tenant, appliedQuery));
  }, [appliedQuery, selectedMonth, selectedView, tenants]);

  function syncUrl(nextMonth = selectedMonth, nextQuery = appliedQuery) {
    const params = new URLSearchParams({month: nextMonth, view: selectedView});

    if (nextQuery) {
      params.set('q', nextQuery);
    }

    window.history.replaceState(null, '', `/${locale}/tenants?${params.toString()}`);
  }

  function changeMonth(nextMonth: string) {
    setSelectedMonth(nextMonth);
    syncUrl(nextMonth, appliedQuery);
  }

  function applySearch() {
    const nextQuery = queryInput.trim();
    setAppliedQuery(nextQuery);
    syncUrl(selectedMonth, nextQuery);
  }

  function clearSearch() {
    setQueryInput('');
    setAppliedQuery('');
    syncUrl(selectedMonth, '');
  }

  const visibleTenantIds = rows.map((tenant) => tenant.id);
  const allVisibleSelected = visibleTenantIds.length > 0 && visibleTenantIds.every((id) => selectedTenantIds.includes(id));

  function toggleAllVisible() {
    setSelectedTenantIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleTenantIds.includes(id));
      }

      return [...new Set([...current, ...visibleTenantIds])];
    });
  }

  function toggleTenant(id: string) {
    setSelectedTenantIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <section className="mt-6 overflow-visible rounded-lg border border-[var(--line-soft)] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--line-soft)] p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <button aria-label={t('previousMonth')} className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md text-[#33413f] hover:bg-[#f0f5f2]" onClick={() => changeMonth(addMonths(selectedMonth, -1))} type="button">
            <ChevronLeftIcon />
          </button>
          <div className="min-w-32 text-center text-sm font-semibold text-[#171d1c]">{formatMonthLabel(selectedMonth, locale)}</div>
          <button aria-label={t('nextMonth')} className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md text-[#33413f] hover:bg-[#f0f5f2]" onClick={() => changeMonth(addMonths(selectedMonth, 1))} type="button">
            <ChevronRightIcon />
          </button>
        </div>
        <form
          className="relative w-full md:w-72"
          onSubmit={(event) => {
            event.preventDefault();
            applySearch();
          }}
        >
          <input className="focus-ring min-h-11 w-full rounded-full border border-transparent bg-[#eef2f7] px-4 pr-11 text-sm" onChange={(event) => setQueryInput(event.target.value)} placeholder={t('searchPlaceholder')} value={queryInput} />
          {queryInput ? (
            <button aria-label={common('clearSearch')} className="focus-ring absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#33413f] hover:bg-[#dce3eb]" onClick={clearSearch} type="button">
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          ) : null}
        </form>
      </div>

      {hasPortfolioAccess ? (
        <div className="flex flex-col gap-3 border-b border-[var(--line-soft)] bg-[#f8fbfa] px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#171d1c]">{t('batch.title')}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{t('batch.selected', {count: selectedTenantIds.length})}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex min-h-10 items-center rounded-md border border-[var(--line)] px-3 text-sm font-semibold hover:bg-white" href={`/${locale}/reminders`}>
              {t('batch.manageReminders')}
            </Link>
            <button className="min-h-10 rounded-md border border-[var(--line)] px-3 text-sm font-semibold hover:bg-white disabled:opacity-50" disabled={!selectedTenantIds.length} onClick={() => setPendingBatchOperation('activate')} type="button">
              {t('batch.activate')}
            </button>
            <button className="min-h-10 rounded-md border border-[#e7b9b5] px-3 text-sm font-semibold text-[#9d2424] hover:bg-[#fff5f4] disabled:opacity-50" disabled={!selectedTenantIds.length} onClick={() => setPendingBatchOperation('deactivate')} type="button">
              {t('batch.deactivate')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full min-w-[1020px] border-collapse text-left">
          <thead className="border-b border-[var(--line-soft)] bg-[#eaefed] text-[11px] font-semibold uppercase text-[var(--muted)]">
            <tr>
              {hasPortfolioAccess ? (
                <th className="px-5 py-4">
                  <button className="focus-ring rounded px-2 py-1 hover:bg-white" onClick={toggleAllVisible} type="button">
                    {allVisibleSelected ? t('batch.clearAll') : t('batch.selectAll')}
                  </button>
                </th>
              ) : null}
              <th className="px-5 py-4">{t('table.name')}</th>
              <th className="px-5 py-4">{t('table.property')}</th>
              <th className="px-5 py-4">{t('table.startDate')}</th>
              <th className="px-5 py-4">{t('table.endDate')}</th>
              <th className="px-5 py-4">{t('reminders.column')}</th>
              <th className="px-5 py-4">{common('status')}</th>
              <th className="px-5 py-4 text-right">{common('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line-soft)]">
            {rows.length ? (
              rows.map((tenant) => {
                const lease = displayLease(tenant, selectedMonth);
                const hasLease = Boolean(lease);
                const status = tenant.is_active ? paymentStatus(lease, selectedMonth) : {className: 'bg-[#e5e7eb] text-[#4b5563]', labelKey: 'disabled'};

                return (
                  <tr className="transition hover:bg-[#f0f5f2]" key={tenant.id}>
                    {hasPortfolioAccess ? (
                      <td className="px-5 py-4">
                        <input checked={selectedTenantIds.includes(tenant.id)} className="h-4 w-4 accent-[var(--accent)]" onChange={() => toggleTenant(tenant.id)} type="checkbox" />
                      </td>
                    ) : null}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dde1ff] text-sm font-bold uppercase text-[#3755c3]">{initials(tenant.full_name)}</div>
                        <div>
                          <Link className="font-semibold hover:text-[var(--accent)]" href={`/tenants/${tenant.id}`}>
                            {tenant.full_name}
                          </Link>
                          <p className="mt-1 text-sm text-[var(--muted)]">{tenant.email ?? tenant.phone ?? t('contactMissing')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <p>{lease?.properties?.name ?? '-'}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{lease?.units?.name ?? ''}</p>
                    </td>
                    <td className="px-5 py-4 text-sm tabular-nums">{lease?.start_date ?? '-'}</td>
                    <td className="px-5 py-4 text-sm tabular-nums">{lease?.end_date ?? '-'}</td>
                    <td className="px-5 py-4">
                      <ReminderSwitch
                        enabled={Boolean(lease?.rent_reminder_enabled)}
                        hasAccess={hasReminderAccess}
                        leaseId={lease?.id ?? null}
                        locale={locale}
                        month={selectedMonth}
                        query={appliedQuery}
                        reminderDay={lease?.rent_reminder_day ?? null}
                        setShowUpgrade={setShowUpgrade}
                        view={selectedView}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.labelKey === 'raw' ? status.rawLabel : t(`paymentStatus.${status.labelKey}`)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <TenantActionDetails>
                        <Link className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={`/tenants/${tenant.id}`}>
                          {common('view')}
                        </Link>
                        <Link className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={`/tenants/${tenant.id}/edit`}>
                          {common('edit')}
                        </Link>
                        {hasLease ? (
                          <Link className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={`/transactions?new=transaction&tenant_id=${tenant.id}`}>
                            {t('actions.transaction')}
                          </Link>
                        ) : (
                          <Link className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={`/bail/new?tenant_id=${tenant.id}`}>
                            {t('actions.createLease')}
                          </Link>
                        )}
                        <form action={updateTenantActiveAction}>
                          <input name="locale" type="hidden" value={locale} />
                          <input name="tenant_id" type="hidden" value={tenant.id} />
                          <input name="is_active" type="hidden" value={tenant.is_active ? 'false' : 'true'} />
                          <input name="month" type="hidden" value={selectedMonth} />
                          <input name="view" type="hidden" value={selectedView} />
                          <input name="q" type="hidden" value={appliedQuery} />
                          <button className="block w-full rounded-md px-3 py-2 text-left hover:bg-[#f0f5f2]" type="submit">
                            {tenant.is_active ? t('actions.deactivate') : t('actions.activate')}
                          </button>
                        </form>
                        <form action={deleteTenantAction}>
                          <input name="locale" type="hidden" value={locale} />
                          <input name="tenant_id" type="hidden" value={tenant.id} />
                          <DeleteTenantButton />
                        </form>
                      </TenantActionDetails>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-5 py-10 text-center text-sm text-[var(--muted)]" colSpan={hasPortfolioAccess ? 8 : 7}>
                  {t('empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[var(--line-soft)] px-5 py-4 text-sm text-[var(--muted)]">
        {t('pagination', {range: rows.length ? `1-${rows.length}` : '0', count: rows.length})}
      </div>
      {showUpgrade ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-6 text-[#17201e] shadow-2xl">
            <div>
              <h2 className="text-xl font-semibold">{t('reminders.upgradeTitle')}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t('reminders.upgradeCopy')}</p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button className="min-h-10 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f0f5f2]" onClick={() => setShowUpgrade(false)} type="button">
                {t('reminders.upgradeLater')}
              </button>
              <Link className="inline-flex min-h-10 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white" href={`/${locale}/settings?tab=abonnement`} style={{color: '#ffffff'}}>
                {t('reminders.upgradeAction')}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      {pendingBatchOperation ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-6 text-[#17201e] shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{t(`batch.confirm.${pendingBatchOperation}.title`)}</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t(`batch.confirm.${pendingBatchOperation}.copy`, {count: selectedTenantIds.length})}</p>
              </div>
              <button aria-label={common('close')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#17201e] text-xl leading-none hover:bg-[#f0f5f2]" onClick={() => setPendingBatchOperation(null)} type="button">
                x
              </button>
            </div>
            <form action={updateTenantBatchActiveAction} className="mt-6 flex justify-end gap-3">
              <input name="locale" type="hidden" value={locale} />
              <input name="operation" type="hidden" value={pendingBatchOperation} />
              {selectedTenantIds.map((id) => <input key={id} name="tenant_ids" type="hidden" value={id} />)}
              <button className="min-h-10 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold" onClick={() => setPendingBatchOperation(null)} type="button">{common('cancel')}</button>
              <button className="min-h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white" style={{color: '#ffffff'}} type="submit">{common('confirm')}</button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReminderSwitch({
  enabled,
  hasAccess,
  leaseId,
  locale,
  month,
  query,
  reminderDay,
  setShowUpgrade,
  view
}: {
  enabled: boolean;
  hasAccess: boolean;
  leaseId: string | null;
  locale: string;
  month: string;
  query: string;
  reminderDay: number | null;
  setShowUpgrade: (value: boolean) => void;
  view: string;
}) {
  const t = useTranslations('tenants');

  if (!leaseId) {
    return <span className="text-sm text-[var(--muted)]">-</span>;
  }

  const label = enabled ? t('reminders.enabledWithDay', {day: reminderDay ?? '-'}) : t('reminders.disabled');

  if (!hasAccess) {
    return (
      <button
        aria-label={t('reminders.upgradeTitle')}
        className="focus-ring inline-flex items-center gap-2 rounded-full bg-[#e5e7eb] px-1 py-1 text-xs font-semibold text-[#4b5563]"
        onClick={() => setShowUpgrade(true)}
        title={t('reminders.lockedTooltip')}
        type="button"
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[var(--muted)]">
          <span className="material-symbols-outlined text-[15px]">lock</span>
        </span>
        <span className="pr-2">{t('reminders.locked')}</span>
      </button>
    );
  }

  return (
    <form action={updateLeaseReminderAction}>
      <input name="locale" type="hidden" value={locale} />
      <input name="lease_id" type="hidden" value={leaseId} />
      <input name="enabled" type="hidden" value={enabled ? 'false' : 'true'} />
      <input name="month" type="hidden" value={month} />
      <input name="view" type="hidden" value={view} />
      <input name="q" type="hidden" value={query} />
      <button
        aria-label={label}
        className={[
          'focus-ring inline-flex h-7 w-12 items-center rounded-full px-1 transition',
          enabled ? 'justify-end bg-[var(--accent)]' : 'justify-start bg-[#d1d5db]'
        ].join(' ')}
        title={label}
        type="submit"
      >
        <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
      </button>
    </form>
  );
}
