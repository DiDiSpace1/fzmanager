'use client';

import Link from 'next/link';
import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';

import {updateReminderCenterAction} from './actions';

export type ReminderCenterRow = {
  daysBefore: number;
  enabled: boolean;
  errorMessage: string | null;
  id: string;
  lastSentAt: string | null;
  latestStatus: string | null;
  nextReminderAt: string | null;
  propertyLabel: string;
  reminderDay: number | null;
  tenantEmail: string | null;
  tenantId: string;
  tenantName: string;
};

function formatDate(value: string | null, locale: string) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeZone: 'UTC'}).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateTime(value: string | null, locale: string) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(value));
}

export function ReminderCenterClient({locale, rows}: {locale: string; rows: ReminderCenterRow[]}) {
  const t = useTranslations('reminders');
  const common = useTranslations('common');
  const [selectedIds, setSelectedIds] = useState<string[]>(rows.map((row) => row.id));
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.includes(row.id)), [rows, selectedIds]);

  function toggleAll() {
    setSelectedIds(allSelected ? [] : rows.map((row) => row.id));
  }

  function toggleRow(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <section className="mt-8 overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white shadow-sm">
      <div className="border-b border-[var(--line-soft)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t('tableTitle')}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('selectedSummary', {count: selectedIds.length})}</p>
          </div>
          <form action={updateReminderCenterAction} className="flex flex-wrap items-end gap-3">
            <input name="locale" type="hidden" value={locale} />
            {selectedIds.map((id) => (
              <input key={id} name="lease_ids" type="hidden" value={id} />
            ))}
            <label className="grid gap-1 text-xs font-semibold text-[#33413f]">
              {t('bulkDay')}
              <select className="focus-ring min-h-10 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="rent_reminder_day" defaultValue="1">
                {Array.from({length: 31}, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day}>
                    {t('dayOption', {day})}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[#33413f]">
              {t('bulkLeadTime')}
              <select className="focus-ring min-h-10 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="rent_reminder_days_before" defaultValue="0">
                {[0, 1, 3, 7].map((days) => (
                  <option key={days} value={days}>
                    {t('daysBeforeOption', {days})}
                  </option>
                ))}
              </select>
            </label>
            <button className="focus-ring min-h-10 rounded-md border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f0f5f2]" disabled={!selectedIds.length} name="operation" type="submit" value="update_settings">
              {t('applySettings')}
            </button>
            <button className="focus-ring min-h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={!selectedIds.length} name="operation" style={{color: '#ffffff'}} type="submit" value="enable">
              {t('enableSelected')}
            </button>
            <button className="focus-ring min-h-10 rounded-md border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f0f5f2]" disabled={!selectedIds.length} name="operation" type="submit" value="disable">
              {t('disableSelected')}
            </button>
          </form>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1060px] border-collapse text-left">
          <thead className="border-b border-[var(--line-soft)] bg-[#eaefed] text-[11px] font-semibold uppercase text-[var(--muted)]">
            <tr>
              <th className="px-5 py-4">
                <button className="focus-ring rounded px-2 py-1 hover:bg-white" onClick={toggleAll} type="button">
                  {allSelected ? t('clearSelection') : t('selectAll')}
                </button>
              </th>
              <th className="px-5 py-4">{t('tenant')}</th>
              <th className="px-5 py-4">{t('property')}</th>
              <th className="px-5 py-4">{t('paymentDay')}</th>
              <th className="px-5 py-4">{t('status')}</th>
              <th className="px-5 py-4">{t('nextReminder')}</th>
              <th className="px-5 py-4">{t('lastSend')}</th>
              <th className="px-5 py-4 text-right">{common('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line-soft)]">
            {rows.length ? (
              rows.map((row) => (
                <tr className="transition hover:bg-[#f8fbfa]" key={row.id}>
                  <td className="px-5 py-4">
                    <input checked={selectedIds.includes(row.id)} className="h-4 w-4 accent-[var(--accent)]" onChange={() => toggleRow(row.id)} type="checkbox" />
                  </td>
                  <td className="px-5 py-4">
                    <Link className="font-semibold hover:text-[var(--accent)]" href={`/${locale}/tenants/${row.tenantId}`}>
                      {row.tenantName}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted)]">{row.tenantEmail ?? t('missingEmail')}</p>
                  </td>
                  <td className="px-5 py-4 text-sm">{row.propertyLabel}</td>
                  <td className="px-5 py-4 text-sm">
                    <p>{row.reminderDay ? t('dayOption', {day: row.reminderDay}) : '-'}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{t('daysBeforeOption', {days: row.daysBefore})}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={['inline-flex rounded-md px-2.5 py-1 text-xs font-semibold', row.enabled ? 'bg-[#e4f7ed] text-[#087a55]' : 'bg-[#e5e7eb] text-[#4b5563]'].join(' ')}>
                      {row.enabled ? t('enabled') : t('disabled')}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm tabular-nums">{formatDate(row.nextReminderAt, locale)}</td>
                  <td className="px-5 py-4 text-sm">
                    <p className="tabular-nums">{formatDateTime(row.lastSentAt, locale)}</p>
                    {row.latestStatus ? (
                      <p className={['mt-1 text-xs', row.latestStatus === 'failed' ? 'text-[#ba1a1a]' : 'text-[var(--muted)]'].join(' ')}>
                        {row.latestStatus === 'failed' ? row.errorMessage || t('failed') : t('sent')}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link className="text-sm font-semibold text-[var(--accent)]" href={`/${locale}/tenants/${row.tenantId}/edit`}>
                      {common('edit')}
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-5 py-10 text-center text-sm text-[var(--muted)]" colSpan={8}>
                  {t('empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[var(--line-soft)] px-5 py-4 text-sm text-[var(--muted)]">{t('footerSummary', {count: rows.length, selected: selectedRows.length})}</div>
    </section>
  );
}
