import {getLocale} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {TransactionActionsMenu, type TransactionActionRow} from './transaction-actions-menu';
import {TransactionDrawer, type LeaseOption} from './transaction-drawer';

type PropertyOption = {
  id: string;
  name: string;
};

type TaxCategoryOption = {
  id: string;
  label: string;
};

type RevenueRow = {
  id: string;
  period_month: string;
  status: string;
  total_due: number;
  rent_payments: {
    amount: number;
  }[];
  leases: {
    properties: {
      name: string;
    } | null;
    tenants: {
      full_name: string;
    } | null;
  } | null;
};

type PaymentRow = {
  amount: number;
  id: string;
  notes: string | null;
  paid_at: string;
  payment_method: string | null;
  rent_charges: {
    period_month: string;
    status: string;
    total_due: number | null;
    leases: {
      properties: {
        name: string;
      } | null;
      tenants: {
        full_name: string;
      } | null;
    } | null;
  } | null;
};

type ExpenseRow = {
  amount: number;
  description: string | null;
  expense_date: string;
  id: string;
  property_id: string | null;
  tax_category_id: string | null;
  properties: {
    name: string;
  } | null;
  tax_categories: {
    label: string;
  } | null;
  vendor: string | null;
};

type TransactionRow =
  | {
      amount: number;
      category: string;
      date: string;
      description?: string | null;
      id: string;
      meta: string;
      notes?: string | null;
      paymentMethod?: string | null;
      propertyId?: string | null;
      status: string;
      taxCategoryId?: string | null;
      type: 'expense';
      vendor?: string | null;
    }
  | {
      amount: number;
      category: string;
      date: string;
      description?: string | null;
      id: string;
      meta: string;
      notes?: string | null;
      paymentMethod?: string | null;
      propertyId?: string | null;
      status: string;
      taxCategoryId?: string | null;
      type: 'revenue';
      vendor?: string | null;
    };

type TransactionsPageProps = {
  searchParams: Promise<{
    error?: string;
    new?: string;
    tenant_id?: string;
  }>;
};

function monthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));

  return {
    current: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat('fr-FR', {month: 'long'}).format(start),
    start: start.toISOString().slice(0, 10)
  };
}

function previousMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

  return {
    end: end.toISOString().slice(0, 10),
    start: start.toISOString().slice(0, 10)
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

function paidAmount(row: Pick<RevenueRow, 'rent_payments'>) {
  return row.rent_payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
}

function Icon({children, className = ''}: {children: string; className?: string}) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export default async function TransactionsPage({searchParams}: TransactionsPageProps) {
  const locale = await getLocale();
  const params = await searchParams;
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const range = monthRange();
  const previousRange = previousMonthRange();
  const [{data: properties}, {data: taxCategories}, {data: leases}, {data: currentRevenues}, {data: currentPayments}, {data: previousPayments}, {data: currentExpenses}, {data: recentPayments}, {data: recentExpenses}] = await Promise.all([
    supabase.from('properties').select('id, name').eq('workspace_id', workspaceId).order('name', {ascending: true}).returns<PropertyOption[]>(),
    supabase.from('tax_categories').select('id, label').eq('country_code', 'FR').eq('tax_regime', 'LMNP').eq('active', true).order('sort_order', {ascending: true}).returns<TaxCategoryOption[]>(),
    supabase
      .from('leases')
      .select('id, monthly_rent, charges_amount, properties(id, name), tenants(id, full_name), rent_charges(period_month, total_due, rent_payments(amount))')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .order('created_at', {ascending: false})
      .returns<LeaseOption[]>(),
    supabase
      .from('rent_charges')
      .select('id, period_month, status, total_due, rent_payments(amount), leases(properties(name), tenants(full_name))')
      .eq('workspace_id', workspaceId)
      .gte('period_month', range.start)
      .lt('period_month', range.end)
      .order('period_month', {ascending: false})
      .returns<RevenueRow[]>(),
    supabase
      .from('rent_payments')
      .select('id, amount, paid_at, payment_method, notes, rent_charges(period_month, status, total_due, leases(properties(name), tenants(full_name)))')
      .eq('workspace_id', workspaceId)
      .gte('paid_at', range.start)
      .lt('paid_at', range.end)
      .order('paid_at', {ascending: false})
      .returns<PaymentRow[]>(),
    supabase
      .from('rent_payments')
      .select('id, amount, paid_at, payment_method, notes, rent_charges(period_month, status, total_due, leases(properties(name), tenants(full_name)))')
      .eq('workspace_id', workspaceId)
      .gte('paid_at', previousRange.start)
      .lt('paid_at', previousRange.end)
      .returns<PaymentRow[]>(),
    supabase
      .from('expenses')
      .select('id, amount, description, expense_date, property_id, tax_category_id, vendor, properties(name), tax_categories(label)')
      .eq('workspace_id', workspaceId)
      .gte('expense_date', range.start)
      .lt('expense_date', range.end)
      .order('expense_date', {ascending: false})
      .returns<ExpenseRow[]>(),
    supabase
      .from('rent_payments')
      .select('id, amount, paid_at, payment_method, notes, rent_charges(period_month, status, total_due, leases(properties(name), tenants(full_name)))')
      .eq('workspace_id', workspaceId)
      .order('paid_at', {ascending: false})
      .limit(8)
      .returns<PaymentRow[]>(),
    supabase
      .from('expenses')
      .select('id, amount, description, expense_date, property_id, tax_category_id, vendor, properties(name), tax_categories(label)')
      .eq('workspace_id', workspaceId)
      .order('expense_date', {ascending: false})
      .limit(8)
      .returns<ExpenseRow[]>()
  ]);
  const revenueRows = currentRevenues ?? [];
  const paymentRows = currentPayments ?? [];
  const expenseRows = currentExpenses ?? [];
  const monthlyRevenue = paymentRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const previousRevenue = (previousPayments ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const monthlyExpenses = expenseRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const pendingRevenue = revenueRows
    .filter((row) => row.status !== 'paid' && row.status !== 'waived')
    .reduce((sum, row) => sum + Math.max(0, Number(row.total_due ?? 0) - paidAmount(row)), 0);
  const revenueTrend = previousRevenue > 0 ? ((monthlyRevenue - previousRevenue) / previousRevenue) * 100 : null;
  const combinedRows: TransactionRow[] = [
    ...(recentPayments ?? []).map((row) => ({
      amount: Number(row.amount ?? 0),
      category: 'Loyer',
	      date: row.paid_at,
	      id: row.id,
	      meta: [row.rent_charges?.leases?.properties?.name, row.rent_charges?.leases?.tenants?.full_name].filter(Boolean).join(' - ') || '-',
	      notes: row.notes,
	      paymentMethod: row.payment_method,
	      status: row.rent_charges?.status ?? 'paid',
      type: 'revenue' as const
    })),
    ...(recentExpenses ?? []).map((row) => ({
      amount: Number(row.amount ?? 0),
      category: row.tax_categories?.label ?? 'Depense',
	      date: row.expense_date,
	      description: row.description,
	      id: row.id,
	      meta: [row.properties?.name, row.vendor].filter(Boolean).join(' - ') || '-',
	      propertyId: row.property_id,
	      status: 'paid',
	      taxCategoryId: row.tax_category_id,
	      type: 'expense' as const,
	      vendor: row.vendor
    }))
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <AppShell>
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">Transactions</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Gerez vos revenus et depenses immobilieres.</p>
        </div>
        <TransactionDrawer initialOpen={params.new === 'transaction'} initialTenantId={params.tenant_id} leases={leases ?? []} locale={locale} properties={properties ?? []} taxCategories={taxCategories ?? []} />
      </div>

      {params.error ? (
        <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Impossible d&apos;enregistrer cette transaction. Verifiez les champs ou le fichier joint.
        </div>
      ) : null}

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        <StatCard
          icon="payments"
          label={`Revenus Mensuels (${range.label.charAt(0).toUpperCase() + range.label.slice(1)})`}
          note={revenueTrend === null ? 'Aucune donnee le mois dernier' : `${revenueTrend >= 0 ? '+' : ''}${revenueTrend.toLocaleString('fr-FR', {maximumFractionDigits: 1})}% vs mois dernier`}
          tone="revenue"
          value={formatMoney(monthlyRevenue)}
        />
        <StatCard icon="receipt_long" label="Depenses Mensuelles" note={`${expenseRows.length} transaction${expenseRows.length > 1 ? 's' : ''} ce mois`} tone="expense" value={formatMoney(monthlyExpenses)} />
        <StatCard icon="hourglass_empty" label="Loyers en attente" note="Paiements a suivre" tone="pending" value={formatMoney(pendingRevenue)} />
      </section>

      <section className="mt-8 overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-6 py-5">
          <h2 className="text-lg font-semibold text-[#171d1c]">Historique recent</h2>
          <span className="text-sm text-[var(--muted)]">{combinedRows.length} mouvements</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-[#f0f5f2] text-xs font-semibold uppercase text-[#3d4947]">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Categorie</th>
                <th className="px-6 py-3">Bien / Locataire</th>
	                <th className="px-6 py-3 text-right">Montant</th>
	                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-soft)]">
              {combinedRows.length ? (
                combinedRows.map((row) => {
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
                    taxCategoryId: row.taxCategoryId,
                    type: row.type,
                    vendor: row.vendor
                  };
                  return (
                    <tr className="hover:bg-[#f8fbfa]" key={row.id}>
                      <td className="px-6 py-4 tabular-nums">{formatDate(row.date)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-semibold ${row.type === 'revenue' ? 'bg-[#ecfdf5] text-[var(--accent)]' : 'bg-[#ffdbce] text-[#924628]'}`}>
                          <Icon className="text-[15px]">{row.type === 'revenue' ? 'payments' : 'receipt_long'}</Icon>
                          {row.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-[#33413f]">{row.meta}</td>
	                      <td className={`px-6 py-4 text-right font-semibold tabular-nums ${row.type === 'expense' ? 'text-[#924628]' : 'text-[var(--accent)]'}`}>{row.type === 'expense' ? '- ' : ''}{formatMoney(row.amount)}</td>
	                      <td className="px-6 py-4 text-right">
	                        <TransactionActionsMenu
	                          locale={locale}
	                          properties={(properties ?? []).map((property) => ({id: property.id, label: property.name}))}
	                          row={actionRow}
	                          taxCategories={(taxCategories ?? []).map((category) => ({id: category.id, label: category.label}))}
	                        />
	                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-6 py-12 text-center text-[var(--muted)]" colSpan={5}>
                    Aucune transaction pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function StatCard({icon, label, note, tone, value}: {icon: string; label: string; note: string; tone: 'expense' | 'pending' | 'revenue'; value: string}) {
  const tones = {
    expense: {
      icon: 'bg-[#ffdbce] text-[#924628]',
      value: 'text-[#924628]'
    },
    pending: {
      icon: 'bg-[#fff8ec] text-[#b35a09]',
      value: 'text-[#b35a09]'
    },
    revenue: {
      icon: 'bg-[#d9fbf4] text-[var(--accent)]',
      value: 'text-[var(--accent)]'
    }
  };

  return (
    <div className="rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tones[tone].icon}`}>
          <Icon>{icon}</Icon>
        </div>
      </div>
      <p className="text-sm font-semibold text-[#3d4947]">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tones[tone].value}`}>{value}</p>
      <p className="mt-3 text-sm font-medium text-[#3d4947]">{note}</p>
    </div>
  );
}
