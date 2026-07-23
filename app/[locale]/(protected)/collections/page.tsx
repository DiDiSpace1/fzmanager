import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {localizedPath} from '@/lib/navigation';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {CollectionSelectionControls} from './collection-selection-controls';
import {CollectionRowActions} from './collection-row-actions';
import {CollectionSubmitConfirmation} from './collection-submit-confirmation';
import {updateCollectionsAction} from './actions';

type Relation<T> = T | T[] | null;

type LeaseRow = {
  charges_amount: number | null;
  end_date: string | null;
  id: string;
  monthly_rent: number | null;
  properties: Relation<{name: string}>;
  rent_charges: {
    period_month: string;
    rent_payments: {amount: number | null; notes: string | null}[];
    status: string;
    total_due: number | null;
  }[];
  start_date: string;
  tenant_id: string | null;
  tenants: Relation<{full_name: string}>;
  units: Relation<{name: string | null}>;
};

type CollectionsPageProps = {
  searchParams: Promise<{
    collection_error?: string;
    collection_success?: string;
    month?: string;
    receipts?: string;
    skipped?: string;
    skipped_existing_paid?: string;
    skipped_invalid_amount?: string;
    skipped_save_failed?: string;
    skipped_zero_amount?: string;
    updated?: string;
    view?: string;
  }>;
};

const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const COLLECTION_FORM_ID = 'portfolio-collections-form';
const COLLECTION_VIEWS = ['all', 'open', 'unpaid', 'partial', 'paid'] as const;

type CollectionView = (typeof COLLECTION_VIEWS)[number];
type CollectionStatus = 'paid' | 'partial' | 'unpaid';

function relationOne<T>(value: Relation<T>) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function currentMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthStart(month: string) {
  return `${month}-01`;
}

function addMonths(month: string, offset: number) {
  const [year, monthIndex] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, monthIndex - 1 + offset, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

function selectedMonth(value?: string) {
  return value && MONTH_PATTERN.test(value) ? value : currentMonth();
}

function selectedView(value?: string): CollectionView {
  return COLLECTION_VIEWS.includes(value as CollectionView) ? (value as CollectionView) : 'all';
}

function collectionStatus(value: string | undefined): CollectionStatus {
  return value === 'paid' || value === 'partial' ? value : 'unpaid';
}

function viewHref(locale: string, month: string, view: CollectionView) {
  const query = new URLSearchParams({month, view});
  return `${localizedPath(locale, '/collections')}?${query.toString()}`;
}

function exportHref(locale: string, month: string, view: CollectionView) {
  const query = new URLSearchParams({locale, month, view});
  return `/api/collections/export?${query.toString()}`;
}

function leaseCoversMonth(lease: LeaseRow, month: string) {
  const start = monthStart(month);
  const nextMonth = monthStart(addMonths(month, 1));
  return lease.start_date < nextMonth && (!lease.end_date || lease.end_date >= start);
}

function isRentPayment(payment: {notes: string | null}) {
  return !payment.notes?.startsWith('[[loyelio:revenue_type=deposit]]') && !payment.notes?.startsWith('[[loyelio:revenue_type=other]]');
}

function formatMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {currency: 'EUR', maximumFractionDigits: 0, style: 'currency'}).format(value);
}

function statusTone(status: string) {
  if (status === 'paid') {
    return 'bg-[#e4f7ed] text-[#087a55]';
  }

  if (status === 'partial') {
    return 'bg-[#fff4db] text-[#9a5a00]';
  }

  return 'bg-[#fdecec] text-[#ba1a1a]';
}

function countParam(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export default async function CollectionsPage({searchParams}: CollectionsPageProps) {
  const t = await getTranslations('collections');
  const locale = await getLocale();
  const params = await searchParams;
  const month = selectedMonth(params.month);
  const view = selectedView(params.view);
  const periodMonth = monthStart(month);
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
    .select('id, tenant_id, start_date, end_date, monthly_rent, charges_amount, tenants(full_name), properties(name), units(name), rent_charges(period_month, status, total_due, rent_payments(amount, notes))')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .order('start_date', {ascending: true})
    .returns<LeaseRow[]>();

  const rows = (leases ?? [])
    .filter((lease) => leaseCoversMonth(lease, month))
    .map((lease) => {
      const rentAmount = Number(lease.monthly_rent ?? 0);
      const chargesAmount = Number(lease.charges_amount ?? 0);
      const totalDue = rentAmount + chargesAmount;
      const charge = lease.rent_charges.find((row) => row.period_month === periodMonth) ?? null;
      const paid = (charge?.rent_payments ?? []).filter(isRentPayment).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
      const status = collectionStatus(charge?.status);
      return {
        charge,
        chargesAmount,
        lease,
        paid,
        remaining: Math.max(0, totalDue - paid),
        rentAmount,
        status,
        totalDue
      };
    });

  const paidCount = rows.filter((row) => row.status === 'paid').length;
  const partialCount = rows.filter((row) => row.status === 'partial').length;
  const unpaidCount = rows.length - paidCount - partialCount;
  const expectedTotal = rows.reduce((sum, row) => sum + row.totalDue, 0);
  const collectedTotal = rows.reduce((sum, row) => sum + row.paid, 0);
  const visibleRows = rows.filter((row) => {
    if (view === 'open') {
      return row.status !== 'paid';
    }

    return view === 'all' || row.status === view;
  });
  const defaultPaidAt = new Date().toISOString().slice(0, 10);
  const initialSelected = visibleRows.filter((row) => row.status !== 'paid' && row.totalDue > 0).length;
  const success = params.collection_success === 'collections_updated';
  const skippedReasons = [
    {count: countParam(params.skipped_zero_amount), label: t('skipReasons.zeroAmount')},
    {count: countParam(params.skipped_existing_paid), label: t('skipReasons.existingPaid')},
    {count: countParam(params.skipped_invalid_amount), label: t('skipReasons.invalidAmount')},
    {count: countParam(params.skipped_save_failed), label: t('skipReasons.saveFailed')}
  ].filter((reason) => reason.count > 0);
  const errorKey = params.collection_error && ['collections_load_failed', 'collections_missing', 'portfolio_required'].includes(params.collection_error) ? params.collection_error : null;

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="inline-flex rounded-md bg-[#e4f7ed] px-3 py-1 text-xs font-semibold text-[var(--accent)]">Portfolio</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#171d1c]">{t('title')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <input name="view" type="hidden" value={view} />
            <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t('month')}
              <input className="focus-ring min-h-11 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[#171d1c]" defaultValue={month} name="month" type="month" />
            </label>
            <button className="focus-ring min-h-11 rounded-lg border border-[var(--line)] bg-white px-5 text-sm font-semibold hover:bg-[#f5faf8]" type="submit">
              {t('refresh')}
            </button>
          </form>
          <Link className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-5 text-sm font-semibold hover:bg-[#f5faf8]" href={exportHref(locale, month, view)}>
            <span className="material-symbols-outlined text-[20px]">download</span>
            {t('export')}
          </Link>
        </div>
      </div>

      {success ? (
        <div className="mt-6 rounded-lg border border-[#b8e5cf] bg-[#edf8f1] p-4 text-sm leading-6 text-[#087a55]">
          <p>{t('success', {receipts: Number(params.receipts ?? 0), skipped: Number(params.skipped ?? 0), updated: Number(params.updated ?? 0)})}</p>
          {skippedReasons.length ? (
            <ul className="mt-2 grid gap-1 text-xs leading-5 text-[#245449]">
              {skippedReasons.map((reason) => (
                <li key={reason.label}>{t('skipReasonLine', {count: reason.count, reason: reason.label})}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {error || errorKey ? (
        <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          {error ? t('errors.loadFailed') : t(`errors.${errorKey}`)}
        </div>
      ) : null}

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <MetricCard label={t('metrics.expected')} value={formatMoney(expectedTotal, locale)} />
        <MetricCard label={t('metrics.collected')} tone="accent" value={formatMoney(collectedTotal, locale)} />
        <MetricCard label={t('metrics.paid')} value={paidCount.toString()} />
        <MetricCard label={t('metrics.toFollow')} tone={unpaidCount + partialCount > 0 ? 'danger' : 'neutral'} value={(unpaidCount + partialCount).toString()} />
      </section>

      <nav aria-label={t('views.label')} className="mt-6 flex flex-wrap gap-2">
        {COLLECTION_VIEWS.map((viewKey) => {
          const active = view === viewKey;
          const count =
            viewKey === 'all'
              ? rows.length
              : viewKey === 'open'
                ? unpaidCount + partialCount
                : viewKey === 'paid'
                  ? paidCount
                  : viewKey === 'partial'
                    ? partialCount
                    : unpaidCount;

          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={`focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold ${
                active ? 'border-[var(--accent)] bg-[#e8f5f1] text-[var(--accent)]' : 'border-[var(--line)] bg-white text-[#34413e] hover:bg-[#f5faf8]'
              }`}
              href={viewHref(locale, month, viewKey)}
              key={viewKey}
            >
              {t(`views.${viewKey}`)}
              <span className={`tabular-nums ${active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>{count}</span>
            </Link>
          );
        })}
      </nav>

      <form action={updateCollectionsAction} className="mt-8 overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white shadow-sm" id={COLLECTION_FORM_ID}>
        <input name="locale" type="hidden" value={locale} />
        <input name="month" type="hidden" value={month} />
        <input name="view" type="hidden" value={view} />
        <div className="grid gap-4 border-b border-[var(--line-soft)] p-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h2 className="text-lg font-semibold text-[#171d1c]">{t('tableTitle')}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('tableCopy')}</p>
            {visibleRows.length ? (
              <div className="mt-4">
                <CollectionSelectionControls
                  formId={COLLECTION_FORM_ID}
                  initialSelected={initialSelected}
                  labels={{
                    clear: t('selection.clear'),
                    onlyOpen: t('selection.onlyOpen'),
                    selectAll: t('selection.selectAll'),
                    selected: t('selection.selected')
                  }}
                  total={visibleRows.length}
                />
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[150px_150px_160px_auto]">
            <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t('bulkStatus')}
              <select className="focus-ring min-h-11 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[#171d1c]" name="status">
                <option value="paid">{t('status.paid')}</option>
                <option value="partial">{t('status.partial')}</option>
                <option value="unpaid">{t('status.unpaid')}</option>
              </select>
            </label>
            <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t('paidAt')}
              <input className="focus-ring min-h-11 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[#171d1c]" defaultValue={defaultPaidAt} name="paid_at" type="date" />
            </label>
            <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t('paymentMethod')}
              <select className="focus-ring min-h-11 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[#171d1c]" name="payment_method">
                <option value="bank_transfer">{t('methods.bank_transfer')}</option>
                <option value="cash">{t('methods.cash')}</option>
                <option value="cheque">{t('methods.cheque')}</option>
                <option value="card">{t('methods.card')}</option>
                <option value="other">{t('methods.other')}</option>
              </select>
            </label>
            <CollectionSubmitConfirmation
              formId={COLLECTION_FORM_ID}
              initialSelected={initialSelected}
              labels={{
                apply: t('apply'),
                cancel: t('confirm.cancel'),
                confirm: t('confirm.confirm'),
                copy: t('confirm.copy'),
                noSelection: t('confirm.noSelection'),
                paymentDate: t('confirm.paymentDate'),
                receiptWarning: t('confirm.receiptWarning'),
                selectedCount: t('confirm.selectedCount'),
                targetStatus: t('confirm.targetStatus'),
                title: t('confirm.title')
              }}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1040px] w-full text-left text-sm">
            <thead className="bg-[#f8fbfa] text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="w-12 px-5 py-3">{t('columns.select')}</th>
                <th className="px-4 py-3">{t('columns.tenant')}</th>
                <th className="px-4 py-3">{t('columns.property')}</th>
                <th className="px-4 py-3 text-right">{t('columns.rent')}</th>
                <th className="px-4 py-3 text-right">{t('columns.charges')}</th>
                <th className="px-4 py-3 text-right">{t('columns.total')}</th>
                <th className="px-4 py-3 text-right">{t('columns.paid')}</th>
                <th className="px-4 py-3">{t('columns.partialAmount')}</th>
                <th className="px-5 py-3">{t('columns.status')}</th>
                <th className="px-5 py-3 text-right">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-soft)]">
              {visibleRows.length ? (
                visibleRows.map((row) => {
                  const tenant = relationOne(row.lease.tenants);
                  const property = relationOne(row.lease.properties);
                  const unit = relationOne(row.lease.units);
                  const defaultChecked = row.status !== 'paid' && row.totalDue > 0;
                  const tenantName = tenant?.full_name ?? t('unknownTenant');

                  return (
                    <tr className="align-middle hover:bg-[#fbfdfc]" key={row.lease.id}>
                      <td className="px-5 py-4">
                        <input aria-label={t('columns.select')} className="h-4 w-4 accent-[var(--accent)]" data-collection-status={row.status} defaultChecked={defaultChecked} name="lease_ids" type="checkbox" value={row.lease.id} />
                      </td>
                      <td className="px-4 py-4 font-semibold text-[#171d1c]">{tenantName}</td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-[#171d1c]">{property?.name ?? t('unknownProperty')}</div>
                        {unit?.name ? <div className="text-xs text-[var(--muted)]">{unit.name}</div> : null}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums">{formatMoney(row.rentAmount, locale)}</td>
                      <td className="px-4 py-4 text-right tabular-nums">{formatMoney(row.chargesAmount, locale)}</td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums">{formatMoney(row.totalDue, locale)}</td>
                      <td className="px-4 py-4 text-right tabular-nums text-[var(--accent)]">{formatMoney(row.paid, locale)}</td>
                      <td className="px-4 py-4">
                        <input className="focus-ring min-h-10 w-28 rounded-md border border-[var(--line)] px-3 text-sm tabular-nums" defaultValue={row.remaining || row.totalDue} min="0" name={`amount_${row.lease.id}`} step="0.01" type="number" />
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${statusTone(row.status)}`}>{t(`status.${row.status === 'paid' || row.status === 'partial' ? row.status : 'unpaid'}`)}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <CollectionRowActions
                          currentStatus={row.status}
                          labels={{
                            cancel: t('rowAction.cancel'),
                            confirm: t('rowAction.confirm'),
                            copy: t('rowAction.copy', {tenant: tenantName}),
                            open: t('rowAction.open'),
                            partialAmount: t('columns.partialAmount'),
                            partialNote: t('rowAction.partialNote'),
                            receiptWarning: t('rowAction.receiptWarning'),
                            statuses: {
                              paid: t('status.paid'),
                              partial: t('status.partial'),
                              unpaid: t('status.unpaid')
                            },
                            title: t('rowAction.title')
                          }}
                          leaseId={row.lease.id}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-[var(--muted)]" colSpan={10}>
                    {rows.length ? t('emptyFiltered') : t('empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </form>
    </>
  );
}

function MetricCard({label, tone = 'neutral', value}: {label: string; tone?: 'accent' | 'danger' | 'neutral'; value: string}) {
  const toneClass = tone === 'accent' ? 'text-[var(--accent)]' : tone === 'danger' ? 'text-[#ba1a1a]' : 'text-[#171d1c]';

  return (
    <div className="rounded-xl border border-[var(--line-soft)] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className={`mt-3 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}
