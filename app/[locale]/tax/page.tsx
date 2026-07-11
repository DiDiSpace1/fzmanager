import Link from 'next/link';
import type {ReactNode} from 'react';
import {getLocale} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {localizedPath} from '@/lib/navigation';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {ReceiptUploadButton} from './receipt-upload-button';

type PropertyOption = {
  id: string;
  name: string;
};

type ExpenseRow = {
  amount: number;
  description: string | null;
  documents: {
    file_name: string;
    file_path: string;
  } | null;
  expense_date: string;
  id: string;
  properties: {
    name: string;
  } | null;
  receipt_status: string;
  tax_categories: {
    label: string;
  } | null;
  vendor: string | null;
};

type RentChargeRow = {
  charges_amount: number;
  due_date: string | null;
  period_month: string;
  rent_amount: number;
  status: string;
  total_due: number;
  leases: {
    properties: {
      name: string;
    } | null;
    tenants: {
      full_name: string;
    } | null;
  } | null;
};

type TaxPageProps = {
  searchParams: Promise<{
    error?: string;
    property_id?: string;
    tab?: string;
    year?: string;
  }>;
};

function parseYear(value: string | undefined) {
  const year = value ? Number.parseInt(value, 10) : new Date().getFullYear();
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : new Date().getFullYear();
}

function yearRange(year: number) {
  return {
    end: `${year + 1}-01-01`,
    start: `${year}-01-01`
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    currency: 'EUR',
    style: 'currency'
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(value));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric'
  }).format(new Date(`${value.slice(0, 7)}-01T00:00:00.000Z`));
}

function statusMeta(status: string) {
  if (status === 'paid') {
    return {className: 'bg-[#e8f8f2] text-[var(--accent)]', label: 'Payé'};
  }

  if (status === 'partial') {
    return {className: 'bg-[#fff8ec] text-[#924628]', label: 'En attente'};
  }

  if (status === 'waived') {
    return {className: 'bg-[#eef2f0] text-[#6d7a77]', label: 'Annulé'};
  }

  return {className: 'bg-[#ffdad6] text-[#ba1a1a]', label: 'En retard'};
}

function tabHref(input: {propertyId: string; tab: 'expenses' | 'revenues'; year: number}) {
  const params = new URLSearchParams({
    tab: input.tab,
    year: String(input.year)
  });

  if (input.propertyId) {
    params.set('property_id', input.propertyId);
  }

  return `/tax?${params.toString()}`;
}

function Icon({children, className = ''}: {children: string; className?: string}) {
  return <span className={`material-symbols-outlined text-[20px] ${className}`}>{children}</span>;
}

function StatCard({
  accent,
  label,
  note,
  tone = 'default',
  value
}: {
  accent?: 'expense' | 'missing';
  label: string;
  note: string;
  tone?: 'danger' | 'default' | 'primary';
  value: string;
}) {
  return (
    <div className={`min-h-[150px] rounded-lg border border-[var(--line-soft)] bg-white p-6 shadow-sm ${accent === 'expense' ? 'border-l-4 border-l-[#b05e3d]' : ''} ${accent === 'missing' ? 'border-l-4 border-l-[#ba1a1a]' : ''}`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.02em] text-[var(--muted)]">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${tone === 'primary' ? 'text-[var(--accent)]' : tone === 'danger' ? 'text-[#ba1a1a]' : 'text-[#171d1c]'}`}>{value}</p>
      <p className="mt-2 max-w-[220px] text-sm leading-5 text-[var(--muted)]">{note}</p>
    </div>
  );
}

function CategoryBadge({children}: {children: ReactNode}) {
  return <span className="inline-flex max-w-[150px] rounded-md bg-[#eef2f0] px-2.5 py-1 text-xs leading-4 text-[#3d4947]">{children}</span>;
}

function StatusBadge({className, label}: {className: string; label: string}) {
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

function ReceiptIndicator({expense}: {expense: ExpenseRow & {viewUrl?: string | null}}) {
  if (expense.documents?.file_path && expense.viewUrl) {
    return (
      <a className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--accent)] hover:bg-[#eef7f4]" href={expense.viewUrl} title="Voir le justificatif" target="_blank" rel="noreferrer">
        <Icon>check_circle</Icon>
      </a>
    );
  }

  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#e07a00]" title="Justificatif manquant">
      <Icon>warning</Icon>
    </span>
  );
}

export default async function TaxPage({searchParams}: TaxPageProps) {
  const locale = await getLocale();
  const params = await searchParams;
  const year = parseYear(params.year);
  const propertyId = params.property_id ?? '';
  const selectedTab = params.tab === 'revenues' ? 'revenues' : 'expenses';
  const range = yearRange(year);
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: properties} = await supabase.from('properties').select('id, name').eq('workspace_id', workspaceId).order('name', {ascending: true}).returns<PropertyOption[]>();

  let rentQuery = supabase
    .from('rent_charges')
    .select('period_month, due_date, rent_amount, charges_amount, total_due, status, leases!inner(property_id, properties(name), tenants(full_name))')
    .eq('workspace_id', workspaceId)
    .gte('period_month', range.start)
    .lt('period_month', range.end);

  if (propertyId) {
    rentQuery = rentQuery.eq('leases.property_id', propertyId);
  }

  const {data: rentCharges} = await rentQuery.order('period_month', {ascending: false}).returns<RentChargeRow[]>();
  let expenseQuery = supabase
    .from('expenses')
    .select('id, amount, description, expense_date, receipt_status, vendor, documents(file_name, file_path), properties(name), tax_categories(label)')
    .eq('workspace_id', workspaceId)
    .gte('expense_date', range.start)
    .lt('expense_date', range.end);

  if (propertyId) {
    expenseQuery = expenseQuery.eq('property_id', propertyId);
  }

  const {data: expenses} = await expenseQuery.order('expense_date', {ascending: false}).returns<ExpenseRow[]>();
  let documentQuery = supabase
    .from('documents')
    .select('id', {count: 'exact', head: true})
    .eq('workspace_id', workspaceId)
    .in('document_type', ['invoice', 'rent_receipt'])
    .gte('created_at', range.start)
    .lt('created_at', range.end);

  if (propertyId) {
    documentQuery = documentQuery.eq('property_id', propertyId);
  }

  const {count: availableDocumentsCount} = await documentQuery;
  const expenseRows = expenses ?? [];
  const rentRows = rentCharges ?? [];
  const signedExpenseRows = await Promise.all(
    expenseRows.map(async (expense) => {
      if (!expense.documents?.file_path) {
        return {...expense, viewUrl: null};
      }

      const {data} = await supabase.storage.from('documents').createSignedUrl(expense.documents.file_path, 60 * 10);
      return {...expense, viewUrl: data?.signedUrl ?? null};
    })
  );
  const receivedRevenue = rentRows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.total_due ?? 0), 0);
  const recordedExpenses = expenseRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const missingReceipts = signedExpenseRows.filter((row) => row.receipt_status === 'missing' || !row.documents?.file_path);
  const cashBalance = receivedRevenue - recordedExpenses;
  const exportQuery = new URLSearchParams({year: String(year)});

  if (propertyId) {
    exportQuery.set('property_id', propertyId);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">Préparation comptable {year}</h1>
            <p className="mt-2 text-sm leading-6 text-[#3d4947]">Préparez et exportez vos revenus, dépenses et justificatifs pour votre comptable.</p>
            <p className="mt-1 text-xs font-medium text-[#3d4947]">Période du 01/01/{year} au 31/12/{year}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-medium text-[#3d4947] hover:bg-[#f0f5f2]" href={`/api/tax/export?${exportQuery.toString()}`}>
              <Icon>download</Icon>
              Exporter CSV
            </Link>
            <Link className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[#005049]" href={`/api/tax/export.zip?${exportQuery.toString()}`} style={{color: '#ffffff'}}>
              <Icon>folder_zip</Icon>
              Exporter l&apos;archive ZIP
            </Link>
          </div>
        </div>

        {params.error ? (
          <div className="mb-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
            Impossible de finaliser cette action. Verifiez le fichier, votre forfait ou reessayez.
          </div>
        ) : null}

        <form className="mb-8 rounded-lg border border-[var(--line-soft)] bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="grid gap-1 text-xs font-semibold text-[#3d4947]">
              Année
              <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-normal" defaultValue={year} name="year">
                {[2026, 2025, 2024].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[#3d4947]">
              Bien
              <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-normal" defaultValue={propertyId} name="property_id">
                <option value="">Tous les biens</option>
                {(properties ?? []).map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
            <input name="tab" type="hidden" value={selectedTab} />
            <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-6 text-sm font-semibold text-white hover:bg-[#005049]" style={{color: '#ffffff'}} type="submit">
              Filtrer
            </button>
          </div>
        </form>

        <section className="mb-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Revenus encaissés" note="Loyers et charges reçus" value={formatMoney(receivedRevenue)} />
          <StatCard accent="expense" label="Dépenses enregistrées" note="Toutes catégories confondues" value={formatMoney(recordedExpenses)} />
          <StatCard label="Justificatifs disponibles" note="Factures et reçus liés" tone="primary" value={String(availableDocumentsCount ?? 0)} />
          <StatCard accent="missing" label="Justificatifs manquants" note="Dépenses sans document lié" tone="danger" value={String(missingReceipts.length)} />
        </section>

        <section className="mb-8 overflow-hidden rounded-lg border border-[var(--line-soft)] bg-white shadow-sm">
          <div className="border-b border-[var(--line-soft)] bg-[#f0f5f2] px-6 py-4">
            <h2 className="text-base font-semibold">Résumé annuel</h2>
          </div>
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-[#3d4947]">Revenus encaissés</span>
              <span className="font-semibold tabular-nums">{formatMoney(receivedRevenue)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-[#3d4947]">Dépenses enregistrées</span>
              <span className="font-semibold text-[#ba1a1a] tabular-nums">- {formatMoney(recordedExpenses)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-[var(--line-soft)] pt-4">
              <span className="text-base font-semibold">Solde de trésorerie</span>
              <span className={`text-2xl font-semibold tabular-nums ${cashBalance < 0 ? 'text-[#ba1a1a]' : 'text-[var(--accent)]'}`}>{formatMoney(cashBalance)}</span>
            </div>
          </div>
          <div className="border-t border-[var(--line-soft)] bg-white px-6 py-3">
            <p className="text-sm italic text-[#3d4947]">Ce solde correspond uniquement aux flux enregistrés. Il ne constitue pas un résultat fiscal.</p>
          </div>
        </section>

        <section className="mb-8 overflow-hidden rounded-lg border border-[var(--line-soft)] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[var(--line-soft)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold">Détail des opérations</h2>
            <div className="inline-flex w-fit rounded-lg bg-[#f0f5f2] p-1">
              <Link className={`focus-ring rounded-md px-4 py-2 text-xs font-semibold ${selectedTab === 'revenues' ? 'bg-white text-[var(--accent)] shadow-sm' : 'text-[#3d4947]'}`} href={tabHref({propertyId, tab: 'revenues', year})}>
                Revenus
              </Link>
              <Link className={`focus-ring rounded-md px-4 py-2 text-xs font-semibold ${selectedTab === 'expenses' ? 'bg-white text-[var(--accent)] shadow-sm' : 'text-[#3d4947]'}`} href={tabHref({propertyId, tab: 'expenses', year})}>
                Dépenses
              </Link>
            </div>
          </div>

          {selectedTab === 'expenses' ? (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-[#f0f5f2] text-xs font-semibold uppercase text-[#3d4947]">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Bien</th>
                    <th className="px-6 py-3">Catégorie</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">Fournisseur</th>
                    <th className="px-6 py-3 text-right">Montant</th>
                    <th className="px-6 py-3 text-center">Justificatif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-soft)]">
                  {signedExpenseRows.length ? (
                    signedExpenseRows.map((expense) => {
                      const missing = expense.receipt_status === 'missing' || !expense.documents?.file_path;
                      return (
                        <tr className="hover:bg-[#f8fbfa]" key={expense.id}>
                          <td className="px-6 py-4 tabular-nums">{formatDate(expense.expense_date)}</td>
                          <td className="px-6 py-4">{expense.properties?.name ?? 'Global'}</td>
                          <td className="px-6 py-4">
                            <CategoryBadge>{expense.tax_categories?.label ?? 'Autres frais'}</CategoryBadge>
                          </td>
                          <td className="px-6 py-4">{expense.description || 'Dépense'}</td>
                          <td className="px-6 py-4">{expense.vendor || '-'}</td>
                          <td className={`px-6 py-4 text-right font-semibold tabular-nums ${missing ? 'text-[#ba1a1a]' : ''}`}>{formatMoney(Number(expense.amount ?? 0))}</td>
                          <td className="px-6 py-4 text-center">
                            <ReceiptIndicator expense={expense} />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-6 py-10 text-center text-[var(--muted)]" colSpan={7}>
                        Aucune dépense enregistrée pour cette période.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-[#f0f5f2] text-xs font-semibold uppercase text-[#3d4947]">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Bien</th>
                    <th className="px-6 py-3">Locataire</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Période</th>
                    <th className="px-6 py-3 text-right">Montant</th>
                    <th className="px-6 py-3">Statut</th>
                    <th className="px-6 py-3 text-center">Justificatif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-soft)]">
                  {rentRows.length ? (
                    rentRows.map((charge) => {
                      const meta = statusMeta(charge.status);
                      return (
                        <tr className="hover:bg-[#f8fbfa]" key={`${charge.period_month}-${charge.leases?.tenants?.full_name ?? 'tenant'}-${charge.total_due}`}>
                          <td className="px-6 py-4 tabular-nums">{charge.due_date ? formatDate(charge.due_date) : formatDate(charge.period_month)}</td>
                          <td className="px-6 py-4">{charge.leases?.properties?.name ?? '-'}</td>
                          <td className="px-6 py-4">{charge.leases?.tenants?.full_name ?? '-'}</td>
                          <td className="px-6 py-4">Loyer + Charges</td>
                          <td className="px-6 py-4 capitalize">{formatMonth(charge.period_month)}</td>
                          <td className="px-6 py-4 text-right font-semibold tabular-nums">{formatMoney(Number(charge.total_due ?? 0))}</td>
                          <td className="px-6 py-4">
                            <StatusBadge className={meta.className} label={meta.label} />
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#e07a00]" title="Quittance non liee">
                              <Icon>warning</Icon>
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-6 py-10 text-center text-[var(--muted)]" colSpan={8}>
                        Aucun revenu enregistré pour cette période.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mb-8 overflow-hidden rounded-lg border border-[var(--line-soft)] border-l-4 border-l-[#e07a00] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[var(--line-soft)] bg-[#f8fbfa] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Icon className="text-[#e07a00]">warning</Icon>
              <h2 className="text-base font-semibold">Dépenses sans justificatif</h2>
            </div>
            <span className="w-fit rounded-md border border-[#f0d6b6] bg-white px-3 py-1 text-xs font-medium text-[#924628]">{missingReceipts.length} actions requises</span>
          </div>
          {missingReceipts.length ? (
            <div className="divide-y divide-[var(--line-soft)]">
              {missingReceipts.map((expense) => (
                <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between" key={expense.id}>
                  <div className="flex min-w-0 gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef2f0] text-[#171d1c]">
                      <Icon>{expense.tax_categories?.label?.toLowerCase().includes('mobilier') ? 'shopping_cart' : 'build'}</Icon>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#171d1c]">
                        {expense.description || expense.vendor || 'Dépense'} - {formatMoney(Number(expense.amount ?? 0))}
                      </p>
                      <p className="mt-1 text-sm text-[#3d4947]">
                        {formatDate(expense.expense_date)} • {expense.properties?.name ?? 'Global'} • {expense.tax_categories?.label ?? 'Autres frais'}
                      </p>
                    </div>
                  </div>
                  <ReceiptUploadButton expenseId={expense.id} locale={locale} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-6 text-sm text-[var(--accent)]">
              <Icon>check_circle</Icon>
              Aucune dépense sans justificatif pour le moment.
            </div>
          )}
        </section>

        <div className="mb-20 flex gap-3 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          <Icon className="shrink-0 text-[#e07a00]">info</Icon>
          <p>Les données exportées sont destinées à faciliter la préparation comptable. Leur traitement fiscal reste à valider par votre comptable.</p>
        </div>

        <footer className="flex flex-col gap-4 border-t border-[var(--line-soft)] py-8 text-sm text-[#3d4947] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-[#171d1c]">Petit Bailleur</p>
            <p className="mt-2">© 2026 Petit Bailleur - Gestion Immobilière Simplifiée</p>
          </div>
          <Link className="hover:text-[var(--accent)]" href={localizedPath(locale, '/terms')}>
            Mentions Légales
          </Link>
        </footer>
      </div>
    </AppShell>
  );
}
