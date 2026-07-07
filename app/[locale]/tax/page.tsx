import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {PageHeader} from '@/components/app/page-header';
import {StatCard} from '@/components/app/stat-card';
import {hasPaidAccess} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {createCheckoutSessionAction} from '../settings/actions';

type RentCharge = {
  total_due: number;
  status: string;
};

type PropertyOption = {
  id: string;
  name: string;
};

type ExpenseRow = {
  id: string;
  amount: number;
  receipt_status: string;
  vendor: string | null;
  expense_date: string;
  tax_categories: {
    label: string;
  } | null;
};

function yearRange(year: number) {
  return {
    end: `${year + 1}-01-01`,
    start: `${year}-01-01`
  };
}

type TaxPageProps = {
  searchParams: Promise<{
    error?: string;
    property_id?: string;
    year?: string;
  }>;
};

function parseYear(value: string | undefined) {
  const year = value ? Number.parseInt(value, 10) : new Date().getFullYear();
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : new Date().getFullYear();
}

export default async function TaxPage({searchParams}: TaxPageProps) {
  const t = await getTranslations('tax');
  const locale = await getLocale();
  const params = await searchParams;
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const year = parseYear(params.year);
  const propertyId = params.property_id || '';
  const range = yearRange(year);
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const paid = hasPaidAccess(billing);
  const {data: properties} = await supabase
    .from('properties')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .order('name', {ascending: true})
    .returns<PropertyOption[]>();
  let rentQuery = supabase
    .from('rent_charges')
    .select('total_due, status, leases!inner(property_id)')
    .eq('workspace_id', workspaceId)
    .gte('period_month', range.start)
    .lt('period_month', range.end);

  if (propertyId) {
    rentQuery = rentQuery.eq('leases.property_id', propertyId);
  }

  const {data: rentCharges} = await rentQuery.returns<RentCharge[]>();
  let expenseQuery = supabase
    .from('expenses')
    .select('id, amount, receipt_status, vendor, expense_date, tax_categories(label)')
    .eq('workspace_id', workspaceId)
    .gte('expense_date', range.start)
    .lt('expense_date', range.end);

  if (propertyId) {
    expenseQuery = expenseQuery.eq('property_id', propertyId);
  }

  const {data: expenses} = await expenseQuery.order('expense_date', {ascending: false}).returns<ExpenseRow[]>();

  const expectedIncome = (rentCharges ?? []).reduce((sum, charge) => sum + Number(charge.total_due), 0);
  const deductibleExpenses = (expenses ?? []).reduce((sum, expense) => sum + Number(expense.amount), 0);
  const missingReceipts = (expenses ?? []).filter((expense) => expense.receipt_status === 'missing');
  const exportQuery = new URLSearchParams({year: String(year)});

  if (propertyId) {
    exportQuery.set('property_id', propertyId);
  }

  return (
    <AppShell>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <div className="flex flex-wrap gap-2">
            {paid ? (
              <>
                <Link className="focus-ring inline-flex min-h-11 items-center rounded-md border border-[var(--line)] bg-white px-5 text-sm font-semibold" href={`/api/tax/export?${exportQuery.toString()}`}>
                  Export CSV
                </Link>
                <Link className="focus-ring inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" href={`/api/tax/export.zip?${exportQuery.toString()}`}>
                  Export ZIP
                </Link>
              </>
            ) : (
              <form action={createCheckoutSessionAction}>
                <input name="locale" type="hidden" value={locale} />
                <input name="plan" type="hidden" value="subscription" />
                <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" type="submit">
                  Debloquer l export
                </button>
              </form>
            )}
          </div>
        }
      />
      {params.error === 'billing_required' ? (
        <div className="mb-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          L export fiscal est inclus dans Pro. Debloquez l export pour telecharger le CSV ou le ZIP.
        </div>
      ) : null}
      {!paid ? (
        <div className="mb-6 rounded-md border border-[#b8d8c5] bg-[#f0fbf3] p-4 text-sm leading-6 text-[#215d35]">
          Vous pouvez preparer et verifier vos donnees gratuitement. Le telechargement du dossier fiscal est reserve aux espaces Pro.
        </div>
      ) : null}
      <form className="mb-6 grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4 sm:grid-cols-[140px_1fr_auto]">
        <label className="grid gap-2 text-sm font-medium">
          Annee
          <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" defaultValue={year} max="2100" min="2000" name="year" type="number" />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Bien
          <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" defaultValue={propertyId} name="property_id">
            <option value="">Tous les biens</option>
            {(properties ?? []).map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>
        <button className="focus-ring min-h-11 self-end rounded-md border border-[var(--line)] px-5 text-sm font-semibold hover:bg-[#f2f0ea]" type="submit">
          Filtrer
        </button>
      </form>
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Revenus attendus" value={`${expectedIncome.toFixed(2)} EUR`} note={`Echeances ${year}`} />
        <StatCard label="Depenses classees" value={`${deductibleExpenses.toFixed(2)} EUR`} note="Categories LMNP indicatives" />
        <StatCard label="Justificatifs manquants" value={`${missingReceipts.length}`} note="Depenses sans document lie" />
      </section>

      <section className="mt-8 rounded-lg border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] p-5">
          <h2 className="text-lg font-semibold">Depenses sans justificatif</h2>
        </div>
        {missingReceipts.length ? (
          <div className="divide-y divide-[var(--line)]">
            {missingReceipts.map((expense) => (
              <div className="flex items-center justify-between p-5" key={expense.id}>
                <div>
                  <p className="font-medium">{expense.vendor || expense.tax_categories?.label || 'Depense'}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{expense.expense_date}</p>
                </div>
                <p className="text-sm font-semibold">{Number(expense.amount).toFixed(2)} EUR</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-sm text-[var(--muted)]">Aucune depense sans justificatif pour le moment.</div>
        )}
      </section>

      <p className="mt-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">{t('disclaimer')}</p>
    </AppShell>
  );
}
