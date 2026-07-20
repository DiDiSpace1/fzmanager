'use client';

import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';

import {TransactionActionsMenu, type TransactionActionOption, type TransactionActionRow} from './transaction-actions-menu';

export type TransactionFilter = 'deposit' | 'expense' | 'income';

export type TransactionStat = {
  filter: TransactionFilter;
  icon: string;
  label: string;
  note: string;
  tone: 'deposit' | 'expense' | 'revenue';
  value: string;
};

export type TransactionOverviewRow = {
  amount: number;
  category: string;
  date: string;
  description?: string | null;
  filter: TransactionFilter;
  id: string;
  meta: string;
  notes?: string | null;
  paymentMethod?: string | null;
  propertyId?: string | null;
  revenueType?: string | null;
  status: string;
  taxCategoryId?: string | null;
  type: 'expense' | 'revenue';
  vendor?: string | null;
};

function Icon({children, className = ''}: {children: string; className?: string}) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function formatMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: 'EUR',
    style: 'currency'
  }).format(value);
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(value));
}

function StatCard({active, stat, onClick}: {active: boolean; stat: TransactionStat; onClick: () => void}) {
  const tones = {
    deposit: {
      icon: 'bg-[#eef2ff] text-[#3755c3]',
      value: 'text-[#3755c3]'
    },
    expense: {
      icon: 'bg-[#ffdbce] text-[#924628]',
      value: 'text-[#924628]'
    },
    revenue: {
      icon: 'bg-[#d9fbf4] text-[var(--accent)]',
      value: 'text-[var(--accent)]'
    }
  };

  return (
    <button
      className={`focus-ring rounded-xl border bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md ${active ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/15' : 'border-[var(--line-soft)]'}`}
      onClick={onClick}
      type="button"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tones[stat.tone].icon}`}>
          <Icon>{stat.icon}</Icon>
        </div>
      </div>
      <p className="text-sm font-semibold text-[#3d4947]">{stat.label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tones[stat.tone].value}`}>{stat.value}</p>
      <p className="mt-3 text-sm font-medium text-[#3d4947]">{stat.note}</p>
    </button>
  );
}

export function TransactionsOverview({
  initialViewId,
  locale,
  properties,
  rows,
  stats,
  taxCategories
}: {
  initialViewId?: string;
  locale: string;
  properties: TransactionActionOption[];
  rows: TransactionOverviewRow[];
  stats: TransactionStat[];
  taxCategories: TransactionActionOption[];
}) {
  const t = useTranslations('transactions');
  const [activeFilter, setActiveFilter] = useState<TransactionFilter | null>(null);
  const [query, setQuery] = useState('');
  const selectedStat = stats.find((stat) => stat.filter === activeFilter);
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesFilter = activeFilter ? row.filter === activeFilter : true;
      const haystack = [row.category, row.meta, row.notes, row.description, row.vendor, row.status, formatMoney(row.amount, locale), formatDate(row.date, locale)]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();

      return matchesFilter && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [activeFilter, locale, normalizedQuery, rows]);

  return (
    <>
      <section className="mt-8 grid gap-5 md:grid-cols-3">
        {stats.map((stat) => (
          <StatCard active={activeFilter === stat.filter} key={stat.filter} stat={stat} onClick={() => setActiveFilter(stat.filter)} />
        ))}
      </section>

      <section className="mt-8 overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[var(--line-soft)] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-[#171d1c]">{selectedStat?.label ?? t('recentHistory')}</h2>
            {selectedStat ? (
              <button className="text-lg font-semibold text-[#171d1c] underline underline-offset-4" onClick={() => setActiveFilter(null)} type="button">
                ({t('reset')})
              </button>
            ) : null}
            <span className="text-sm text-[var(--muted)]">{t('movementCount', {count: filteredRows.length})}</span>
          </div>

          <label className="focus-within:ring-2 focus-within:ring-[var(--accent)] flex min-h-11 w-full max-w-sm items-center gap-3 rounded-full border border-[var(--line)] bg-[#eef2f0] px-4 text-sm text-[#171d1c]">
            <Icon className="text-[20px] text-[#3d4947]">search</Icon>
            <input
              className="min-w-0 flex-1 border-0 bg-transparent outline-none placeholder:text-[#6b7775]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              value={query}
            />
            {query ? (
              <button aria-label={t('clearSearch')} className="grid h-7 w-7 place-items-center rounded-full text-[#3d4947] hover:bg-white/70" onClick={() => setQuery('')} type="button">
                <Icon className="text-[20px]">close</Icon>
              </button>
            ) : null}
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-[#f0f5f2] text-xs font-semibold uppercase text-[#3d4947]">
              <tr>
                <th className="px-6 py-3">{t('date')}</th>
                <th className="px-6 py-3">{t('category')}</th>
                <th className="px-6 py-3">{t('propertyTenant')}</th>
                <th className="px-6 py-3 text-right">{t('amount')}</th>
                <th className="px-6 py-3 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-soft)]">
              {filteredRows.length ? (
                filteredRows.map((row) => {
                  const actionRow: TransactionActionRow = {
                    amount: row.amount,
                    category: row.category,
                    date: row.date,
                    description: row.description,
                    id: row.id,
                    meta: row.meta,
                    notes: row.notes,
                    paymentMethod: row.paymentMethod,
                    propertyId: row.propertyId,
                    revenueType: row.revenueType,
                    taxCategoryId: row.taxCategoryId,
                    type: row.type,
                    vendor: row.vendor
                  };

                  return (
                    <tr className="hover:bg-[#f8fbfa]" key={row.id}>
                      <td className="px-6 py-4 tabular-nums">{formatDate(row.date, locale)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-semibold ${row.type === 'expense' ? 'bg-[#ffdbce] text-[#924628]' : 'bg-[#ecfdf5] text-[var(--accent)]'}`}>
                          <Icon className="text-[15px]">{row.type === 'expense' ? 'receipt_long' : 'payments'}</Icon>
                          {row.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-[#33413f]">{row.meta}</td>
                      <td className={`px-6 py-4 text-right font-semibold tabular-nums ${row.type === 'expense' ? 'text-[#924628]' : 'text-[var(--accent)]'}`}>
                        {row.type === 'expense' ? '- ' : ''}
                        {formatMoney(row.amount, locale)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <TransactionActionsMenu initialViewOpen={row.id === initialViewId} locale={locale} properties={properties} row={actionRow} taxCategories={taxCategories} />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-6 py-12 text-center text-[var(--muted)]" colSpan={5}>
                    {t('noTransactions')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
