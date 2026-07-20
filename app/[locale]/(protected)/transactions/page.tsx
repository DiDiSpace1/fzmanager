import {getLocale, getTranslations} from 'next-intl/server';

import {getCurrentUserWorkspace} from '@/lib/workspace';

import {TransactionDrawer, type LeaseOption} from './transaction-drawer';
import {TransactionsOverview, type TransactionOverviewRow, type TransactionStat} from './transactions-overview';

type PropertyOption = {
  id: string;
  name: string;
};

type TaxCategoryOption = {
  id: string;
  label: string;
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

type TransactionsPageProps = {
  searchParams: Promise<{
    error?: string;
    new?: string;
    rent_charge_id?: string;
    tenant_id?: string;
    view?: string;
  }>;
};

function monthRange(locale: string) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));

  return {
    current: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat(locale, {month: 'long'}).format(start),
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

function formatMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: 'EUR',
    style: 'currency'
  }).format(value);
}

const revenueTypeNotePattern = /^\[\[loyelio:revenue_type=(rent|deposit|other)\]\]\n?/;

function noteRevenueType(notes: string | null | undefined) {
  return notes?.match(revenueTypeNotePattern)?.[1] ?? 'rent';
}

function cleanRevenueNotes(notes: string | null | undefined) {
  return notes?.replace(revenueTypeNotePattern, '') || null;
}

function isIncomePayment(row: Pick<PaymentRow, 'notes'>) {
  return noteRevenueType(row.notes) !== 'deposit';
}

function revenueCategory(type: string | null | undefined, t: (key: 'deposit' | 'other' | 'rent') => string) {
  if (type === 'deposit') {
    return t('deposit');
  }

  if (type === 'other') {
    return t('other');
  }

  return t('rent');
}

export default async function TransactionsPage({searchParams}: TransactionsPageProps) {
  const locale = await getLocale();
  const t = await getTranslations('transactions');
  const params = await searchParams;
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const range = monthRange(locale);
  const previousRange = previousMonthRange();
  const [{data: properties}, {data: taxCategories}, {data: leases}, {data: currentPayments}, {data: previousPayments}, {data: currentExpenses}] = await Promise.all([
    supabase.from('properties').select('id, name').eq('workspace_id', workspaceId).order('name', {ascending: true}).returns<PropertyOption[]>(),
    supabase.from('tax_categories').select('id, label').eq('country_code', 'FR').eq('tax_regime', 'LMNP').eq('active', true).order('sort_order', {ascending: true}).returns<TaxCategoryOption[]>(),
    supabase
      .from('leases')
      .select('id, monthly_rent, charges_amount, deposit_amount, properties(id, name), tenants(id, full_name), rent_charges(id, period_month, total_due, rent_payments(amount, notes))')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .order('created_at', {ascending: false})
      .returns<LeaseOption[]>(),
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
      .returns<ExpenseRow[]>()
  ]);
  const {data: viewedPayment} = params.view
    ? await supabase
        .from('rent_payments')
        .select('id, amount, paid_at, payment_method, notes, rent_charges(period_month, status, total_due, leases(properties(name), tenants(full_name)))')
        .eq('workspace_id', workspaceId)
        .eq('id', params.view)
        .maybeSingle<PaymentRow>()
    : {data: null};
  const currentPaymentRows = currentPayments ?? [];
  const paymentRows = viewedPayment && !currentPaymentRows.some((row) => row.id === viewedPayment.id) ? [viewedPayment, ...currentPaymentRows] : currentPaymentRows;
  const expenseRows = currentExpenses ?? [];
  const monthlyRevenue = currentPaymentRows.filter(isIncomePayment).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const monthlyDeposit = currentPaymentRows.filter((row) => noteRevenueType(row.notes) === 'deposit').reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const previousRevenue = (previousPayments ?? []).filter(isIncomePayment).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const monthlyExpenses = expenseRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const revenueTrend = previousRevenue > 0 ? ((monthlyRevenue - previousRevenue) / previousRevenue) * 100 : null;
  const sortedRows: TransactionOverviewRow[] = [
    ...paymentRows.map((row) => ({
      amount: Number(row.amount ?? 0),
      category: revenueCategory(noteRevenueType(row.notes), t),
	      date: row.paid_at,
      filter: noteRevenueType(row.notes) === 'deposit' ? ('deposit' as const) : ('income' as const),
	      id: row.id,
	      meta: [row.rent_charges?.leases?.properties?.name, row.rent_charges?.leases?.tenants?.full_name].filter(Boolean).join(' - ') || '-',
      notes: cleanRevenueNotes(row.notes),
	      paymentMethod: row.payment_method,
      revenueType: noteRevenueType(row.notes),
	      status: row.rent_charges?.status ?? 'paid',
      type: 'revenue' as const
    })),
    ...expenseRows.map((row) => ({
      amount: Number(row.amount ?? 0),
      category: row.tax_categories?.label ?? t('expense'),
	      date: row.expense_date,
	      description: row.description,
      filter: 'expense' as const,
	      id: row.id,
	      meta: [row.properties?.name, row.vendor].filter(Boolean).join(' - ') || '-',
	      propertyId: row.property_id,
	      status: 'paid',
	      taxCategoryId: row.tax_category_id,
	      type: 'expense' as const,
	      vendor: row.vendor
    }))
  ].sort((a, b) => b.date.localeCompare(a.date));
  const combinedRows = params.view ? sortedRows.filter((row, index) => index < 10 || row.id === params.view) : sortedRows.slice(0, 10);
  const stats: TransactionStat[] = [
    {
      filter: 'income',
      icon: 'payments',
      label: t('monthlyRevenue', {month: range.label.charAt(0).toUpperCase() + range.label.slice(1)}),
      note: revenueTrend === null ? t('noPreviousMonth') : t('trend', {value: `${revenueTrend >= 0 ? '+' : ''}${revenueTrend.toLocaleString(locale, {maximumFractionDigits: 1})}`}),
      tone: 'revenue',
      value: formatMoney(monthlyRevenue, locale)
    },
    {
      filter: 'deposit',
      icon: 'account_balance_wallet',
      label: t('monthlyDeposits'),
      note: t('depositsNote'),
      tone: 'deposit',
      value: formatMoney(monthlyDeposit, locale)
    },
    {
      filter: 'expense',
      icon: 'receipt_long',
      label: t('monthlyExpenses'),
      note: t('transactionCount', {count: expenseRows.length}),
      tone: 'expense',
      value: formatMoney(monthlyExpenses, locale)
    }
  ];

  return (
    <>
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">{t('title')}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('subtitle')}</p>
        </div>
        <TransactionDrawer initialOpen={params.new === 'transaction'} initialRentChargeId={params.rent_charge_id} initialTenantId={params.tenant_id} leases={leases ?? []} locale={locale} properties={properties ?? []} taxCategories={taxCategories ?? []} />
      </div>

      {params.error ? (
        <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          {t('error')}
        </div>
      ) : null}

      <TransactionsOverview
        initialViewId={params.view}
        locale={locale}
        properties={(properties ?? []).map((property) => ({id: property.id, label: property.name}))}
        rows={combinedRows}
        stats={stats}
        taxCategories={(taxCategories ?? []).map((category) => ({id: category.id, label: category.label}))}
      />
    </>
  );
}
