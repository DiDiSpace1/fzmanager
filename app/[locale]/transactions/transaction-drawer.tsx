'use client';

import {useMemo, useState} from 'react';

import {DateDisplayInput, MonthDisplayInput} from '@/components/forms/date-display-input';

import {createExpenseTransactionAction, createRevenueTransactionAction} from './actions';

type PropertyOption = {
  id: string;
  name: string;
};

type TaxCategoryOption = {
  id: string;
  label: string;
};

export type LeaseOption = {
  charges_amount: number | null;
  id: string;
  monthly_rent: number | null;
  rent_charges: {
    period_month: string;
    total_due: number | null;
    rent_payments: {
      amount: number | null;
    }[];
  }[];
  properties: {
    id: string;
    name: string;
  } | null;
  tenants: {
    id: string;
    full_name: string;
  } | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function periodStart(month: string) {
  return `${month}-01`;
}

function paidForPeriod(lease: LeaseOption | undefined, month: string) {
  const charge = lease?.rent_charges.find((row) => row.period_month === periodStart(month));
  return charge?.rent_payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0) ?? 0;
}

function remainingForPeriod(lease: LeaseOption | undefined, month: string) {
  const expected = Number(lease?.monthly_rent ?? 0) + Number(lease?.charges_amount ?? 0);
  return Math.max(0, expected - paidForPeriod(lease, month));
}

function Icon({children, className = ''}: {children: string; className?: string}) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function TransactionDrawer({
  initialOpen = false,
  initialTenantId,
  leases,
  locale,
  properties,
  taxCategories
}: {
  initialOpen?: boolean;
  initialTenantId?: string;
  leases: LeaseOption[];
  locale: string;
  properties: PropertyOption[];
  taxCategories: TaxCategoryOption[];
}) {
  const initialLeaseId = initialTenantId ? leases.find((lease) => lease.tenants?.id === initialTenantId)?.id : undefined;
  const [open, setOpen] = useState(initialOpen);
  const [mode, setMode] = useState<'expense' | 'revenue'>('revenue');
  const initialPeriodMonth = currentMonth();
  const [periodMonth, setPeriodMonth] = useState(initialPeriodMonth);
  const [selectedLeaseId, setSelectedLeaseId] = useState(initialLeaseId ?? leases[0]?.id ?? '');
  const selectedLease = useMemo(() => leases.find((lease) => lease.id === selectedLeaseId), [leases, selectedLeaseId]);
  const amountDue = remainingForPeriod(selectedLease, periodMonth);

  return (
    <>
      <button
        className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--accent-strong)]"
        onClick={() => setOpen(true)}
        style={{color: '#ffffff'}}
        type="button"
      >
        <Icon className="text-[18px]">add</Icon>
        Ajouter une transaction
      </button>

      {open ? (
        <div className="fixed inset-0 z-[10000]">
          <button aria-label="Fermer" className="absolute inset-0 bg-[#171d1c]/45" onClick={() => setOpen(false)} type="button" />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-6 py-5">
              <h2 className="text-xl font-semibold text-[#171d1c]">Ajouter une transaction</h2>
              <button className="focus-ring rounded-md p-2 text-[#171d1c] hover:bg-[#f0f5f2]" onClick={() => setOpen(false)} type="button">
                <Icon>close</Icon>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mb-7 grid grid-cols-2 gap-4">
                <button
                  className={`focus-ring min-h-[92px] rounded-lg border p-4 text-center transition ${mode === 'revenue' ? 'border-[var(--accent)] bg-[#e6f4f1] text-[#171d1c]' : 'border-[var(--line)] bg-white text-[#3d4947] hover:bg-[#f8fbfa]'}`}
                  onClick={() => setMode('revenue')}
                  type="button"
                >
                  <Icon className="block text-[30px]">payments</Icon>
                  <span className="mt-3 block text-sm font-semibold">Revenu</span>
                </button>
                <button
                  className={`focus-ring min-h-[92px] rounded-lg border p-4 text-center transition ${mode === 'expense' ? 'border-[var(--accent)] bg-[#e6f4f1] text-[#171d1c]' : 'border-[var(--line)] bg-white text-[#3d4947] hover:bg-[#f8fbfa]'}`}
                  onClick={() => setMode('expense')}
                  type="button"
                >
                  <Icon className="block text-[30px]">receipt_long</Icon>
                  <span className="mt-3 block text-sm font-semibold">Depense</span>
                </button>
              </div>

              {mode === 'revenue' ? (
                <form action={createRevenueTransactionAction} className="grid gap-5" id="transaction-revenue-form">
                  <input name="locale" type="hidden" value={locale} />
                  <label className="grid gap-2 text-sm text-[#3d4947]">
                    Type de revenu
                    <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[#171d1c]" name="revenue_type" defaultValue="rent">
                      <option value="rent">Loyer</option>
                      <option value="deposit">Depot de garantie</option>
                      <option value="other">Autre</option>
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm text-[#3d4947]">
                    Bail
                    <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[#171d1c]" name="lease_id" value={selectedLeaseId} onChange={(event) => setSelectedLeaseId(event.target.value)} required>
                      <option value="">Choisir un bail</option>
                      {leases.map((lease) => (
                        <option key={lease.id} value={lease.id}>
                          {(lease.properties?.name ?? 'Bien') + ' - ' + (lease.tenants?.full_name ?? 'Locataire')}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm text-[#3d4947]">
                      Bien immobilier
                      <input className="min-h-11 rounded-md border border-[var(--line-soft)] bg-[#f7faf9] px-3 text-sm text-[#3d4947]" readOnly value={selectedLease?.properties?.name ?? ''} />
                    </label>
                    <label className="grid gap-2 text-sm text-[#3d4947]">
                      Locataire
                      <input className="min-h-11 rounded-md border border-[var(--line-soft)] bg-[#f7faf9] px-3 text-sm text-[#3d4947]" readOnly value={selectedLease?.tenants?.full_name ?? ''} />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid min-w-0 gap-2 text-sm text-[#3d4947]">
                      Periode concernee
                      <MonthDisplayInput className="focus-ring h-11 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm" name="period_month" onMonthChange={setPeriodMonth} required value={periodMonth} />
                    </label>
                    <label className="grid min-w-0 gap-2 text-sm text-[#3d4947]">
                      Montant a payer
                      <div className="relative min-h-11 min-w-0 rounded-md border border-[var(--line)] bg-white">
                        <input
                          className="h-11 w-full min-w-0 border-0 bg-transparent px-3 pr-14 text-sm outline-none"
                          key={`${selectedLeaseId}-${periodMonth}-${amountDue}`}
                          defaultValue={amountDue ? amountDue.toFixed(2).replace('.', ',') : ''}
                          inputMode="decimal"
                          name="amount"
                          placeholder="560,00"
                          required
                          type="text"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#3d4947]">EUR</span>
                      </div>
	                      {selectedLease ? <span className="text-xs text-[var(--muted)]">Deja paye: {paidForPeriod(selectedLease, periodMonth).toFixed(2).replace('.', ',')} EUR</span> : null}
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm text-[#3d4947]">
                      Date de reception
                      <DateDisplayInput className="focus-ring h-11 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm" defaultValue={today()} name="received_at" required />
                    </label>
                    <label className="grid gap-2 text-sm text-[#3d4947]">
                      Mode de paiement
                      <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm" name="payment_method" defaultValue="bank_transfer">
                        <option value="bank_transfer">Virement bancaire</option>
                        <option value="card">Carte bancaire</option>
                        <option value="cash">Especes</option>
                        <option value="cheque">Cheque</option>
                        <option value="other">Autre</option>
                      </select>
                    </label>
                  </div>
                  <label className="grid gap-2 text-sm text-[#3d4947]">
                    Note additionnelle
                    <textarea className="focus-ring min-h-24 rounded-md border border-[var(--line)] bg-white px-3 py-3 text-sm" name="notes" placeholder="Ex: Paiement anticipe recu le 28..." />
                  </label>
                </form>
              ) : (
                <form action={createExpenseTransactionAction} className="grid gap-5" id="transaction-expense-form">
                  <input name="locale" type="hidden" value={locale} />
                  <label className="grid gap-2 text-sm text-[#3d4947]">
                    Categorie de la depense
                    <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm" name="tax_category_id" defaultValue={taxCategories[0]?.id ?? ''}>
                      {taxCategories.length ? null : <option value="">Autres frais</option>}
                      {taxCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm text-[#3d4947]">
                    Bien immobilier concerne
                    <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm" name="property_id" defaultValue={properties[0]?.id ?? ''}>
                      <option value="">Global</option>
                      {properties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm text-[#3d4947]">
                      Fournisseur
                      <input autoComplete="off" className="focus-ring min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm" defaultValue="" name="vendor" placeholder="ex: Leroy Merlin" />
                    </label>
                    <label className="grid gap-2 text-sm text-[#3d4947]">
                      Date de facture
                      <DateDisplayInput className="focus-ring h-11 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm" defaultValue={today()} name="expense_date" required />
                    </label>
                  </div>
                  <label className="grid gap-2 text-sm text-[#3d4947]">
                    Description
                    <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm" name="description" placeholder="ex: Peinture et materiel de renovation" />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid min-w-0 gap-2 text-sm text-[#3d4947]">
                      Montant TTC
                      <div className="relative min-h-11 min-w-0 rounded-md border border-[var(--line)] bg-white">
                        <input className="h-11 w-full min-w-0 border-0 bg-transparent px-3 pr-14 text-sm outline-none" name="amount" placeholder="0.00" required />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#3d4947]">EUR</span>
                      </div>
                    </label>
                    <label className="grid gap-2 text-sm text-[#3d4947]">
                      Mode de paiement
                      <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm" name="payment_method" defaultValue="card">
                        <option value="card">Carte bancaire</option>
                        <option value="bank_transfer">Virement bancaire</option>
                        <option value="cash">Especes</option>
                        <option value="cheque">Cheque</option>
                        <option value="other">Autre</option>
                      </select>
                    </label>
                  </div>
                  <fieldset className="grid gap-3">
                    <legend className="mb-1 text-sm text-[#3d4947]">Statut du paiement</legend>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="focus-within:ring-2 focus-within:ring-[var(--accent)] flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--accent)] bg-[#e6f4f1] text-sm font-semibold text-[var(--accent)]">
                        <input defaultChecked name="payment_status" type="radio" value="paid" />
                        Paye
                      </label>
                      <label className="focus-within:ring-2 focus-within:ring-[var(--accent)] flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white text-sm text-[#3d4947]">
                        <input name="payment_status" type="radio" value="pending" />
                        A regler
                      </label>
                    </div>
                  </fieldset>
                  <label className="grid gap-2 text-sm text-[#3d4947]">
                    Justificatif (Facture, ticket...)
                    <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-[var(--line)] bg-[#fbfdfc] p-5 text-center">
                      <Icon className="mb-3 rounded-full bg-[#eef2f0] p-2 text-[28px]">cloud_upload</Icon>
                      <span className="text-sm font-semibold text-[#171d1c]">Cliquez pour ajouter un fichier</span>
                      <span className="mt-1 text-xs text-[#3d4947]">PDF, JPG ou PNG (Max 10Mo)</span>
                      <input accept=".pdf,.jpg,.jpeg,.png" className="mt-4 w-full text-sm" name="receipt" type="file" />
                    </div>
                  </label>
                </form>
              )}
            </div>

            <div className="grid grid-cols-[1fr_1.6fr] gap-4 border-t border-[var(--line-soft)] bg-[#fbfdfc] px-6 py-5">
              <button className="focus-ring min-h-11 rounded-lg border border-[var(--line)] bg-white text-sm font-semibold hover:bg-[#f0f5f2]" onClick={() => setOpen(false)} type="button">
                Annuler
              </button>
              <button className="focus-ring min-h-11 rounded-lg bg-[var(--accent)] text-sm font-semibold text-white shadow-sm hover:bg-[var(--accent-strong)]" form={mode === 'revenue' ? 'transaction-revenue-form' : 'transaction-expense-form'} style={{color: '#ffffff'}} type="submit">
                {mode === 'revenue' ? 'Enregistrer la transaction' : 'Enregistrer la depense'}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
