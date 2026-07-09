'use client';

import Link from 'next/link';
import {useMemo, useState, useTransition} from 'react';

import {generateQuittanceAction} from './actions';

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

  return [property.name, property.address_line1, [property.postal_code, property.city].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
}

function ReceiptPreview({property, state, tenant}: {property: QuittancePropertyOption | null; state: FormState; tenant: QuittanceTenantOption | null}) {
  const total = Number.parseFloat(state.amount.replace(',', '.')) + Number.parseFloat((state.charges || '0').replace(',', '.'));

  return (
    <div className="mx-auto aspect-[0.72] w-full max-w-[320px] rounded-sm bg-white p-7 text-left shadow-sm ring-1 ring-[var(--line-soft)]">
      <p className="text-center text-lg font-semibold text-[#171d1c]">Quittance de loyer</p>
      <p className="mt-1 text-center text-xs text-[var(--muted)]">{monthLabel(state.periodMonth)}</p>
      <div className="mt-7 grid gap-4 text-xs leading-5 text-[#33413f]">
        <div>
          <p className="font-semibold uppercase tracking-wide text-[var(--muted)]">Proprietaire</p>
          <p className="mt-1 text-sm text-[#171d1c]">{state.ownerName || '-'}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wide text-[var(--muted)]">Locataire</p>
          <p className="mt-1 text-sm text-[#171d1c]">{tenant?.full_name ?? '-'}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wide text-[var(--muted)]">Bien</p>
          <p className="mt-1 text-sm text-[#171d1c]">{propertyAddress(property)}</p>
        </div>
      </div>
      <div className="mt-7 border-t border-[var(--line-soft)] pt-5 text-sm">
        <div className="flex justify-between gap-4">
          <span>Loyer</span>
          <span className="font-semibold tabular-nums">{money(state.amount)}</span>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <span>Charges</span>
          <span className="font-semibold tabular-nums">{money(state.charges || '0')}</span>
        </div>
        <div className="mt-3 flex justify-between gap-4 border-t border-[var(--line-soft)] pt-3 text-[#00685f]">
          <span className="font-semibold">Total recu</span>
          <span className="font-semibold tabular-nums">{Number.isFinite(total) ? money(String(total)) : '0,00 EUR'}</span>
        </div>
      </div>
      <p className="mt-7 text-xs leading-5 text-[var(--muted)]">Paiement recu le {state.paidAt || '-'} par {state.paymentMethod === 'cash' ? 'especes' : state.paymentMethod === 'cheque' ? 'cheque' : 'virement bancaire'}.</p>
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
  const initialProperty = properties[0] ?? null;
  const [state, setState] = useState<FormState>({
    amount: initialProperty?.monthly_rent_estimate ? String(Number(initialProperty.monthly_rent_estimate)) : '',
    charges: initialProperty?.charges_estimate ? String(Number(initialProperty.charges_estimate)) : '',
    ownerName,
    paidAt: today(),
    paymentMethod: 'bank_transfer',
    periodMonth: currentMonth(),
    propertyId: initialProperty?.id ?? '',
    tenantId: ''
  });
  const [showPreview, setShowPreview] = useState(false);
  const [previewLarge, setPreviewLarge] = useState(false);
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const selectedProperty = useMemo(() => properties.find((property) => property.id === state.propertyId) ?? null, [properties, state.propertyId]);
  const selectedTenant = useMemo(() => tenants.find((tenant) => tenant.id === state.tenantId) ?? null, [tenants, state.tenantId]);

  function update(next: Partial<FormState>) {
    setState((current) => ({...current, ...next}));
  }

  function onPropertyChange(propertyId: string) {
    const property = properties.find((item) => item.id === propertyId);
    update({
      amount: property?.monthly_rent_estimate ? String(Number(property.monthly_rent_estimate)) : state.amount,
      charges: property?.charges_estimate ? String(Number(property.charges_estimate)) : state.charges,
      propertyId
    });
  }

  function generatePdf() {
    const formData = new FormData();
    formData.set('locale', locale);
    formData.set('owner_name', state.ownerName);
    formData.set('property_id', state.propertyId);
    formData.set('tenant_id', state.tenantId);
    formData.set('period_month', state.periodMonth);
    formData.set('paid_at', state.paidAt);
    formData.set('payment_method', state.paymentMethod);
    formData.set('amount', state.amount);
    formData.set('charges', state.charges || '0');
    setMessage('');

    startTransition(async () => {
      const result = await generateQuittanceAction(formData);

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setMessage('Quittance generee et archivee dans vos documents.');

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
              Documents
            </Link>
            <span>/</span>
            <span className="text-[var(--accent)]">Quittances</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#171d1c]">Generer une quittance</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-5 text-sm font-semibold text-[#171d1c] shadow-sm hover:bg-[#f0f5f2]" onClick={() => setShowPreview(true)} type="button">
            Apercu
          </button>
          <button className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-sm disabled:opacity-60" disabled={isPending || !properties.length} onClick={generatePdf} style={{color: '#ffffff'}} type="button">
            {isPending ? 'Generation...' : 'Generer la quittance'}
          </button>
        </div>
      </div>

      {message ? <div className="mb-5 rounded-lg border border-[var(--line-soft)] bg-white p-4 text-sm text-[#33413f]">{message}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="min-h-[520px] rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d9fbf4] text-[var(--accent)]">
              <span className="text-lg font-semibold">Q</span>
            </div>
            <h2 className="text-lg font-semibold text-[#171d1c]">Informations du document</h2>
          </div>

          <div className="mt-6 grid gap-4 border-t border-[var(--line-soft)] pt-6 md:grid-cols-2">
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Proprietaire
              <input className="focus-ring min-h-11 w-full min-w-0 truncate rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" onChange={(event) => update({ownerName: event.target.value})} value={state.ownerName} />
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Bien
              <select className="focus-ring min-h-11 w-full min-w-0 truncate rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" onChange={(event) => onPropertyChange(event.target.value)} value={state.propertyId}>
                {properties.length ? null : <option value="">Aucun bien enregistre</option>}
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {propertyAddress(property)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Montant du loyer
              <input className="focus-ring min-h-11 w-full min-w-0 truncate rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" min="0" onChange={(event) => update({amount: event.target.value})} step="0.01" type="number" value={state.amount} />
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Charges (optionnel)
              <input className="focus-ring min-h-11 w-full min-w-0 truncate rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" min="0" onChange={(event) => update({charges: event.target.value})} step="0.01" type="number" value={state.charges} />
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Periode pour la quittance
              <input className="focus-ring min-h-11 w-full min-w-0 rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" onChange={(event) => update({periodMonth: event.target.value})} type="month" value={state.periodMonth} />
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Date du paiement
              <input className="focus-ring min-h-11 w-full min-w-0 rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" onChange={(event) => update({paidAt: event.target.value})} type="date" value={state.paidAt} />
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] md:col-span-2">
              Locataire (optionnel)
              <select className="focus-ring min-h-11 w-full min-w-0 truncate rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" onChange={(event) => update({tenantId: event.target.value})} value={state.tenantId}>
                <option value="">Aucun locataire specifique</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] md:col-span-2">
              Mode de paiement
              <select className="focus-ring min-h-11 w-full min-w-0 truncate rounded-lg border border-[var(--line)] px-3 text-sm font-normal normal-case tracking-normal text-[#171d1c]" onChange={(event) => update({paymentMethod: event.target.value})} value={state.paymentMethod}>
                <option value="bank_transfer">Virement bancaire</option>
                <option value="cash">Especes</option>
                <option value="cheque">Cheque</option>
                <option value="card">Carte bancaire</option>
                <option value="other">Autre</option>
              </select>
            </label>
          </div>

          <p className="mt-5 border-t border-[var(--line-soft)] pt-5 text-sm leading-6 text-[var(--muted)]">La quittance sera generee au format PDF et archivee automatiquement dans vos documents.</p>
        </section>

        <aside className="grid gap-5">
          <button className="rounded-xl border border-[var(--line-soft)] bg-white p-5 text-left shadow-sm" onClick={() => showPreview && setPreviewLarge(true)} type="button">
            {showPreview ? (
              <ReceiptPreview property={selectedProperty} state={state} tenant={selectedTenant} />
            ) : (
              <div className="grid min-h-[320px] place-items-center rounded-lg bg-[#f8fbfa] text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--accent)]">Q</div>
                  <p className="font-semibold text-[#171d1c]">Apercu en temps reel</p>
                  <p className="mt-2 text-sm leading-5 text-[var(--muted)]">Remplissez les champs a gauche puis cliquez sur Apercu.</p>
                </div>
              </div>
            )}
          </button>

          <section className="rounded-xl border border-[var(--line-soft)] bg-white p-4 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Dernieres quittances</h2>
            <div className="mt-4 grid gap-3">
              {recentReceipts.length ? (
                recentReceipts.map((receipt) => (
                  <a className="flex items-center justify-between rounded-lg border border-[var(--line-soft)] bg-[#f0f5f2] px-3 py-3 text-sm hover:bg-[#e4e9e7]" href={receipt.downloadUrl ?? '#'} key={receipt.id}>
                    <span>
                      <span className="block font-semibold text-[#171d1c]">{receipt.period_month ? monthLabel(receipt.period_month.slice(0, 7)) : receipt.file_name}</span>
                      <span className="block text-xs text-[var(--muted)]">{receipt.tenants?.full_name ?? 'Locataire'}</span>
                    </span>
                    <span className="text-lg">↓</span>
                  </a>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">Aucune quittance archivee.</p>
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
