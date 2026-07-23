'use client';

import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {useMemo, useState, useTransition} from 'react';

import {useMessage} from '@/components/message/MessageProvider';

export type QuittancePropertyOption = {
  address_line1: string | null;
  charges_estimate: number | null;
  city: string | null;
  id: string;
  monthly_rent_estimate: number | null;
  name: string;
  postal_code: string | null;
};

export type QuittanceTenantOption = {
  full_name: string;
  id: string;
  leases?: {
    charges_amount: number | null;
    id: string;
    monthly_rent: number | null;
    property_id: string | null;
    status: string;
  }[];
};

export type RecentReceipt = {
  downloadUrl: string | null;
  file_name: string;
  id: string;
  period_month: string | null;
  tenants: {
    full_name: string;
  } | null;
};

type BillingPlan = 'free' | 'plus' | 'portfolio' | 'solo';
type QuittanceMode = 'batch' | 'single';
type PaymentStatus = 'paid' | 'partial' | 'unpaid';

type FormState = {
  amount: string;
  charges: string;
  ownerName: string;
  paidAt: string;
  paymentMethod: string;
  periodMonth: string;
  propertyId: string;
  tenantId: string;
};

type BatchRow = {
  amount: string;
  charges: string;
  id: string;
  issue: string | null;
  leaseId: string;
  paidAt: string;
  property: QuittancePropertyOption | null;
  propertyId: string;
  selected: boolean;
  status: PaymentStatus;
  tenant: QuittanceTenantOption;
  tenantId: string;
};

type BatchResult = {
  documentId?: string;
  downloadUrl?: string | null;
  row: BatchRow;
  status: 'failed' | 'success';
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateLabel(value: string) {
  if (!value) {
    return '';
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('fr-FR', {day: '2-digit', month: '2-digit', year: 'numeric'}).format(date);
}

function frenchDateToIso(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function monthToDisplayDate(value: string) {
  if (!value) {
    return '';
  }

  const [year, month] = value.split('-');

  if (!year || !month) {
    return value;
  }

  return `01/${month.padStart(2, '0')}/${year}`;
}

function monthEndDisplayDate(value: string) {
  if (!value) {
    return '';
  }

  const [year, month] = value.split('-').map(Number);

  if (!year || !month) {
    return value;
  }

  const end = new Date(Date.UTC(year, month, 0));
  return new Intl.DateTimeFormat('fr-FR', {day: '2-digit', month: '2-digit', year: 'numeric'}).format(end);
}

function monthEndIsoDate(value: string) {
  if (!value) {
    return '';
  }

  const [year, month] = value.split('-').map(Number);

  if (!year || !month) {
    return value;
  }

  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function displayDateToMonth(value: string) {
  const isoDate = frenchDateToIso(value);

  if (!isoDate) {
    return null;
  }

  return isoDate.slice(0, 7);
}

function monthLabel(value: string) {
  if (!value) {
    return '-';
  }

  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', {month: 'long', year: 'numeric'}).format(new Date(Date.UTC(year, month - 1, 1)));
}

function money(value: string) {
  const parsed = Number.parseFloat(value.replace(',', '.'));

  if (!Number.isFinite(parsed)) {
    return '0,00 EUR';
  }

  return `${parsed.toLocaleString('fr-FR', {maximumFractionDigits: 2, minimumFractionDigits: 2})} EUR`;
}

function euro(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: 'EUR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: 'currency'
  }).format(value);
}

function numberValue(value: string) {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasPlusBatchAccess(plan: BillingPlan) {
  return plan === 'plus' || plan === 'portfolio';
}

function hasSingleAccess(plan: BillingPlan) {
  return plan !== 'free';
}

function propertyAddress(property: QuittancePropertyOption | null) {
  if (!property) {
    return '-';
  }

  return [property.address_line1, [property.postal_code, property.city].filter(Boolean).join(' ')].filter(Boolean).join(' - ') || property.name;
}

function propertyOptionLabel(property: QuittancePropertyOption) {
  return propertyAddress(property);
}

function todayLabel() {
  return new Date().toLocaleDateString('fr-FR');
}

function ReceiptPreview({property, state, tenant}: {property: QuittancePropertyOption | null; state: FormState; tenant: QuittanceTenantOption | null}) {
  const t = useTranslations('quittance');
  const total = Number.parseFloat(state.amount.replace(',', '.')) + Number.parseFloat((state.charges || '0').replace(',', '.'));
  const paymentMethod = state.paymentMethod === 'cash' ? t('cash') : state.paymentMethod === 'cheque' ? t('cheque') : state.paymentMethod === 'card' ? t('card') : state.paymentMethod === 'other' ? t('other') : t('bankTransfer');

  return (
    <div className="mx-auto min-h-[440px] w-full max-w-[320px] rounded-sm bg-white p-7 text-left shadow-sm ring-1 ring-[var(--line-soft)]">
      <p className="text-center text-lg font-semibold text-[#171d1c]">{t('receiptTitle')}</p>
      <p className="mt-1 text-center text-xs text-[var(--muted)]">{monthLabel(state.periodMonth)}</p>
      <div className="mt-7 grid gap-4 text-xs leading-5 text-[#33413f]">
        <div>
          <p className="font-semibold uppercase tracking-wide text-[var(--muted)]">{t('owner')}</p>
          <p className="mt-1 text-sm text-[#171d1c]">{state.ownerName || '-'}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wide text-[var(--muted)]">{t('tenant')}</p>
          <p className="mt-1 text-sm text-[#171d1c]">{tenant?.full_name ?? '-'}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wide text-[var(--muted)]">{t('property')}</p>
          <p className="mt-1 text-sm text-[#171d1c]">{propertyAddress(property)}</p>
        </div>
      </div>
      <div className="mt-7 border-t border-[var(--line-soft)] pt-5 text-sm">
        <div className="flex justify-between gap-4">
          <span>{t('rentAmount')}</span>
          <span className="font-semibold tabular-nums">{money(state.amount)}</span>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <span>{t('chargesOptional')}</span>
          <span className="font-semibold tabular-nums">{money(state.charges || '0')}</span>
        </div>
        <div className="mt-3 flex justify-between gap-4 border-t border-[var(--line-soft)] pt-3 text-[#00685f]">
          <span className="font-semibold">{t('totalReceived')}</span>
          <span className="font-semibold tabular-nums">{Number.isFinite(total) ? money(String(total)) : '0,00 EUR'}</span>
        </div>
      </div>
      <p className="mt-7 text-xs leading-5 text-[var(--muted)]">{t('paymentSentence', {date: dateLabel(state.paidAt) || '-', method: paymentMethod})}</p>
      <div className="mt-7 border-t border-[var(--line-soft)] pt-5 text-xs leading-5 text-[#33413f]">
        <p>{t('madeAt', {city: property?.city ?? '-', date: todayLabel()})}</p>
        <p className="mt-5 text-[var(--muted)]">{t('ownerSignature')}</p>
        <p className="mt-2 text-sm font-semibold text-[#171d1c]">{state.ownerName || '-'}</p>
      </div>
    </div>
  );
}

function UpgradeModal({onClose}: {onClose: () => void}) {
  const t = useTranslations('quittance');

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[#171d1c]">{t('upgradeTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('upgradeCopy')}</p>
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-sm hover:bg-[#f0f5f2]" onClick={onClose} type="button">
            x
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button className="min-h-10 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f0f5f2]" onClick={onClose} type="button">
            {t('upgradeLater')}
          </button>
          <Link className="inline-flex min-h-10 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white" href="/settings?tab=abonnement" style={{color: '#ffffff'}}>
            {t('upgradeAction')}
          </Link>
        </div>
      </div>
    </div>
  );
}

function BatchPreviewModal({
  index,
  rows,
  setIndex,
  onClose
}: {
  index: number;
  rows: BatchRow[];
  setIndex: (value: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations('quittance');
  const row = rows[index] ?? rows[0];

  if (!row) {
    return null;
  }

  const previewState: FormState = {
    amount: row.amount,
    charges: row.charges,
    ownerName: '',
    paidAt: row.paidAt,
    paymentMethod: 'bank_transfer',
    periodMonth: currentMonth(),
    propertyId: row.propertyId,
    tenantId: row.tenantId
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 p-4" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-w-4xl flex-col rounded-xl bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line-soft)] pb-3">
          <button className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={index <= 0} onClick={() => setIndex(index - 1)} type="button">
            {t('previousReceipt')}
          </button>
          <p className="text-sm font-semibold text-[#171d1c]">{index + 1} / {rows.length}</p>
          <button className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={index >= rows.length - 1} onClick={() => setIndex(index + 1)} type="button">
            {t('nextReceipt')}
          </button>
          <button className="ml-auto rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold hover:bg-[#f0f5f2]" onClick={onClose} type="button">
            x
          </button>
        </div>
        <div className="grid flex-1 place-items-center overflow-auto py-5">
          <ReceiptPreview property={row.property} state={previewState} tenant={row.tenant} />
        </div>
      </div>
    </div>
  );
}

export function QuittanceForm({
  currentPlan,
  locale,
  ownerName,
  properties,
  recentReceipts,
  tenants
}: {
  currentPlan: BillingPlan;
  locale: string;
  ownerName: string;
  properties: QuittancePropertyOption[];
  recentReceipts: RecentReceipt[];
  tenants: QuittanceTenantOption[];
}) {
  const t = useTranslations('quittance');
  const message = useMessage();
  const canGenerateSingle = hasSingleAccess(currentPlan);
  const canUseBatch = hasPlusBatchAccess(currentPlan);
  const initialProperty = properties[0] ?? null;
  const initialPaidAt = today();
  const initialPeriodMonth = currentMonth();

  function buildBatchRows(sourceTenants: QuittanceTenantOption[], sourceProperties: QuittancePropertyOption[], paidAt: string) {
    return sourceTenants.flatMap((tenant) => {
      const activeLeases = tenant.leases?.filter((lease) => lease.status === 'active') ?? [];

      return activeLeases.map((lease) => {
        const property = sourceProperties.find((item) => item.id === lease.property_id) ?? null;
        const amount = lease.monthly_rent != null ? String(Number(lease.monthly_rent)) : property?.monthly_rent_estimate != null ? String(Number(property.monthly_rent_estimate)) : '';
        const charges = lease.charges_amount != null ? String(Number(lease.charges_amount)) : property?.charges_estimate != null ? String(Number(property.charges_estimate)) : '0';
        const issue = !property ? t('missingProperty') : !amount ? t('missingAmount') : null;

        return {
          amount,
          charges,
          id: lease.id,
          issue,
          leaseId: lease.id,
          paidAt,
          property,
          propertyId: lease.property_id ?? '',
          selected: Boolean(property && amount),
          status: 'paid' as const,
          tenant,
          tenantId: tenant.id
        };
      });
    });
  }

  const [state, setState] = useState<FormState>({
    amount: initialProperty?.monthly_rent_estimate ? String(Number(initialProperty.monthly_rent_estimate)) : '',
    charges: initialProperty?.charges_estimate ? String(Number(initialProperty.charges_estimate)) : '',
    ownerName,
    paidAt: initialPaidAt,
    paymentMethod: 'bank_transfer',
    periodMonth: initialPeriodMonth,
    propertyId: initialProperty?.id ?? '',
    tenantId: ''
  });
  const [showPreview, setShowPreview] = useState(false);
  const [previewLarge, setPreviewLarge] = useState(false);
  const [mode, setMode] = useState<QuittanceMode>('single');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [batchPeriodMonth, setBatchPeriodMonth] = useState(initialPeriodMonth);
  const [batchPaidAt, setBatchPaidAt] = useState(initialPaidAt);
  const [batchPaymentMethod, setBatchPaymentMethod] = useState('bank_transfer');
  const [batchScope, setBatchScope] = useState('all_rented');
  const [batchStatusFilter, setBatchStatusFilter] = useState<Record<PaymentStatus, boolean>>({paid: true, partial: false, unpaid: false});
  const [batchRows, setBatchRows] = useState<BatchRow[]>(() => buildBatchRows(tenants, properties, initialPaidAt));
  const [batchPreviewOpen, setBatchPreviewOpen] = useState(false);
  const [batchPreviewIndex, setBatchPreviewIndex] = useState(0);
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedProperty = useMemo(() => properties.find((property) => property.id === state.propertyId) ?? null, [properties, state.propertyId]);
  const selectedTenant = useMemo(() => tenants.find((tenant) => tenant.id === state.tenantId) ?? null, [tenants, state.tenantId]);
  const selectedLease = useMemo(() => {
    const activeLeases = selectedTenant?.leases?.filter((lease) => lease.status === 'active') ?? [];
    return activeLeases.find((lease) => lease.property_id === state.propertyId) ?? activeLeases[0] ?? null;
  }, [selectedTenant, state.propertyId]);
  const selectedTenantHasNoBail = Boolean(state.tenantId && !selectedLease);

  function update(next: Partial<FormState>) {
    setState((current) => ({...current, ...next}));
  }

  function onPropertyChange(propertyId: string) {
    const property = properties.find((item) => item.id === propertyId);
    const activeLease = selectedTenant?.leases?.find((lease) => lease.status === 'active' && lease.property_id === propertyId);

    if (activeLease) {
      update({
        amount: activeLease.monthly_rent != null ? String(Number(activeLease.monthly_rent)) : '',
        charges: activeLease.charges_amount != null ? String(Number(activeLease.charges_amount)) : '',
        propertyId
      });
      return;
    }

    update({
      amount: state.tenantId ? '' : property?.monthly_rent_estimate ? String(Number(property.monthly_rent_estimate)) : state.amount,
      charges: state.tenantId ? '' : property?.charges_estimate ? String(Number(property.charges_estimate)) : state.charges,
      propertyId
    });
  }

  function onTenantChange(tenantId: string) {
    const tenant = tenants.find((item) => item.id === tenantId);
    const activeLeases = tenant?.leases?.filter((lease) => lease.status === 'active') ?? [];
    const lease = activeLeases.find((item) => item.property_id === state.propertyId) ?? activeLeases[0] ?? null;

    update({
      amount: lease?.monthly_rent != null ? String(Number(lease.monthly_rent)) : '',
      charges: lease?.charges_amount != null ? String(Number(lease.charges_amount)) : '',
      propertyId: lease?.property_id ?? state.propertyId,
      tenantId
    });
  }

  function onPaidAtChange(value: string) {
    update({paidAt: value});
  }

  function onPeriodChange(value: string) {
    update({periodMonth: value.slice(0, 7)});
  }

  function generatePdf() {
    if (!canGenerateSingle) {
      setShowUpgrade(true);
      return;
    }

    startTransition(async () => {
      const response = await fetch('/api/documents/quittance', {
        body: JSON.stringify({
          amount: state.amount,
          charges: state.charges || '0',
          locale,
          ownerName: state.ownerName,
          paidAt: state.paidAt,
          paymentMethod: state.paymentMethod,
          periodMonth: state.periodMonth,
          propertyId: state.propertyId,
          tenantId: state.tenantId
        }),
        headers: {'Content-Type': 'application/json'},
        method: 'POST'
      });
      const result = (await response.json()) as {downloadUrl?: string | null; error?: string};

      if (!response.ok) {
        message.error(result.error ?? t('error'));
        return;
      }

      message.success(t('success'));

      if (result.downloadUrl) {
        window.location.href = result.downloadUrl;
      }
    });
  }

  function selectMode(nextMode: QuittanceMode) {
    if (nextMode === 'batch' && !canUseBatch) {
      setShowUpgrade(true);
      return;
    }

    setMode(nextMode);
  }

  function syncBatchPaidAt(value: string) {
    setBatchPaidAt(value);
    setBatchRows((rows) => rows.map((row) => ({...row, paidAt: row.paidAt || value})));
  }

  function updateBatchRow(rowId: string, next: Partial<BatchRow>) {
    setBatchRows((rows) => rows.map((row) => (row.id === rowId ? {...row, ...next} : row)));
  }

  function selectableBatchRows() {
    return batchRows.filter((row) => batchStatusFilter[row.status]);
  }

  function selectedBatchRows() {
    return selectableBatchRows().filter((row) => row.selected);
  }

  function setAllRows(selected: boolean) {
    setBatchRows((rows) => rows.map((row) => (batchStatusFilter[row.status] ? {...row, selected} : row)));
  }

  function selectPaidRows() {
    setBatchRows((rows) => rows.map((row) => ({...row, selected: row.status === 'paid' && !row.issue})));
  }

  function generateBatch() {
    const rows = selectedBatchRows();

    if (!rows.length) {
      message.error(t('batchNoSelection'));
      return;
    }

    startTransition(async () => {
      const results: BatchResult[] = [];

      for (const row of rows) {
        if (!row.paidAt) {
          results.push({row, status: 'failed'});
          continue;
        }

        const response = await fetch('/api/documents/quittance', {
          body: JSON.stringify({
            amount: row.amount,
            charges: row.charges || '0',
            locale,
            ownerName,
            paidAt: row.paidAt,
            paymentMethod: batchPaymentMethod,
            periodMonth: batchPeriodMonth,
            propertyId: row.propertyId,
            tenantId: row.tenantId
          }),
          headers: {'Content-Type': 'application/json'},
          method: 'POST'
        });
        const result = (await response.json()) as {documentId?: string; downloadUrl?: string | null; error?: string};

        results.push({documentId: result.documentId, downloadUrl: result.downloadUrl, row, status: response.ok ? 'success' : 'failed'});
      }

      setBatchResults(results);
      message.success(t('batchFinished'));
    });
  }

  const filteredBatchRows = selectableBatchRows();
  const selectedRows = selectedBatchRows();
  const selectedTotal = selectedRows.reduce((sum, row) => sum + numberValue(row.amount) + numberValue(row.charges), 0);
  const selectedPropertyCount = new Set(selectedRows.map((row) => row.propertyId).filter(Boolean)).size;
  const missingPaidAtCount = selectedRows.filter((row) => !row.paidAt).length;
  const unpaidCount = batchRows.filter((row) => row.status === 'unpaid').length;
  const successfulResults = batchResults?.filter((result) => result.status === 'success') ?? [];
  const failedResults = batchResults?.filter((result) => result.status === 'failed') ?? [];

  return (
    <>
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
            <Link className="hover:text-[var(--accent)]" href="/documents">
              {t('breadcrumbDocuments')}
            </Link>
            <span>/</span>
            <span className="text-[var(--accent)]">{t('breadcrumbReceipts')}</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#171d1c]">{t('title')}</h1>
          <div className="mt-4 inline-flex rounded-lg border border-[var(--line)] bg-white p-1 shadow-sm">
            <button className={['min-h-9 rounded-md px-4 text-sm font-semibold', mode === 'single' ? 'bg-[var(--accent)] text-white' : 'text-[#33413f] hover:bg-[#f0f5f2]'].join(' ')} onClick={() => selectMode('single')} type="button">
              {t('singleMode')}
            </button>
            <button className={['min-h-9 rounded-md px-4 text-sm font-semibold', mode === 'batch' ? 'bg-[var(--accent)] text-white' : 'text-[#33413f] hover:bg-[#f0f5f2]'].join(' ')} onClick={() => selectMode('batch')} type="button">
              {t('batchMode')}
            </button>
          </div>
        </div>
        {mode === 'single' ? <div className="flex flex-wrap gap-3">
          <button className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-5 text-sm font-semibold text-[#171d1c] shadow-sm hover:bg-[#f0f5f2]" onClick={() => setShowPreview(true)} type="button">
            {t('preview')}
          </button>
          <button className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-sm disabled:opacity-60" disabled={isPending || !properties.length} onClick={generatePdf} style={{color: '#ffffff'}} type="button">
            {isPending ? t('generating') : t('generate')}
          </button>
        </div> : null}
      </div>

      {mode === 'single' ? <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="min-h-[520px] rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d9fbf4] text-[var(--accent)]">
              <span className="text-lg font-semibold">Q</span>
            </div>
            <h2 className="text-lg font-semibold text-[#171d1c]">{t('infoTitle')}</h2>
          </div>

          <div className="mt-6 grid gap-4 border-t border-[var(--line-soft)] pt-6 md:grid-cols-2">
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t('owner')}
              <input className="focus-ring min-h-11 w-full min-w-0 truncate rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" onChange={(event) => update({ownerName: event.target.value})} value={state.ownerName} />
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t('property')}
              <select className="focus-ring min-h-11 w-full min-w-0 truncate rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" onChange={(event) => onPropertyChange(event.target.value)} value={state.propertyId}>
                {properties.length ? null : <option value="">{t('noProperty')}</option>}
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {propertyOptionLabel(property)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] md:col-span-2">
              {t('tenant')}
              <select className="focus-ring min-h-11 w-full min-w-0 truncate rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" onChange={(event) => onTenantChange(event.target.value)} value={state.tenantId}>
                <option value="">{t('chooseTenant')}</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t('rentAmount')}
              <input className="focus-ring min-h-11 w-full min-w-0 truncate rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c] disabled:bg-[#f8fbfa] disabled:text-[var(--muted)]" disabled={selectedTenantHasNoBail} min="0" onChange={(event) => update({amount: event.target.value})} placeholder={selectedTenantHasNoBail ? t('leaseMissing') : '0'} step="0.01" type="number" value={state.amount} />
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t('chargesOptional')}
              <input className="focus-ring min-h-11 w-full min-w-0 truncate rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c] disabled:bg-[#f8fbfa] disabled:text-[var(--muted)]" disabled={selectedTenantHasNoBail} min="0" onChange={(event) => update({charges: event.target.value})} placeholder={selectedTenantHasNoBail ? t('leaseMissing') : '0'} step="0.01" type="number" value={state.charges} />
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t('period')}
              <input className="focus-ring min-h-11 w-full min-w-0 rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" onChange={(event) => onPeriodChange(event.target.value)} type="date" value={`${state.periodMonth}-01`} />
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t('paymentDate')}
              <input className="focus-ring min-h-11 w-full min-w-0 rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" onChange={(event) => onPaidAtChange(event.target.value)} type="date" value={state.paidAt} />
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] md:col-span-2">
              {t('paymentMethod')}
              <select className="focus-ring min-h-11 w-full min-w-0 truncate rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" onChange={(event) => update({paymentMethod: event.target.value})} value={state.paymentMethod}>
                <option value="bank_transfer">{t('bankTransfer')}</option>
                <option value="cash">{t('cash')}</option>
                <option value="cheque">{t('cheque')}</option>
                <option value="card">{t('card')}</option>
                <option value="other">{t('other')}</option>
              </select>
            </label>
          </div>

          <p className="mt-5 border-t border-[var(--line-soft)] pt-5 text-sm leading-6 text-[var(--muted)]">{t('archivedHint')}</p>
        </section>

        <aside className="grid gap-5">
          <button className="rounded-xl border border-[var(--line-soft)] bg-white p-5 text-left shadow-sm" onClick={() => showPreview && setPreviewLarge(true)} type="button">
            {showPreview ? (
              <ReceiptPreview property={selectedProperty} state={state} tenant={selectedTenant} />
            ) : (
              <div className="grid min-h-[320px] place-items-center rounded-lg bg-[#f8fbfa] text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--accent)]">Q</div>
                  <p className="font-semibold text-[#171d1c]">{t('livePreview')}</p>
                  <p className="mt-2 text-sm leading-5 text-[var(--muted)]">{t('livePreviewHint')}</p>
                </div>
              </div>
            )}
          </button>

          <section className="rounded-xl border border-[var(--line-soft)] bg-white p-4 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('latestReceipts')}</h2>
            <div className="mt-4 grid gap-3">
              {recentReceipts.length ? (
                recentReceipts.map((receipt) => (
                  <a className="flex items-center justify-between rounded-lg border border-[var(--line-soft)] bg-[#f0f5f2] px-3 py-3 text-sm hover:bg-[#e4e9e7]" href={receipt.downloadUrl ?? '#'} key={receipt.id}>
                    <span>
                      <span className="block font-semibold text-[#171d1c]">{receipt.period_month ? monthLabel(receipt.period_month.slice(0, 7)) : receipt.file_name}</span>
                      <span className="block text-xs text-[var(--muted)]">{receipt.tenants?.full_name ?? t('tenant')}</span>
                    </span>
                    <span className="text-lg">↓</span>
                  </a>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">{t('noReceipts')}</p>
              )}
            </div>
          </section>
        </aside>
      </div> : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-[#171d1c]">{t('batchSettings')}</h2>
              <p className="text-sm leading-6 text-[var(--muted)]">{t('batchSettingsCopy')}</p>
            </div>

            <div className="mt-6 grid gap-4 border-t border-[var(--line-soft)] pt-6 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {t('receiptPeriod')}
                <div className="grid grid-cols-2 gap-2">
                  <input className="focus-ring min-h-11 rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" onChange={(event) => setBatchPeriodMonth(event.target.value.slice(0, 7))} type="date" value={`${batchPeriodMonth}-01`} />
                  <input className="min-h-11 rounded-lg border border-[var(--line)] bg-[#f8fbfa] px-3 text-sm font-normal normal-case tracking-normal text-[var(--muted)]" readOnly type="date" value={monthEndIsoDate(batchPeriodMonth)} />
                </div>
              </label>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {t('paymentDate')}
                <input className="focus-ring min-h-11 rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" onChange={(event) => syncBatchPaidAt(event.target.value)} type="date" value={batchPaidAt} />
              </label>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {t('paymentMethod')}
                <select className="focus-ring min-h-11 rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" onChange={(event) => setBatchPaymentMethod(event.target.value)} value={batchPaymentMethod}>
                  <option value="bank_transfer">{t('bankTransfer')}</option>
                  <option value="cash">{t('cash')}</option>
                  <option value="cheque">{t('cheque')}</option>
                  <option value="card">{t('card')}</option>
                  <option value="other">{t('other')}</option>
                </select>
              </label>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {t('generationScope')}
                <select className="focus-ring min-h-11 rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" onChange={(event) => setBatchScope(event.target.value)} value={batchScope}>
                  <option value="all_rented">{t('allRentedProperties')}</option>
                  <option value="selected_properties">{t('selectedProperties')}</option>
                  <option value="selected_tenants">{t('selectedTenants')}</option>
                </select>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 rounded-lg bg-[#f8fbfa] p-4 text-sm">
              <span className="font-semibold text-[#171d1c]">{t('includeStatuses')}</span>
              {(['paid', 'partial', 'unpaid'] as PaymentStatus[]).map((status) => (
                <label className="inline-flex items-center gap-2" key={status}>
                  <input checked={batchStatusFilter[status]} onChange={(event) => setBatchStatusFilter((current) => ({...current, [status]: event.target.checked}))} type="checkbox" />
                  <span>{t(`status.${status}`)}</span>
                </label>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-[var(--line-soft)] pt-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-[#171d1c]">{t('reviewTenants')}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{t('selectedSummary', {amount: euro(selectedTotal, locale), count: selectedRows.length})}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold hover:bg-[#f0f5f2]" onClick={() => setAllRows(true)} type="button">{t('selectAll')}</button>
                <button className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold hover:bg-[#f0f5f2]" onClick={() => setAllRows(false)} type="button">{t('selectNone')}</button>
                <button className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold hover:bg-[#f0f5f2]" onClick={selectPaidRows} type="button">{t('selectPaidOnly')}</button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--line-soft)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <th className="py-3 pr-3">{t('select')}</th>
                    <th className="py-3 pr-3">{t('tenant')}</th>
                    <th className="py-3 pr-3">{t('property')}</th>
                    <th className="py-3 pr-3">{t('rentAmount')}</th>
                    <th className="py-3 pr-3">{t('chargesOptional')}</th>
                    <th className="py-3 pr-3">{t('total')}</th>
                    <th className="py-3 pr-3">{t('paymentDate')}</th>
                    <th className="py-3 pr-3">{t('statusLabel')}</th>
                    <th className="py-3">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatchRows.map((row) => (
                    <tr className="border-b border-[var(--line-soft)] align-top" key={row.id}>
                      <td className="py-3 pr-3"><input checked={row.selected} disabled={Boolean(row.issue)} onChange={(event) => updateBatchRow(row.id, {selected: event.target.checked})} type="checkbox" /></td>
                      <td className="py-3 pr-3 font-semibold text-[#171d1c]">{row.tenant.full_name}{row.issue ? <p className="mt-1 text-xs font-normal text-[#a15c00]">{row.issue}</p> : null}</td>
                      <td className="py-3 pr-3 text-[#33413f]">{row.property?.name ?? '-'}</td>
                      <td className="py-3 pr-3"><input className="w-24 rounded-lg border border-[var(--line)] px-2 py-2 text-sm" min="0" onChange={(event) => updateBatchRow(row.id, {amount: event.target.value})} type="number" value={row.amount} /></td>
                      <td className="py-3 pr-3"><input className="w-24 rounded-lg border border-[var(--line)] px-2 py-2 text-sm" min="0" onChange={(event) => updateBatchRow(row.id, {charges: event.target.value})} type="number" value={row.charges} /></td>
                      <td className="py-3 pr-3 font-semibold tabular-nums text-[#171d1c]">{euro(numberValue(row.amount) + numberValue(row.charges), locale)}</td>
                      <td className="py-3 pr-3"><input className="w-36 rounded-lg border border-[var(--line)] px-2 py-2 text-sm" onChange={(event) => updateBatchRow(row.id, {paidAt: event.target.value})} type="date" value={row.paidAt} /></td>
                      <td className="py-3 pr-3">
                        <select className="rounded-lg border border-[var(--line)] px-2 py-2 text-sm" onChange={(event) => updateBatchRow(row.id, {selected: event.target.value === 'paid' && !row.issue, status: event.target.value as PaymentStatus})} value={row.status}>
                          <option value="paid">{t('status.paid')}</option>
                          <option value="partial">{t('status.partial')}</option>
                          <option value="unpaid">{t('status.unpaid')}</option>
                        </select>
                      </td>
                      <td className="py-3"><button className="text-sm font-semibold text-[var(--accent)]" onClick={() => { setBatchPreviewIndex(Math.max(0, selectedRows.findIndex((item) => item.id === row.id))); setBatchPreviewOpen(true); }} type="button">{t('previewOne')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredBatchRows.length ? <p className="rounded-lg bg-[#f8fbfa] p-4 text-sm text-[var(--muted)]">{t('batchEmpty')}</p> : null}
            </div>
          </section>

          <aside className="grid content-start gap-5">
            <section className="rounded-xl border border-[var(--line-soft)] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[#171d1c]">{t('batchSummaryTitle')}</h2>
              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex justify-between"><span>{t('receiptsToGenerate')}</span><span className="font-semibold">{t('receiptCount', {count: selectedRows.length})}</span></div>
                <div className="flex justify-between"><span>{t('propertiesInvolved')}</span><span className="font-semibold">{selectedPropertyCount}</span></div>
                <div className="flex justify-between"><span>{t('totalAmount')}</span><span className="font-semibold text-[var(--accent)]">{euro(selectedTotal, locale)}</span></div>
                <div className="flex justify-between"><span>{t('receiptPeriod')}</span><span className="font-semibold">{monthLabel(batchPeriodMonth)}</span></div>
              </div>
              <div className="mt-5 grid gap-2 rounded-lg bg-[#f8fbfa] p-4 text-sm">
                <p className="text-[#087a55]">{t('checkContracts')}</p>
                <p className="text-[#087a55]">{t('checkAmounts')}</p>
                <p className={missingPaidAtCount ? 'text-[#a15c00]' : 'text-[#087a55]'}>{t('checkMissingPaidAt', {count: missingPaidAtCount})}</p>
                <p className={unpaidCount ? 'text-[#a15c00]' : 'text-[#087a55]'}>{t('checkUnpaid', {count: unpaidCount})}</p>
              </div>
              <div className="mt-5 grid gap-3">
                <button className="min-h-11 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f0f5f2] disabled:opacity-50" disabled={!selectedRows.length} onClick={() => setBatchPreviewOpen(true)} type="button">{t('previewAll')}</button>
                <button className="min-h-11 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending || !selectedRows.length} onClick={generateBatch} style={{color: '#ffffff'}} type="button">{isPending ? t('generating') : t('generateBatch', {count: selectedRows.length})}</button>
              </div>
            </section>

            {batchResults ? (
              <section className="rounded-xl border border-[var(--line-soft)] bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-[#171d1c]">{t('batchDoneTitle', {count: batchResults.length})}</h2>
                <p className="mt-2 text-sm text-[#087a55]">{t('batchSuccessCount', {count: successfulResults.length})}</p>
                <p className="text-sm text-[#a15c00]">{t('batchFailedCount', {count: failedResults.length})}</p>
                <div className="mt-4 grid gap-2">
                  <button className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-sm font-semibold hover:bg-[#f0f5f2]" type="button">{t('downloadZip')}</button>
                  <button className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-sm font-semibold hover:bg-[#f0f5f2]" type="button">{t('sendTenants')}</button>
                  <Link className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--line)] px-3 text-sm font-semibold hover:bg-[#f0f5f2]" href="/documents">{t('viewDocuments')}</Link>
                </div>
                <div className="mt-4 grid gap-2 text-sm">
                  {batchResults.map((result) => (
                    <div className="rounded-lg border border-[var(--line-soft)] p-3" key={result.row.id}>
                      <div className="flex justify-between gap-3">
                        <span className="font-semibold">{result.row.tenant.full_name}</span>
                        <span className={result.status === 'success' ? 'text-[#087a55]' : 'text-[#a15c00]'}>{result.status === 'success' ? t('generated') : t('needsFix')}</span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">{result.row.property?.name ?? '-'} · {result.documentId ?? '-'}</p>
                      {result.downloadUrl ? <a className="mt-2 inline-flex text-xs font-semibold text-[var(--accent)]" href={result.downloadUrl}>{t('download')}</a> : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      )}

      {previewLarge ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onClick={() => setPreviewLarge(false)} role="dialog" aria-modal="true">
          <div className="w-full max-w-xl" onClick={(event) => event.stopPropagation()}>
            <ReceiptPreview property={selectedProperty} state={state} tenant={selectedTenant} />
          </div>
        </div>
      ) : null}
      {batchPreviewOpen ? <BatchPreviewModal index={batchPreviewIndex} rows={selectedRows} setIndex={setBatchPreviewIndex} onClose={() => setBatchPreviewOpen(false)} /> : null}
      {showUpgrade ? <UpgradeModal onClose={() => setShowUpgrade(false)} /> : null}
    </>
  );
}
