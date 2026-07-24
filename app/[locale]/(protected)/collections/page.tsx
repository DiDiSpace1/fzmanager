import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {localizedPath} from '@/lib/navigation';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {CollectionSelectAllCheckbox, CollectionSelectionControls} from './collection-selection-controls';
import {CollectionRowActions} from './collection-row-actions';
import {CollectionSubmitConfirmation} from './collection-submit-confirmation';
import {updateCollectionsAction} from './actions';
import {deleteCollectionViewAction, saveCollectionViewAction} from './saved-view-actions';

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

type CollectionEventRow = {
  actor_user_id: string | null;
  amount_after: number | null;
  amount_before: number | null;
  created_at: string;
  id: string;
  lease_id: string;
  leases: Relation<{
    properties: Relation<{name: string}>;
    tenants: Relation<{full_name: string}>;
  }>;
  new_status: string;
  previous_status: string | null;
  profiles: Relation<{email: string | null; full_name: string | null}>;
  source: string;
};

type SavedViewRow = {
  id: string;
  month: string;
  name: string;
  view: CollectionView;
};

type CollectionsPageProps = {
  searchParams: Promise<{
    collection_error?: string;
    collection_success?: string;
    month?: string;
    receipts?: string;
    result_skipped?: string;
    result_status?: string;
    result_updated_ids?: string;
    saved_view?: string;
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
type SkipReason = 'existingPaid' | 'invalidAmount' | 'saveFailed' | 'zeroAmount';

const SKIP_REASONS: SkipReason[] = ['existingPaid', 'invalidAmount', 'saveFailed', 'zeroAmount'];

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

function reportHref(locale: string, month: string, view: CollectionView) {
  const query = new URLSearchParams({locale, month, view});
  return `/api/collections/report?${query.toString()}`;
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

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(value));
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

function resultIds(value: string | undefined) {
  return [...new Set((value ?? '').split(',').filter(Boolean))];
}

function skippedResult(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => {
      const separator = item.lastIndexOf(':');
      const leaseId = item.slice(0, separator);
      const reason = item.slice(separator + 1) as SkipReason;
      return separator > 0 && SKIP_REASONS.includes(reason) ? {leaseId, reason} : null;
    })
    .filter((item): item is {leaseId: string; reason: SkipReason} => Boolean(item));
}

export default async function CollectionsPage({searchParams}: CollectionsPageProps) {
  const t = await getTranslations('collections');
  const locale = await getLocale();
  const params = await searchParams;
  const month = selectedMonth(params.month);
  const view = selectedView(params.view);
  const periodMonth = monthStart(month);
  const {supabase, user, workspaceId} = await getCurrentUserWorkspace(locale);
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
  const {data: collectionEvents} = await supabase
    .from('rent_collection_events')
    .select('id, lease_id, actor_user_id, source, previous_status, new_status, amount_before, amount_after, created_at, profiles(full_name, email), leases(tenants(full_name), properties(name))')
    .eq('workspace_id', workspaceId)
    .eq('period_month', periodMonth)
    .order('created_at', {ascending: false})
    .limit(50)
    .returns<CollectionEventRow[]>();
  const {data: savedViews} = await supabase
    .from('collection_saved_views')
    .select('id, name, month, view')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .order('created_at', {ascending: false})
    .limit(12)
    .returns<SavedViewRow[]>();

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
  const rowByLeaseId = new Map(rows.map((row) => [row.lease.id, row]));
  const updatedRows = resultIds(params.result_updated_ids)
    .map((leaseId) => rowByLeaseId.get(leaseId))
    .filter((row): row is (typeof rows)[number] => Boolean(row));
  const failedRows = skippedResult(params.result_skipped)
    .map((result) => {
      const row = rowByLeaseId.get(result.leaseId);
      return row ? {...result, row} : null;
    })
    .filter((result): result is {leaseId: string; reason: SkipReason; row: (typeof rows)[number]} => Boolean(result));
  const resultStatus = collectionStatus(params.result_status);
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
          <form action={localizedPath(locale, '/collections')} className="flex flex-wrap items-end gap-3" method="get">
            <input name="view" type="hidden" value={view} />
            <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t('month')}
              <input className="focus-ring min-h-11 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[#171d1c]" defaultValue={month} name="month" type="month" />
            </label>
            <button className="focus-ring min-h-11 rounded-lg border border-[var(--line)] bg-white px-5 text-sm font-semibold hover:bg-[#f5faf8]" type="submit">
              {t('refresh')}
            </button>
          </form>
          <a className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-5 text-sm font-semibold hover:bg-[#f5faf8]" href={exportHref(locale, month, view)}>
            <span className="material-symbols-outlined text-[20px]">download</span>
            {t('export')}
          </a>
          <a className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-5 text-sm font-semibold hover:bg-[#f5faf8]" href={reportHref(locale, month, view)}>
            <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
            {t('pdfReport')}
          </a>
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-[var(--line-soft)] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#171d1c]">{t('savedViews.title')}</span>
            {(savedViews ?? []).map((saved) => (
              <div className="inline-flex items-center rounded-lg border border-[var(--line)] bg-[#f8fbfa]" key={saved.id}>
                <Link className="px-3 py-2 text-sm font-semibold text-[var(--accent)]" href={viewHref(locale, saved.month, saved.view)}>{saved.name}</Link>
                <form action={deleteCollectionViewAction}>
                  <input name="locale" type="hidden" value={locale} />
                  <input name="id" type="hidden" value={saved.id} />
                  <input name="month" type="hidden" value={month} />
                  <input name="view" type="hidden" value={view} />
                  <button aria-label={t('savedViews.delete')} className="flex h-9 w-9 items-center justify-center border-l border-[var(--line)] text-[var(--muted)] hover:bg-[#eef7f4]" type="submit">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </form>
              </div>
            ))}
            {!(savedViews ?? []).length ? <span className="text-sm text-[var(--muted)]">{t('savedViews.empty')}</span> : null}
          </div>
          <form action={saveCollectionViewAction} className="flex flex-wrap gap-2">
            <input name="locale" type="hidden" value={locale} />
            <input name="month" type="hidden" value={month} />
            <input name="view" type="hidden" value={view} />
            <input className="focus-ring min-h-10 rounded-md border border-[var(--line)] px-3 text-sm" maxLength={60} name="name" placeholder={t('savedViews.name')} required />
            <button className="min-h-10 rounded-md border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f0f5f2]" type="submit">{t('savedViews.save')}</button>
          </form>
        </div>
        {params.saved_view ? <p className="mt-3 text-xs text-[var(--muted)]">{t(`savedViews.status.${params.saved_view}`)}</p> : null}
      </section>

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

      {success && (updatedRows.length || failedRows.length) ? (
        <section className="mt-4 overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white shadow-sm">
          <div className="border-b border-[var(--line-soft)] px-5 py-4">
            <h2 className="text-base font-semibold text-[#171d1c]">{t('result.title')}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('result.copy')}</p>
          </div>
          <div className="grid gap-6 p-5 lg:grid-cols-2">
            <ResultList
              empty={t('result.noneUpdated')}
              items={updatedRows.map((row) => ({
                detail: t(`status.${resultStatus}`),
                key: row.lease.id,
                property: relationOne(row.lease.properties)?.name ?? t('unknownProperty'),
                tenant: relationOne(row.lease.tenants)?.full_name ?? t('unknownTenant')
              }))}
              title={t('result.updated', {count: updatedRows.length})}
              tone="success"
            />
            <ResultList
              empty={t('result.noneFailed')}
              items={failedRows.map(({reason, row}) => ({
                detail: t(`skipReasons.${reason}`),
                key: row.lease.id,
                property: relationOne(row.lease.properties)?.name ?? t('unknownProperty'),
                tenant: relationOne(row.lease.tenants)?.full_name ?? t('unknownTenant')
              }))}
              title={t('result.failed', {count: failedRows.length})}
              tone="warning"
            />
          </div>
        </section>
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
                    selected: t.raw('selection.selected')
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
                <th className="w-12 px-5 py-3">
                  <CollectionSelectAllCheckbox
                    formId={COLLECTION_FORM_ID}
                    initialSelected={initialSelected}
                    labels={{clear: t('selection.clear'), selectAll: t('selection.selectAll')}}
                    total={visibleRows.length}
                  />
                </th>
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

      <section className="mt-8 overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white shadow-sm">
        <div className="border-b border-[var(--line-soft)] p-5">
          <h2 className="text-lg font-semibold text-[#171d1c]">{t('history.title')}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('history.copy')}</p>
        </div>
        {collectionEvents?.length ? (
          <div className="max-h-[420px] divide-y divide-[var(--line-soft)] overflow-y-auto">
            {collectionEvents.map((event) => {
              const lease = relationOne(event.leases);
              const tenant = relationOne(lease?.tenants ?? null);
              const property = relationOne(lease?.properties ?? null);
              const actor = relationOne(event.profiles);
              const previousStatus = event.previous_status ? collectionStatus(event.previous_status) : null;
              const newStatus = collectionStatus(event.new_status);

              return (
                <div className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" key={event.id}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#171d1c]">{tenant?.full_name ?? t('unknownTenant')}</p>
                      <span className="text-xs text-[var(--muted)]">{property?.name ?? t('unknownProperty')}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      {t('history.by', {actor: actor?.full_name || actor?.email || t('history.unknownActor')})} · {formatDateTime(event.created_at, locale)} · {t(`history.sources.${event.source === 'batch' || event.source === 'tenant' ? event.source : 'single'}`)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {previousStatus ? <span className="rounded-md bg-[#f0f3f2] px-2.5 py-1 text-xs font-semibold text-[#53615e]">{t(`status.${previousStatus}`)}</span> : null}
                    <span className="material-symbols-outlined text-[18px] text-[var(--muted)]">arrow_forward</span>
                    <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${statusTone(newStatus)}`}>{t(`status.${newStatus}`)}</span>
                    <span className="ml-1 text-xs font-semibold tabular-nums text-[#53615e]">
                      {formatMoney(Number(event.amount_before ?? 0), locale)} → {formatMoney(Number(event.amount_after ?? 0), locale)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="p-5 text-sm text-[var(--muted)]">{t('history.empty')}</p>
        )}
      </section>
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

function ResultList({
  empty,
  items,
  title,
  tone
}: {
  empty: string;
  items: Array<{detail: string; key: string; property: string; tenant: string}>;
  title: string;
  tone: 'success' | 'warning';
}) {
  const toneClass = tone === 'success' ? 'bg-[#e4f7ed] text-[#087a55]' : 'bg-[#fff4db] text-[#9a5a00]';

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#171d1c]">{title}</h3>
      {items.length ? (
        <div className="mt-3 max-h-72 divide-y divide-[var(--line-soft)] overflow-y-auto rounded-lg border border-[var(--line-soft)]">
          {items.map((item) => (
            <div className="flex items-center justify-between gap-4 p-3" key={item.key}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#171d1c]">{item.tenant}</p>
                <p className="mt-1 truncate text-xs text-[var(--muted)]">{item.property}</p>
              </div>
              <span className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{item.detail}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-[#f8fbfa] p-3 text-sm text-[var(--muted)]">{empty}</p>
      )}
    </div>
  );
}
