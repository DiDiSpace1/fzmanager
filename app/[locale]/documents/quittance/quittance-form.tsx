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

export function QuittanceForm({
  locale,
  ownerName,
  properties,
  recentReceipts,
  tenants
}: {
  locale: string;
  ownerName: string;
  properties: QuittancePropertyOption[];
  recentReceipts: RecentReceipt[];
  tenants: QuittanceTenantOption[];
}) {
  const t = useTranslations('quittance');
  const message = useMessage();
  const initialProperty = properties[0] ?? null;
  const initialPaidAt = today();
  const initialPeriodMonth = currentMonth();
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
  const [paidAtDisplay, setPaidAtDisplay] = useState(dateLabel(initialPaidAt));
  const [periodDisplay, setPeriodDisplay] = useState(monthToDisplayDate(initialPeriodMonth));
  const [showPreview, setShowPreview] = useState(false);
  const [previewLarge, setPreviewLarge] = useState(false);
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
    setPaidAtDisplay(value);
    const nextPaidAt = frenchDateToIso(value);

    if (nextPaidAt) {
      update({paidAt: nextPaidAt});
    }
  }

  function onPeriodChange(value: string) {
    setPeriodDisplay(value);
    const nextPeriod = displayDateToMonth(value);

    if (nextPeriod) {
      update({periodMonth: nextPeriod});
    }
  }

  function generatePdf() {
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
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-5 text-sm font-semibold text-[#171d1c] shadow-sm hover:bg-[#f0f5f2]" onClick={() => setShowPreview(true)} type="button">
            {t('preview')}
          </button>
          <button className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-sm disabled:opacity-60" disabled={isPending || !properties.length} onClick={generatePdf} style={{color: '#ffffff'}} type="button">
            {isPending ? t('generating') : t('generate')}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
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
              <input className="focus-ring min-h-11 w-full min-w-0 rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" inputMode="numeric" onChange={(event) => onPeriodChange(event.target.value)} placeholder="01/07/2026" value={periodDisplay} />
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t('paymentDate')}
              <input className="focus-ring min-h-11 w-full min-w-0 rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" inputMode="numeric" onChange={(event) => onPaidAtChange(event.target.value)} placeholder="13/07/2026" value={paidAtDisplay} />
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
      </div>

      {previewLarge ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onClick={() => setPreviewLarge(false)} role="dialog" aria-modal="true">
          <div className="w-full max-w-xl" onClick={(event) => event.stopPropagation()}>
            <ReceiptPreview property={selectedProperty} state={state} tenant={selectedTenant} />
          </div>
        </div>
      ) : null}
    </>
  );
}
