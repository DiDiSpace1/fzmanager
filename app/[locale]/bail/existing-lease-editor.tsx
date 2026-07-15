'use client';

import {useState} from 'react';

import {DateDisplayInput, isoDateToDisplay} from '@/components/forms/date-display-input';

import {deleteLeaseAction, updateLeaseAction} from '../properties/actions';

type EditableLease = {
  charges_amount: number | null;
  deposit_amount: number | null;
  end_date: string | null;
  id: string;
  monthly_rent: number | null;
  start_date: string;
  tenants: {
    full_name: string;
  } | null;
};

function moneyInput(value: number | null) {
  return value ? String(value) : '';
}

export function ExistingLeaseEditor({leases, locale, propertyId}: {leases: EditableLease[]; locale: string; propertyId: string}) {
  const [editingLease, setEditingLease] = useState<EditableLease | null>(null);

  if (!leases.length) {
    return null;
  }

  return (
    <>
      <section className="mb-6 rounded-lg border border-[var(--line-soft)] bg-[#fbfdfc] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Locataires existants</h2>
          <span className="text-xs font-medium text-[var(--muted)]">{leases.length} bail{leases.length > 1 ? 's' : ''} actif{leases.length > 1 ? 's' : ''}</span>
        </div>
        <div className="grid gap-3">
          {leases.map((lease) => (
            <div className="grid gap-3 rounded-md border border-[var(--line-soft)] bg-white p-3 md:grid-cols-[minmax(0,1fr)_140px_140px_auto_auto] md:items-center" key={lease.id}>
              <div className="min-w-0">
                <p className="truncate font-medium">{lease.tenants?.full_name ?? 'Locataire'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#53615f]">Date debut</p>
                <p className="mt-1 text-sm">{isoDateToDisplay(lease.start_date)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#53615f]">Date fin</p>
                <p className="mt-1 text-sm">{lease.end_date ? isoDateToDisplay(lease.end_date) : '-'}</p>
              </div>
              <button className="focus-ring rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold cursor-pointer" onClick={() => setEditingLease(lease)} type="button">
                Modifier
              </button>
              <form action={deleteLeaseAction}>
                <input name="locale" type="hidden" value={locale} />
                <input name="property_id" type="hidden" value={propertyId} />
                <input name="lease_id" type="hidden" value={lease.id} />
                <button className="focus-ring w-full rounded-md border border-[#f3b4b4] px-4 py-2 text-sm font-semibold text-[#ba1a1a]" type="submit">
                  Supprimer
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      {editingLease ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true">
          <form action={updateLeaseAction} className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
            <input name="locale" type="hidden" value={locale} />
            <input name="property_id" type="hidden" value={propertyId} />
            <input name="lease_id" type="hidden" value={editingLease.id} />
            <div className="flex items-center justify-between gap-4 border-b border-[var(--line-soft)] px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold">Modifier le bail</h3>
                <p className="mt-1 truncate text-sm text-[var(--muted)]">{editingLease.tenants?.full_name ?? 'Locataire'}</p>
              </div>
              <button className="focus-ring rounded-full p-2 text-[#33413f]" onClick={() => setEditingLease(null)} type="button" aria-label="Fermer">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
                Date debut
                <DateDisplayInput className="focus-ring h-11 min-h-11 w-full rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={editingLease.start_date} name="start_date" required />
              </label>
              <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
                Date fin
                <DateDisplayInput className="focus-ring h-11 min-h-11 w-full rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={editingLease.end_date ?? ''} name="end_date" />
              </label>
              <MoneyField defaultValue={moneyInput(editingLease.monthly_rent)} label="Montant loyer" name="monthly_rent" required />
              <MoneyField defaultValue={moneyInput(editingLease.charges_amount)} label="Charge" name="charges_amount" />
              <MoneyField defaultValue={moneyInput(editingLease.deposit_amount)} label="Caution" name="deposit_amount" />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[var(--line-soft)] px-5 py-4 sm:flex-row sm:justify-end">
              <button className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-5 text-sm font-semibold" onClick={() => setEditingLease(null)} type="button">
                Annuler
              </button>
              <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" style={{color: '#ffffff'}} type="submit">
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function MoneyField({defaultValue, label, name, required = false}: {defaultValue?: string; label: string; name: string; required?: boolean}) {
  return (
    <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
      {label}
      <span className="flex min-h-11 items-center rounded-md border border-[var(--line)] bg-white px-3">
        <input className="min-w-0 flex-1 border-0 bg-transparent text-sm font-normal outline-none" defaultValue={defaultValue} min="0" name={name} required={required} step="0.01" type="number" />
        <span className="text-sm font-semibold">EUR</span>
      </span>
    </label>
  );
}
